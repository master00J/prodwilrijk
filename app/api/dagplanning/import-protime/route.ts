import 'pdf-parse/worker'
import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import {
  matchEmployeeByName,
  parseProtimeTeamCalendarText,
  type ProtimeDayStatus,
} from '@/lib/protime/parse-team-calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_PDF_BYTES = 15 * 1024 * 1024
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const pdfData = await parser.getText()
    return pdfData.text ?? ''
  } finally {
    await parser.destroy()
  }
}

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const apply = formData.get('apply') === 'true'
    const overwrite = formData.get('overwrite') !== 'false'
    const weekdaysOnly = formData.get('weekdays_only') !== 'false'

    if (!file) {
      return NextResponse.json({ error: 'Geen PDF-bestand ontvangen' }, { status: 400 })
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF is te groot (max. 15 MB)' }, { status: 413 })
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''
    try {
      text = await extractPdfText(buffer)
    } catch {
      return NextResponse.json(
        { error: 'Kon de PDF niet lezen. Controleer of het een geldige Protime-export is.' },
        { status: 400 },
      )
    }

    if (!text || text.trim().length < 80) {
      return NextResponse.json(
        { error: 'Geen leesbare tekst in de PDF gevonden.' },
        { status: 400 },
      )
    }

    const parsed = parseProtimeTeamCalendarText(text)

    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, name, active')
      .eq('active', true)

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 })
    }

    const weekendDays = new Set(['za', 'zo'])
    const preview: Array<{
      employee_id: number | null
      employee_name: string
      protime_name: string
      date: string
      status: ProtimeDayStatus
      raw: string
      matched: boolean
    }> = []

    const unmatched = new Set<string>()

    for (const emp of parsed.employees) {
      const employeeId = matchEmployeeByName(emp.firstName, employees ?? [])
      if (!employeeId) unmatched.add(emp.fullName)

      for (const day of emp.days) {
        const dayMeta = parsed.days.find((d) => d.dateIso === day.date)
        if (weekdaysOnly && dayMeta && weekendDays.has(dayMeta.dayLabel)) continue

        const matchedEmployee = employeeId
          ? (employees ?? []).find((e) => e.id === employeeId)
          : null

        preview.push({
          employee_id: employeeId,
          employee_name: matchedEmployee?.name ?? '',
          protime_name: emp.fullName,
          date: day.date,
          status: day.status,
          raw: day.raw,
          matched: employeeId !== null,
        })
      }
    }

    if (!apply) {
      return NextResponse.json({
        generatedAt: parsed.generatedAt,
        days: parsed.days,
        warnings: parsed.warnings,
        preview,
        unmatched: Array.from(unmatched).sort(),
        stats: {
          total: preview.length,
          matched: preview.filter((p) => p.matched).length,
          unmatched: preview.filter((p) => !p.matched).length,
        },
      })
    }

    const toApply = preview.filter((p) => p.matched && p.employee_id !== null)
    if (toApply.length === 0) {
      return NextResponse.json(
        { error: 'Geen enkele medewerker kon gekoppeld worden aan de database.' },
        { status: 400 },
      )
    }

    if (!overwrite) {
      const dates = [...new Set(toApply.map((p) => p.date))]
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('employee_daily_status')
        .select('employee_id, date')
        .in('date', dates)

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 })
      }

      const existingKeys = new Set(
        (existing ?? []).map((r) => `${r.employee_id}-${r.date}`),
      )
      const filtered = toApply.filter(
        (p) => !existingKeys.has(`${p.employee_id}-${p.date}`),
      )

      if (filtered.length === 0) {
        return NextResponse.json({
          applied: 0,
          skipped: toApply.length,
          message: 'Alle dagen hadden al een status; niets overschreven.',
        })
      }

      const rows = filtered.map((p) => ({
        employee_id: p.employee_id!,
        date: p.date,
        status: p.status,
        shift: 'dag',
        assigned_machine_id: null,
        notes: `Protime: ${p.raw}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabaseAdmin
        .from('employee_daily_status')
        .upsert(rows, { onConflict: 'employee_id,date' })

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }

      return NextResponse.json({
        applied: rows.length,
        skipped: toApply.length - rows.length,
        unmatched: Array.from(unmatched).sort(),
        warnings: parsed.warnings,
      })
    }

    const rows = toApply.map((p) => ({
      employee_id: p.employee_id!,
      date: p.date,
      status: p.status,
      shift: 'dag',
      assigned_machine_id: null,
      notes: `Protime: ${p.raw}`.slice(0, 500),
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabaseAdmin
      .from('employee_daily_status')
      .upsert(rows, { onConflict: 'employee_id,date' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      applied: rows.length,
      skipped: 0,
      unmatched: Array.from(unmatched).sort(),
      warnings: parsed.warnings,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Import mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

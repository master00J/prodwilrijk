import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const columnLetterToIndex = (letter?: string) => {
  const s = String(letter || '').trim().toUpperCase()
  let idx = 0
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    if (code < 65 || code > 90) return -1
    idx = idx * 26 + (code - 64)
  }
  return idx - 1
}

const normalizeScanValue = (value: unknown) => {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

const normalizePacForTablet = (value: string | null) => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (upper.startsWith('PAC25')) {
    return raw.length >= 5 ? `PAC25${raw.slice(5)}` : 'PAC25'
  }
  if (upper.startsWith('AC25')) {
    return raw.length >= 4 ? `PAC25${raw.slice(4)}` : 'PAC25'
  }
  return raw
}

const isTruthy = (val: unknown) => {
  if (typeof val === 'boolean') return val === true
  if (val === undefined || val === null) return false
  const t = String(val).trim().toLowerCase()
  return ['waar', 'true', 'ja', 'yes', '1', 'y', 't'].includes(t)
}

const countOccurrences = (values: string[]) => {
  const counts: Record<string, number> = {}
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1
  }
  return counts
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const bcNoCol = String(formData.get('bcNoCol') || 'B')
    const bcRegisteredCol = String(formData.get('bcRegisteredCol') || 'S')
    const bcSheet = String(formData.get('bcSheet') || '')
    const from = String(formData.get('from') || '')
    const to = String(formData.get('to') || '')
    const persistSession = String(formData.get('persistSession') || '')
    const bcEmployeeId = formData.get('bcEmployeeId')
    const webEmployeeId = formData.get('webEmployeeId')

    const files = formData.getAll('bc_files').filter((f) => f instanceof File) as File[]
    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'Geen bestand(en) ontvangen' }, { status: 400 })
    }

    const noIdx = columnLetterToIndex(bcNoCol)
    const regIdx = columnLetterToIndex(bcRegisteredCol)
    if (noIdx < 0 || regIdx < 0) {
      return NextResponse.json({ success: false, error: 'Ongeldige kolomletters' }, { status: 400 })
    }

    const bcNumbers: string[] = []
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = bcSheet && workbook.Sheets[bcSheet] ? bcSheet : workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const df = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][]
      for (let r = 1; r < df.length; r += 1) {
        const row = df[r] || []
        const noVal = normalizeScanValue(row[noIdx])
        const regVal = row[regIdx]
        if (isTruthy(regVal) && noVal) bcNumbers.push(noVal)
      }
    }

    let scansQuery = supabaseAdmin.from('prepack_scans').select('code')
    if (from) {
      scansQuery = scansQuery.gte('created_at', new Date(from).toISOString())
    }
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      scansQuery = scansQuery.lte('created_at', toDate.toISOString())
    }

    const { data: tabletRows, error: scansError } = await scansQuery
    if (scansError) {
      return NextResponse.json({ success: false, error: 'Database fout' }, { status: 500 })
    }

    const tabletNumbersRaw = (tabletRows || [])
      .map((r: any) => normalizeScanValue(r.code))
      .filter(Boolean) as string[]
    const tabletNumbers = tabletNumbersRaw.map(normalizePacForTablet).filter(Boolean) as string[]

    const bcCounts = countOccurrences(bcNumbers)
    const tabletCounts = countOccurrences(tabletNumbers)
    const bcSet = new Set(Object.keys(bcCounts))
    const tabSet = new Set(Object.keys(tabletCounts))

    const only_in_bc = [...bcSet].filter((k) => !tabSet.has(k)).sort()
    const only_in_tablet = [...tabSet].filter((k) => !bcSet.has(k)).sort()
    const in_both = [...bcSet].filter((k) => tabSet.has(k)).sort()

    const duplicates_bc = Object.keys(bcCounts).filter((k) => bcCounts[k] > 1).sort()
    const duplicates_tablet = Object.keys(tabletCounts).filter((k) => tabletCounts[k] > 1).sort()

    let savedSessionId: number | null = null
    if (persistSession === 'true') {
      const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
      const fmtDate = (d: Date) => {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      }

      const dayVal =
        from && to && from === to && isYmd(from)
          ? from
          : isYmd(from)
          ? from
          : isYmd(to)
          ? to
          : fmtDate(new Date())

      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('prepack_sessions')
        .insert({
          day: dayVal,
          bc_employee_id: bcEmployeeId ? Number(bcEmployeeId) : null,
          web_employee_id: webEmployeeId ? Number(webEmployeeId) : null,
          bc_total: bcNumbers.length,
          web_total: tabletNumbers.length,
          only_in_bc: only_in_bc.length,
          only_in_web: only_in_tablet.length,
        })
        .select()
        .single()

      if (!sessionError && sessionData) {
        savedSessionId = sessionData.id
        const diffs = [
          ...only_in_bc.map((pac) => ({ session_id: savedSessionId, pac, side: 'BC_ONLY' })),
          ...only_in_tablet.map((pac) => ({ session_id: savedSessionId, pac, side: 'WEB_ONLY' })),
          ...in_both.map((pac) => ({ session_id: savedSessionId, pac, side: 'MATCH' })),
        ]
        if (diffs.length > 0) {
          await supabaseAdmin.from('prepack_session_diffs').insert(diffs)
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        bc_total: bcNumbers.length,
        tablet_total: tabletNumbers.length,
        only_in_bc: only_in_bc.length,
        only_in_tablet: only_in_tablet.length,
        matched_unique: in_both.length,
      },
      session_id: savedSessionId,
      bc_counts: bcCounts,
      tablet_counts: tabletCounts,
      only_in_bc,
      only_in_tablet,
      in_both,
      duplicates_bc,
      duplicates_tablet,
    })
  } catch (error) {
    console.error('compare-bc error:', error)
    return NextResponse.json({ success: false, error: 'Serverfout bij vergelijken' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  buildMailLinkComment,
  parseDroppedMailFile,
} from '@/lib/grote-inpak/parse-dropped-mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const caseLabel = String(formData.get('case_label') || '').trim()
    const file = formData.get('file')

    if (!caseLabel) {
      return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Sleep een .eml of .msg bestand vanuit Outlook op de rij.' },
        { status: 400 }
      )
    }

    const name = file.name || 'mail.msg'
    const lower = name.toLowerCase()
    if (!lower.endsWith('.eml') && !lower.endsWith('.msg')) {
      return NextResponse.json(
        { error: 'Alleen Outlook .eml of .msg bestanden worden ondersteund.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseDroppedMailFile(buffer, name)

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, atlas_planner_email, comment')
      .eq('case_label', caseLabel)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      return NextResponse.json(
        { error: `Caselabel ${caseLabel} niet gevonden in PILS-overzicht` },
        { status: 404 }
      )
    }

    const atlas_planner_email = parsed.fromEmail || existing.atlas_planner_email || null
    const comment = buildMailLinkComment(parsed, existing.comment)

    const { data, error: updateError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .update({ atlas_planner_email, comment })
      .eq('case_label', caseLabel)
      .select('case_label, atlas_planner_email, comment')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      data,
      summary: `Mail gekoppeld aan ${caseLabel}${atlas_planner_email ? ` (${atlas_planner_email})` : ''}`,
      parsed: {
        subject: parsed.subject,
        fromEmail: parsed.fromEmail,
        sourceFilename: parsed.sourceFilename,
      },
    })
  } catch (error: unknown) {
    console.error('case-mail-drop:', error)
    const message = error instanceof Error ? error.message : 'Mail koppelen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

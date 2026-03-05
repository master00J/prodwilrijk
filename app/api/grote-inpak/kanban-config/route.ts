import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .select('*')
      .eq('actief', true)
      .order('rek_sectie', { ascending: true })
      .order('rek_niveau', { ascending: false })
      .order('rek_kolom', { ascending: true })

    if (error) throw error
    // Kanban Rekken is alleen voor C kisten
    const filtered = (data || []).filter((row: any) =>
      String(row.case_type || '').trim().toUpperCase().startsWith('C')
    )
    return NextResponse.json({ data: filtered })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, stapels_per_pos, verbruik_per_dag, prioriteit, notitie } = body

    if (!case_type) return NextResponse.json({ error: 'case_type is verplicht' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .upsert({
        case_type: normalizeKistnummer(case_type),
        rek_sectie: rek_sectie || null,
        rek_niveau: rek_niveau || null,
        rek_kolom: rek_kolom || null,
        productielocatie: productielocatie || null,
        stapel: stapel || 1,
        posities: posities || 1,
        stapels_per_pos: stapels_per_pos || 2,
        verbruik_per_dag: verbruik_per_dag || null,
        prioriteit: prioriteit || null,
        notitie: notitie || null,
        actief: true,
      }, { onConflict: 'case_type' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .update({ actief: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

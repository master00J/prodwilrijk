import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const controleId = Number(params.id)
    if (!Number.isFinite(controleId)) {
      return NextResponse.json({ error: 'Invalid controle ID' }, { status: 400 })
    }

    const { data: controle, error: controleError } = await supabaseAdmin
      .from('product_controles')
      .select('*, checklist_templates(naam)')
      .eq('id', controleId)
      .single()

    if (controleError || !controle) {
      return NextResponse.json({ error: 'Controle not found' }, { status: 404 })
    }

    const { data: checklistItems, error: checklistError } = await supabaseAdmin
      .from('controle_checklist_items')
      .select(
        'id, template_item_id, item_beschrijving, antwoord_waarde, opmerking_bij_antwoord, checklist_template_items(item_type, hulptekst, volgorde)'
      )
      .eq('controle_id', controleId)

    if (checklistError) {
      console.error('Error fetching checklist items:', checklistError)
      return NextResponse.json({ error: 'Failed to fetch checklist items' }, { status: 500 })
    }

    const sortedChecklist = (checklistItems || []).sort((a: any, b: any) => {
      const aOrder = a.checklist_template_items?.volgorde ?? 99999
      const bOrder = b.checklist_template_items?.volgorde ?? 99999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.id || 0) - (b.id || 0)
    })

    const { data: fotos, error: fotosError } = await supabaseAdmin
      .from('controle_fotos')
      .select('id, bestandsnaam, image_url, upload_datum')
      .eq('controle_id', controleId)
      .order('upload_datum', { ascending: true })

    if (fotosError) {
      console.error('Error fetching controle fotos:', fotosError)
      return NextResponse.json({ error: 'Failed to fetch controle fotos' }, { status: 500 })
    }

    return NextResponse.json({
      details: {
        ...controle,
        checklist_template_naam: controle.checklist_templates?.naam || null,
      },
      checklist: sortedChecklist,
      fotos: fotos || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const templateId = Number(params.templateId)
    if (!Number.isFinite(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('checklist_template_items')
      .select('id, item_beschrijving, item_type, volgorde, is_verplicht, hulptekst')
      .eq('template_id', templateId)
      .order('volgorde', { ascending: true })
      .order('id', { ascending: true })

    if (itemsError) {
      console.error('Error fetching template items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch template items' }, { status: 500 })
    }

    return NextResponse.json({ ...template, items: items || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const templateId = Number(params.templateId)
    if (!Number.isFinite(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
    }

    const body = await request.json()
    const naam = String(body?.naam || '').trim()
    const afdeling = body?.afdeling ? String(body.afdeling).trim() : null
    const beschrijving = body?.beschrijving ? String(body.beschrijving).trim() : null
    const isActief = body?.is_actief !== undefined ? Boolean(body.is_actief) : true
    const items = Array.isArray(body?.items) ? body.items : []

    if (!naam) {
      return NextResponse.json({ error: 'Naam van de template is verplicht.' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('checklist_templates')
      .update({
        naam,
        afdeling,
        beschrijving,
        is_actief: isActief,
        laatst_gewijzigd_op: new Date().toISOString(),
      })
      .eq('id', templateId)

    if (updateError) {
      console.error('Error updating template:', updateError)
      return NextResponse.json({ error: 'Kon checklist template niet bijwerken.' }, { status: 500 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('checklist_template_items')
      .delete()
      .eq('template_id', templateId)

    if (deleteError) {
      console.error('Error clearing template items:', deleteError)
      return NextResponse.json({ error: 'Kon checklist items niet bijwerken.' }, { status: 500 })
    }

    if (items.length > 0) {
      const templateItems = items.map((item: any, index: number) => ({
        template_id: templateId,
        item_beschrijving: String(item.item_beschrijving || '').trim(),
        item_type: item.item_type || 'ok/niet ok/n.v.t.',
        volgorde: item.volgorde !== undefined ? Number(item.volgorde) : index,
        is_verplicht: item.is_verplicht !== undefined ? Boolean(item.is_verplicht) : false,
        hulptekst: item.hulptekst ? String(item.hulptekst).trim() : null,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('checklist_template_items')
        .insert(templateItems)

      if (itemsError) {
        console.error('Error inserting template items:', itemsError)
        return NextResponse.json({ error: 'Kon checklist items niet bijwerken.' }, { status: 500 })
      }
    }

    return NextResponse.json({ message: 'Checklist template succesvol bijgewerkt.', templateId })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const templateId = Number(params.templateId)
    if (!Number.isFinite(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
    }

    const { error: deleteItemsError } = await supabaseAdmin
      .from('checklist_template_items')
      .delete()
      .eq('template_id', templateId)

    if (deleteItemsError) {
      console.error('Error deleting template items:', deleteItemsError)
      return NextResponse.json({ error: 'Kon checklist items niet verwijderen.' }, { status: 500 })
    }

    const { error: deleteTemplateError } = await supabaseAdmin
      .from('checklist_templates')
      .delete()
      .eq('id', templateId)

    if (deleteTemplateError) {
      console.error('Error deleting template:', deleteTemplateError)
      return NextResponse.json({ error: 'Kon checklist template niet verwijderen.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Checklist template succesvol verwijderd.' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

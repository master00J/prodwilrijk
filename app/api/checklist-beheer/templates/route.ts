import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const afdeling = searchParams.get('afdeling')
    const includeItemCount = searchParams.get('include_item_count') === 'true'

    let query = supabaseAdmin
      .from('checklist_templates')
      .select(includeItemCount ? 'id, naam, afdeling, beschrijving, is_actief, aangemaakt_op, laatst_gewijzigd_op, checklist_template_items(count)' : '*')
      .order('naam', { ascending: true })

    if (afdeling) {
      query = query.or(`afdeling.eq.${afdeling},afdeling.is.null`)
    } else {
      query = query.eq('is_actief', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching checklist templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const naam = String(body?.naam || '').trim()
    const afdeling = body?.afdeling ? String(body.afdeling).trim() : null
    const beschrijving = body?.beschrijving ? String(body.beschrijving).trim() : null
    const isActief = body?.is_actief !== undefined ? Boolean(body.is_actief) : true
    const items = Array.isArray(body?.items) ? body.items : []

    if (!naam) {
      return NextResponse.json({ error: 'Naam van de template is verplicht.' }, { status: 400 })
    }

    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('checklist_templates')
      .insert({
        naam,
        afdeling,
        beschrijving,
        is_actief: isActief,
      })
      .select('id')
      .single()

    if (templateError || !templateData) {
      console.error('Error creating template:', templateError)
      return NextResponse.json({ error: 'Kon checklist template niet aanmaken.' }, { status: 500 })
    }

    if (items.length > 0) {
      const templateItems = items.map((item: any, index: number) => ({
        template_id: templateData.id,
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
        console.error('Error creating template items:', itemsError)
        return NextResponse.json({ error: 'Kon checklist items niet aanmaken.' }, { status: 500 })
      }
    }

    return NextResponse.json({ message: 'Checklist template succesvol aangemaakt.', templateId: templateData.id })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

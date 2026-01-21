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

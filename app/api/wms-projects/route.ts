import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    let query = supabaseAdmin
      .from('wms_projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(
        `project_no.ilike.%${search}%,machine_type.ilike.%${search}%,vmi_ref_no.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching WMS projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    const response = NextResponse.json({ projects: data || [] })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error fetching WMS projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

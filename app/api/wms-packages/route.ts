import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id,
      package_no,
      received_at,
      load_in_at,
      load_out_at,
      storage_location,
      storage_m2,
    } = body || {}

    if (!project_id || !package_no) {
      return NextResponse.json({ error: 'project_id en package_no zijn verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('wms_packages')
      .insert({
        project_id,
        package_no,
        received_at: received_at || null,
        load_in_at: load_in_at || null,
        load_out_at: load_out_at || null,
        storage_location: storage_location || null,
        storage_m2: storage_m2 ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating WMS package:', error)
      return NextResponse.json({ error: 'Pakket aanmaken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ package: data })
  } catch (error) {
    console.error('Unexpected error creating WMS package:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('project_id')

    let query = supabaseAdmin.from('wms_packages').select('*').order('created_at', { ascending: false })
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching WMS packages:', error)
      return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
    }

    const response = NextResponse.json({ packages: data || [] })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error fetching WMS packages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, package_no } = body || {}

    if (!project_id || !package_no) {
      return NextResponse.json({ error: 'project_id and package_no are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('wms_packages')
      .insert({ project_id, package_no })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating WMS package:', error)
      return NextResponse.json({ error: 'Failed to create package' }, { status: 500 })
    }

    return NextResponse.json({ success: true, package: data })
  } catch (error) {
    console.error('Unexpected error creating WMS package:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeSites } from '@/lib/sites'
import { withAdmin, withAuth } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = supabaseAdmin
      .from('employees')
      .select('*')
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching employees:', error)
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { name, active = true, sites } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({
        name: name.trim(),
        active: active !== undefined ? active : true,
        sites: normalizeSites(sites),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating employee:', error)
      return NextResponse.json(
        { error: 'Failed to create employee' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      employee: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id, name, active, sites } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }
    if (active !== undefined) {
      updateData.active = active
    }
    if (sites !== undefined) {
      updateData.sites = normalizeSites(sites)
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating employee:', error)
      return NextResponse.json(
        { error: 'Failed to update employee' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      employee: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting employee:', error)
      return NextResponse.json(
        { error: 'Failed to delete employee' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})



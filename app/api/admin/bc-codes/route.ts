import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = withAdmin(async (_request, _user) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bc_codes')
      .select('*')
      .order('houtsoort', { ascending: true })
      .order('dikte', { ascending: true })
      .order('breedte', { ascending: true })

    if (error) {
      console.error('Error fetching BC codes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch BC codes' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

export const POST = withAdmin(async (request, _user) => {
  try {
    const body = await request.json()
    const { breedte, dikte, houtsoort, bc_code } = body

    if (!breedte || !dikte || !houtsoort || !bc_code) {
      return NextResponse.json(
        { error: 'Missing required fields: breedte, dikte, houtsoort, bc_code' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('bc_codes')
      .insert({
        breedte: parseInt(breedte),
        dikte: parseInt(dikte),
        houtsoort: houtsoort.trim(),
        bc_code: bc_code.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating BC code:', error)
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'BC code already exists for this combination of breedte, dikte, and houtsoort' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create BC code', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

export const PUT = withAdmin(async (request, _user) => {
  try {
    const body = await request.json()
    const { id, breedte, dikte, houtsoort, bc_code } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (breedte !== undefined) updateData.breedte = parseInt(breedte)
    if (dikte !== undefined) updateData.dikte = parseInt(dikte)
    if (houtsoort !== undefined) updateData.houtsoort = houtsoort.trim()
    if (bc_code !== undefined) updateData.bc_code = bc_code.trim()

    const { data, error } = await supabaseAdmin
      .from('bc_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating BC code:', error)
      return NextResponse.json(
        { error: 'Failed to update BC code', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

export const DELETE = withAdmin(async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('bc_codes')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      console.error('Error deleting BC code:', error)
      return NextResponse.json(
        { error: 'Failed to delete BC code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})


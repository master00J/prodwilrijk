import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Get all target stock entries
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('wood_target_stock')
      .select('*')
      .order('houtsoort', { ascending: true })
      .order('dikte', { ascending: true })
      .order('breedte', { ascending: true })

    if (error) {
      console.error('Error fetching target stock:', error)
      return NextResponse.json(
        { error: 'Failed to fetch target stock' },
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
}

// POST - Create new target stock entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { houtsoort, dikte, breedte, target_packs, desired_length } = body

    if (!houtsoort || !dikte || !breedte || target_packs === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: houtsoort, dikte, breedte, target_packs' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('wood_target_stock')
      .insert({
        houtsoort: houtsoort.trim(),
        dikte: parseFloat(dikte),
        breedte: parseFloat(breedte),
        target_packs: parseInt(target_packs),
        desired_length: desired_length ? parseInt(desired_length) : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating target stock:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Target stock already exists for this combination' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create target stock', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update target stock entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.houtsoort !== undefined) updateData.houtsoort = updates.houtsoort.trim()
    if (updates.dikte !== undefined) updateData.dikte = parseFloat(updates.dikte)
    if (updates.breedte !== undefined) updateData.breedte = parseFloat(updates.breedte)
    if (updates.target_packs !== undefined) updateData.target_packs = parseInt(updates.target_packs)
    if (updates.desired_length !== undefined) updateData.desired_length = updates.desired_length ? parseInt(updates.desired_length) : null

    const { data, error } = await supabaseAdmin
      .from('wood_target_stock')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating target stock:', error)
      return NextResponse.json(
        { error: 'Failed to update target stock', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete target stock entry
export async function DELETE(request: NextRequest) {
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
      .from('wood_target_stock')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      console.error('Error deleting target stock:', error)
      return NextResponse.json(
        { error: 'Failed to delete target stock' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, problem, problem_comment } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input. Expected array of IDs.' },
        { status: 400 }
      )
    }

    if (typeof problem !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid input. Expected boolean for problem field.' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: { problem: boolean; problem_comment?: string | null } = { problem }
    
    // If problem_comment is provided, include it in the update
    if (problem_comment !== undefined) {
      updateData.problem_comment = problem_comment || null
    } else if (problem === false) {
      // If removing problem status, also clear the comment
      updateData.problem_comment = null
    }

    const { error } = await supabaseAdmin
      .from('items_to_pack')
      .update(updateData)
      .in('id', ids)

    if (error) {
      console.error('Error updating problem status:', error)
      return NextResponse.json(
        { error: 'Failed to update problem status' },
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

// PATCH endpoint for updating problem comment for a single item
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, problem_comment } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('items_to_pack')
      .update({ problem_comment: problem_comment || null })
      .eq('id', id)

    if (error) {
      console.error('Error updating problem comment:', error)
      return NextResponse.json(
        { error: 'Failed to update problem comment' },
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


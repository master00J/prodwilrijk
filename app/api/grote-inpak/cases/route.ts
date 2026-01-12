import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get('location')
    const status = searchParams.get('status')
    const inWillebroek = searchParams.get('in_willebroek')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')

    let query = supabaseAdmin
      .from('grote_inpak_cases')
      .select('*')
      .order('arrival_date', { ascending: true, nullsFirst: false })

    // Apply filters
    if (location && location !== 'Alle') {
      query = query.eq('productielocatie', location)
    }

    if (status && status !== 'Alle') {
      query = query.eq('status', status)
    }

    if (inWillebroek === 'true') {
      query = query.eq('in_willebroek', true)
    } else if (inWillebroek === 'false') {
      query = query.eq('in_willebroek', false)
    }

    if (priority === 'true') {
      query = query.eq('priority', true)
    } else if (priority === 'false') {
      query = query.eq('priority', false)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Apply search filter in memory (can be optimized with database search)
    let filteredData = data || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter((item: any) => {
        return (
          item.case_label?.toLowerCase().includes(searchLower) ||
          item.case_type?.toLowerCase().includes(searchLower) ||
          item.item_number?.toLowerCase().includes(searchLower) ||
          item.stock_location?.toLowerCase().includes(searchLower) ||
          item.comment?.toLowerCase().includes(searchLower)
        )
      })
    }

    return NextResponse.json({ data: filteredData, count: filteredData.length })
  } catch (error: any) {
    console.error('Error fetching cases:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching cases' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { case_label, updates } = body

    if (!case_label || !updates) {
      return NextResponse.json(
        { error: 'case_label and updates are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .update(updates)
      .eq('case_label', case_label)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating case:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating case' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body // Array of { case_label, ...updates }

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates must be an array' },
        { status: 400 }
      )
    }

    // Update multiple cases
    const promises = updates.map((item: any) => {
      const { case_label, ...caseUpdates } = item
      return supabaseAdmin
        .from('grote_inpak_cases')
        .update(caseUpdates)
        .eq('case_label', case_label)
    })

    await Promise.all(promises)

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error: any) {
    console.error('Error bulk updating cases:', error)
    return NextResponse.json(
      { error: error.message || 'Error bulk updating cases' },
      { status: 500 }
    )
  }
}


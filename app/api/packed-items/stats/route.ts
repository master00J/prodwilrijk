import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    let query = supabaseAdmin.from('packed_items').select('*')

    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      query = query.gte('date_packed', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte('date_packed', toDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      )
    }

    const items = data || []

    // Calculate statistics
    const totalPacked = items.reduce((sum, item) => sum + (item.amount || 0), 0)

    let averagePerDay = 0
    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom)
      const toDate = new Date(dateTo)
      const daysDiff = Math.ceil(
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
      averagePerDay = daysDiff > 0 ? totalPacked / daysDiff : 0
    } else if (items.length > 0) {
      // Calculate overall average
      const firstDate = new Date(items[items.length - 1].date_packed)
      const lastDate = new Date(items[0].date_packed)
      const daysDiff =
        Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      averagePerDay = daysDiff > 0 ? totalPacked / daysDiff : 0
    }

    // Calculate average stay duration
    let totalStayDuration = 0
    let count = 0
    items.forEach((item) => {
      const dateAdded = new Date(item.date_added)
      const datePacked = new Date(item.date_packed)
      const stayDuration = Math.ceil(
        (datePacked.getTime() - dateAdded.getTime()) / (1000 * 60 * 60 * 24)
      )
      totalStayDuration += stayDuration
      count++
    })

    const averageStayDuration = count > 0 ? totalStayDuration / count : 0

    return NextResponse.json({
      totalPacked,
      averagePerDay,
      averageStayDuration,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


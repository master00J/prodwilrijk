import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isOlderThanWorkingDays } from '@/lib/utils/workdays'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      )
    }

    const selectedDate = new Date(date)
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Get items as of the selected date
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items_to_pack')
      .select('*')
      .lte('date_added', endOfDay.toISOString())

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    // Get packed items for the selected date
    const { data: packedItems, error: packedError } = await supabaseAdmin
      .from('packed_items')
      .select('*')
      .gte('date_packed', startOfDay.toISOString())
      .lte('date_packed', endOfDay.toISOString())

    if (packedError) {
      console.error('Error fetching packed items:', packedError)
      return NextResponse.json(
        { error: 'Failed to fetch packed items' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const totalQuantity = items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    const priorityQuantity = items?.filter(item => item.priority).reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    const packedQuantity = packedItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0

    const referenceDate = new Date(selectedDate)
    referenceDate.setHours(0, 0, 0, 0)
    
    const backlogQuantity = items?.filter(item => {
      if (item.packed) return false
      const itemDate = new Date(item.date_added)
      itemDate.setHours(0, 0, 0, 0)
      // Backlog = items older than 3 working days
      return isOlderThanWorkingDays(itemDate, referenceDate, 3)
    }).reduce((sum, item) => sum + (item.amount || 0), 0) || 0

    // Generate recommendations
    const recommendations: string[] = []
    if (backlogQuantity > totalQuantity * 0.3) {
      recommendations.push('Backlog is high (>30%). Consider additional capacity.')
    }
    if (priorityQuantity > 0) {
      recommendations.push(`${priorityQuantity} priority items require immediate attention.`)
    }
    if (backlogQuantity === 0) {
      recommendations.push('Excellent! No backlog in packing.')
    }
    if (recommendations.length === 0) {
      recommendations.push('Packing is proceeding according to plan.')
    }

    return NextResponse.json({
      date,
      totalQuantity,
      backlogQuantity,
      priorityQuantity,
      packedQuantity,
      recommendations,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


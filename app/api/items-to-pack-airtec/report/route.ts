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

    const endOfDayIso = endOfDay.toISOString()
    const startOfDayIso = startOfDay.toISOString()

    const { data: itemsInQueue, error: itemsError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .select('quantity, datum_ontvangen, priority')
      .lte('datum_ontvangen', endOfDayIso)

    if (itemsError) {
      console.error('Error fetching items_to_pack_airtec:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    const { data: packedItems, error: packedError } = await supabaseAdmin
      .from('packed_items_airtec')
      .select('quantity, datum_ontvangen, date_packed')
      .gte('date_packed', startOfDayIso)
      .lte('date_packed', endOfDayIso)

    if (packedError) {
      console.error('Error fetching packed_items_airtec:', packedError)
      return NextResponse.json(
        { error: 'Failed to fetch packed items' },
        { status: 500 }
      )
    }

    const { data: packedAllByDate, error: packedAllError } = await supabaseAdmin
      .from('packed_items_airtec')
      .select('quantity, datum_ontvangen')
      .lte('datum_ontvangen', endOfDayIso)

    if (packedAllError) {
      console.error('Error fetching packed_items_airtec for total:', packedAllError)
    }

    const totalQuantity =
      (itemsInQueue?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0) +
      (packedAllByDate?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0)

    const priorityQuantity =
      itemsInQueue?.filter((item) => item.priority).reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

    const packedQuantity =
      packedItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

    const referenceDate = new Date(selectedDate)
    referenceDate.setHours(0, 0, 0, 0)

    const backlogQuantity =
      itemsInQueue
        ?.filter((item) => {
          const itemDate = new Date(item.datum_ontvangen)
          itemDate.setHours(0, 0, 0, 0)
          return isOlderThanWorkingDays(itemDate, referenceDate, 3)
        })
        .reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

    const recommendations: string[] = []
    if (totalQuantity > 0 && backlogQuantity > totalQuantity * 0.3) {
      recommendations.push('Backlog is high (>30%). Consider additional capacity.')
    }
    if (priorityQuantity > 0) {
      recommendations.push(`${priorityQuantity} priority items require immediate attention.`)
    }
    if (backlogQuantity === 0 && totalQuantity >= 0) {
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

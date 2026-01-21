import { NextRequest, NextResponse } from 'next/server'
import { fetchAirtecStats } from '@/lib/airtec/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    const stats = await fetchAirtecStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })

    return NextResponse.json({
      dailyStats: stats.dailyStats,
      totals: stats.totals,
      personStats: stats.personStats,
      detailedItems: stats.detailedItems,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

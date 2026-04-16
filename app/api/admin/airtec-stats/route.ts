import { NextRequest, NextResponse } from 'next/server'
import { fetchAirtecStats } from '@/lib/airtec/stats'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async (request, _user) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const includeDetails = searchParams.get('include_details') !== 'false'

    const stats = await fetchAirtecStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      includeDetails,
    })

    return NextResponse.json({
      dailyStats: stats.dailyStats,
      totals: stats.totals,
      personStats: stats.personStats,
      detailedItems: stats.detailedItems,
      detailsLimited: stats.detailsLimited,
    })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

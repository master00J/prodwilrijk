import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async (request, _user) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const includeDetails = searchParams.get('include_details') !== 'false'
    const data = await fetchPrepackStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      includeDetails,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('prepack-stats error:', error)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      { error: 'Server error', message },
      { status: 500 }
    )
  }
})





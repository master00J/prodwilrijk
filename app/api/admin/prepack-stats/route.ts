import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const data = await fetchPrepackStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





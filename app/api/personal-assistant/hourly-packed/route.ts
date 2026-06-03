import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/api/log-error'
import {
  buildHourlyPackedAnnouncement,
  getHourlyPackedSchedule,
} from '@/lib/personal-assistant/hourly-packed'

export const dynamic = 'force-dynamic'

/** Live cijfers + uurlijkse-meldingsinstelling voor de mobiele app. */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const [announcement, schedule] = await Promise.all([
      buildHourlyPackedAnnouncement(),
      getHourlyPackedSchedule(userId),
    ])

    return NextResponse.json({
      ...announcement,
      schedule,
    })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/personal-assistant/hourly-packed',
      method: 'GET',
      userId: request.headers.get('x-user-id'),
    })
    const message = error instanceof Error ? error.message : 'Uurupdate mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

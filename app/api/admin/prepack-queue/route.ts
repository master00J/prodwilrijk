import { NextResponse } from 'next/server'
import { fetchPrepackQueueStats } from '@/lib/prepack/queue-stats'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async () => {
  try {
    const data = await fetchPrepackQueueStats()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/with-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function getImportSecret(): string | null {
  return (
    process.env.GROTE_INPAK_PACKED_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET ||
    null
  )
}

export const POST = withAdmin(async (request: NextRequest) => {
  const secret = getImportSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Packed mail import secret ontbreekt.' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const includeSeen = body?.includeSeen === true
  const date = typeof body?.date === 'string' ? body.date : null

  const url = new URL('/api/grote-inpak/packed-mail-import', request.nextUrl.origin)
  if (includeSeen) url.searchParams.set('includeSeen', 'true')
  if (date) url.searchParams.set('date', date)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json(
      { error: result?.error || 'Packed mail scan mislukt.' },
      { status: response.status }
    )
  }

  return NextResponse.json(result)
})

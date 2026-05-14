import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/with-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getImportSecret(): string | null {
  return (
    process.env.LUMIPAPER_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_FORECAST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_KIST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET ||
    null
  )
}

export const POST = withAdmin(async (request: NextRequest) => {
  const secret = getImportSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Geen mail-import secret geconfigureerd.' }, { status: 500 })
  }

  const url = new URL('/api/lumipaper/mail-import', request.nextUrl.origin)
  url.searchParams.set('sinceDaysAgo', request.nextUrl.searchParams.get('sinceDaysAgo') || '2')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error || 'Mailbox scan mislukt.' },
      { status: response.status }
    )
  }

  return NextResponse.json(data)
})

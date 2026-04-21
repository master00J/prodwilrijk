import { NextRequest, NextResponse } from 'next/server'
import { parseForescoPdf } from '@/lib/wood/parse-foresco-pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { pdf?: string }
    const { pdf } = body
    if (!pdf) {
      return NextResponse.json({ error: 'pdf (base64) is verplicht' }, { status: 400 })
    }

    const approxBytes = Math.floor((pdf.length * 3) / 4)
    if (approxBytes > 30 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'PDF is te groot (>30 MB). Splits het document of verlaag de scanresolutie.' },
        { status: 413 }
      )
    }

    const packages = await parseForescoPdf(pdf)
    return NextResponse.json({ packages })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF-scan mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { extractStockCountLabelsFromPdf } from '@/lib/stock-count/extract-label'

export const dynamic = 'force-dynamic'
// PDF's zijn groter dan foto's — stel een wat ruimere body-limiet in.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { pdf?: string }
    const { pdf } = body
    if (!pdf) {
      return NextResponse.json({ error: 'pdf (base64) is verplicht' }, { status: 400 })
    }

    // Ruwe schatting: 1 char base64 ≈ 0.75 byte. Anthropic limiet ≈ 32 MB per PDF.
    const approxBytes = Math.floor((pdf.length * 3) / 4)
    if (approxBytes > 30 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'PDF is te groot (>30 MB). Splits het document of verlaag de scanresolutie.' },
        { status: 413 }
      )
    }

    const labels = await extractStockCountLabelsFromPdf(pdf)
    return NextResponse.json({ labels })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF-scan mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { extractStockCountLabel } from '@/lib/stock-count/extract-label'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { image?: string; mediaType?: string }
    const { image, mediaType } = body
    if (!image || !mediaType) {
      return NextResponse.json({ error: 'image en mediaType zijn verplicht' }, { status: 400 })
    }
    const label = await extractStockCountLabel(image, mediaType)
    return NextResponse.json({ label })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scan mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

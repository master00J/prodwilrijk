import 'pdf-parse/worker'
import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { callOpenAIVision } from '@/lib/labels/openai-vision'
import { extractCnhFieldsFromText, mergeCnhExtractResults } from '@/lib/cnh/extract-pdf-fields'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

const MAX_PDF_BYTES = 10 * 1024 * 1024

const CNH_VISION_PROMPT = `Analyze this CNH / Foresco shipping or packing list document image (may be in Dutch).

Extract:
1. shippingNote — reference number near "NR", "verzendnota", or a code like "C2526051811250". Prefer 5-7 digit numbers starting with 1 (e.g. 138197). Use null if not visible.
2. motorNumbers — 6-digit part numbers ("Stuknummer" column), e.g. 253226, 253365. Exclude the shippingNote. Keep top-to-bottom order.

Return ONLY valid JSON:
{"shippingNote":"138197"|null,"motorNumbers":["253226","253365"]}`

type VisionPayload = {
  shippingNote?: string | null
  motorNumbers?: string[]
}

function normalizeVisionPayload(raw: unknown): VisionPayload {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  const shippingNote =
    typeof obj.shippingNote === 'string' && obj.shippingNote.trim()
      ? obj.shippingNote.trim()
      : obj.shippingNote === null
        ? null
        : undefined

  const motorNumbers = Array.isArray(obj.motorNumbers)
    ? obj.motorNumbers
        .map((v) => (typeof v === 'string' ? v.replace(/\D/g, '') : String(v ?? '').replace(/\D/g, '')))
        .filter((v) => v.length >= 5 && v.length <= 7)
    : []

  return { shippingNote, motorNumbers }
}

// POST /api/cnh/parse-pdf-ai — tekst + OpenAI Vision voor gescande CNH-PDF's
export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY niet geconfigureerd', useClientOcr: true },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF is te groot. Maximum is 10 MB.' }, { status: 413 })
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Alleen PDF bestanden zijn toegestaan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })

    try {
      let text = ''
      try {
        const pdfData = await parser.getText()
        text = pdfData.text || ''
      } catch {
        text = ''
      }

      if (text.trim().length >= 50) {
        const fromText = extractCnhFieldsFromText(text)
        if (fromText.motorNumbers.length > 0) {
          return NextResponse.json({
            success: true,
            method: 'text',
            shippingNote: fromText.shippingNote,
            motorNumbers: fromText.motorNumbers,
            totalMotors: fromText.motorNumbers.length,
          })
        }
      }

      const screenshots = await parser.getScreenshot({ scale: 2, first: 4 })
      const pageResults = []

      for (const page of screenshots.pages) {
        const imageData = page.data
        if (!imageData || (!(imageData instanceof Uint8Array) && !Buffer.isBuffer(imageData))) {
          continue
        }
        const base64 = Buffer.from(imageData).toString('base64')
        const raw = await callOpenAIVision(CNH_VISION_PROMPT, base64, 'image/png')
        const parsed = normalizeVisionPayload(raw)
        pageResults.push({
          shippingNote: parsed.shippingNote ?? null,
          motorNumbers: parsed.motorNumbers || [],
        })
      }

      const merged = mergeCnhExtractResults(pageResults)

      if (merged.motorNumbers.length === 0) {
        return NextResponse.json(
          {
            error: 'Geen motornummers gevonden via AI. Probeer opnieuw of gebruik handmatige invoer.',
            useClientOcr: true,
          },
          { status: 422 }
        )
      }

      return NextResponse.json({
        success: true,
        method: 'ai',
        shippingNote: merged.shippingNote,
        motorNumbers: merged.motorNumbers,
        totalMotors: merged.motorNumbers.length,
      })
    } finally {
      await parser.destroy()
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('CNH parse-pdf-ai error:', error)
    return NextResponse.json(
      { error: `AI PDF-analyse mislukt: ${message}`, useClientOcr: true },
      { status: 500 }
    )
  }
}

import 'pdf-parse/worker'
import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { extractCnhFieldsFromText } from '@/lib/cnh/extract-pdf-fields'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const MAX_PDF_BYTES = 10 * 1024 * 1024

// POST /api/cnh/parse-pdf - Parse PDF and extract motor numbers and shipping note
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand geüpload' },
        { status: 400 }
      )
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF is te groot. Maximum is 10 MB.' },
        { status: 413 }
      )
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Alleen PDF bestanden zijn toegestaan' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let text = ''
    try {
      const parser = new PDFParse({ data: buffer })
      try {
        const pdfData = await parser.getText()
        text = pdfData.text
      } finally {
        await parser.destroy()
      }
    } catch {
      return NextResponse.json(
        {
          error: 'Dit PDF bestand lijkt gescand te zijn. Probeer opnieuw — AI/OCR wordt automatisch gebruikt.',
          isScanned: true,
        },
        { status: 400 }
      )
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        {
          error: 'Geen selecteerbare tekst in PDF. AI/OCR wordt automatisch gebruikt.',
          isScanned: true,
        },
        { status: 400 }
      )
    }

    const { shippingNote, motorNumbers } = extractCnhFieldsFromText(text)

    return NextResponse.json({
      success: true,
      shippingNote,
      motorNumbers,
      rawText: text.substring(0, 5000),
      totalMotors: motorNumbers.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error parsing PDF:', error)
    return NextResponse.json(
      { error: 'Fout bij het lezen van PDF: ' + message },
      { status: 500 }
    )
  }
}

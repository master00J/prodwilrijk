import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    // Check if it's a PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Alleen PDF bestanden zijn toegestaan' },
        { status: 400 }
      )
    }

    // Read PDF file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse PDF
    const pdfData = await pdfParse(buffer)

    // Extract text from PDF
    const text = pdfData.text

    // Parse the text to extract motor numbers and shipping note
    // This is a basic parser - you may need to adjust based on the actual PDF format
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

    // Try to find shipping note (common patterns: "Verzendnota", "Shipping Note", "Note:", etc.)
    let shippingNote = ''
    const shippingNotePatterns = [
      /verzendnota[:\s]+([^\n]+)/i,
      /shipping\s*note[:\s]+([^\n]+)/i,
      /note[:\s]+([^\n]+)/i,
      /ref[:\s]+([^\n]+)/i,
      /reference[:\s]+([^\n]+)/i,
    ]

    for (const pattern of shippingNotePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        shippingNote = match[1].trim()
        break
      }
    }

    // Extract motor numbers - common patterns
    const motorNumbers: string[] = []
    
    // Pattern 1: Look for lines that look like motor numbers (e.g., alphanumeric codes)
    // Common patterns: alphanumeric codes, numbers with letters, etc.
    const motorPatterns = [
      /^[A-Z0-9]{4,20}$/, // Alphanumeric codes (4-20 chars)
      /^[0-9]{6,12}$/, // Numeric codes (6-12 digits)
      /^[A-Z]{2,4}[0-9]{4,12}$/, // Letter prefix + numbers
    ]

    for (const line of lines) {
      // Skip lines that are clearly headers/labels
      if (
        line.toLowerCase().includes('motor') ||
        line.toLowerCase().includes('nummer') ||
        line.toLowerCase().includes('number') ||
        line.toLowerCase().includes('verzendnota') ||
        line.toLowerCase().includes('shipping') ||
        line.toLowerCase().includes('note') ||
        line.toLowerCase().includes('ref') ||
        line.toLowerCase().includes('datum') ||
        line.toLowerCase().includes('date') ||
        line.length < 4 ||
        line.length > 30
      ) {
        continue
      }

      // Check if line matches motor number pattern
      for (const pattern of motorPatterns) {
        if (pattern.test(line)) {
          motorNumbers.push(line)
          break
        }
      }
    }

    // Remove duplicates
    const uniqueMotorNumbers = [...new Set(motorNumbers)]

    return NextResponse.json({
      success: true,
      shippingNote: shippingNote || null,
      motorNumbers: uniqueMotorNumbers,
      rawText: text.substring(0, 5000), // Return first 5000 chars for debugging
      totalMotors: uniqueMotorNumbers.length,
    })
  } catch (error: any) {
    console.error('Error parsing PDF:', error)
    return NextResponse.json(
      { error: 'Fout bij het lezen van PDF: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}


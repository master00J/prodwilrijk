import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/parse-pdf - Parse PDF and extract motor numbers and shipping note
// Note: Currently supports text-based PDFs only. Scanned PDFs require OCR which is not yet implemented server-side.
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
    let text = ''
    try {
      const pdfData = await pdfParse(buffer)
      text = pdfData.text
    } catch (parseError: any) {
      // PDF might be scanned (image-based)
      return NextResponse.json(
        { 
          error: 'Dit PDF bestand lijkt gescand te zijn. Helaas wordt OCR (tekstherkenning) momenteel nog niet ondersteund. Probeer een PDF met selecteerbare tekst.',
          isScanned: true
        },
        { status: 400 }
      )
    }

    // Check if PDF has meaningful text (not scanned)
    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { 
          error: 'Dit PDF bestand bevat geen selecteerbare tekst. Het lijkt een gescand document te zijn. Helaas wordt OCR (tekstherkenning) momenteel nog niet ondersteund. Probeer een PDF met selecteerbare tekst.',
          isScanned: true
        },
        { status: 400 }
      )
    }

    // Parse the text to extract motor numbers and shipping note
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

    // Try to find shipping note - Look for "NR" followed by a number (e.g., "NR 138197")
    let shippingNote = ''
    const shippingNotePatterns = [
      /\bNR\s+(\d+)\b/i, // "NR 138197" pattern (priority)
      /verzendnota[:\s]+([^\n\r]+)/i,
      /shipping\s*note[:\s]+([^\n\r]+)/i,
      /note[:\s]+([^\n\r]+)/i,
      /ref[:\s]+([^\n\r]+)/i,
      /reference[:\s]+([^\n\r]+)/i,
    ]

    for (const pattern of shippingNotePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        shippingNote = match[1].trim()
        break
      }
    }

    // Extract motor numbers - Look for numeric codes (4-15 digits)
    // These appear in the "Stuknummer" column
    const motorNumbers: string[] = []
    
    // Look for "Stuknummer" section and extract numbers that follow
    const stuknummerIndex = lines.findIndex(line => 
      line.toLowerCase().includes('stuknummer') || 
      line.toLowerCase().includes('stuk nummer')
    )
    
    // If we found "Stuknummer" header, look for numbers in nearby lines
    if (stuknummerIndex >= 0) {
      // Check lines after "Stuknummer" header (skip a few lines to account for column headers)
      for (let i = stuknummerIndex + 2; i < Math.min(stuknummerIndex + 20, lines.length); i++) {
        const line = lines[i]
        // Look for numeric codes (4-15 digits, motor numbers can vary in length)
        const numberMatches = line.match(/\b(\d{4,15})\b/g)
        if (numberMatches) {
          for (const num of numberMatches) {
            // Skip if it looks like a date, year, or other common patterns
            if (
              num !== '0000' && 
              num !== '00000' &&
              !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(num) && // Skip dates
              !/^\d{4}$/.test(num) && parseInt(num) < 2000 // Skip years (4 digits < 2000)
            ) {
              motorNumbers.push(num)
            }
          }
        }
      }
    }
    
    // Also search entire text for numeric codes as fallback
    if (motorNumbers.length === 0) {
      const allNumberMatches = text.match(/\b(\d{4,15})\b/g)
      if (allNumberMatches) {
        for (const num of allNumberMatches) {
          // Skip dates, years, and common non-motor numbers
          if (
            num !== '0000' && 
            num !== '00000' &&
            !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(num) && // Skip dates
            !/^\d{4}$/.test(num) && parseInt(num) < 2000 // Skip years (4 digits < 2000)
          ) {
            motorNumbers.push(num)
          }
        }
      }
    }

    // Remove duplicates and sort
    const uniqueMotorNumbers = [...new Set(motorNumbers)].sort()

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

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
    // Priority: Find "NR" followed by a 6-digit number starting with "1" (common pattern)
    let shippingNote = ''
    
    // First, try to find "NR" followed by a number (highest priority)
    const nrPattern = /\bNR\s+(\d{5,7})\b/i
    const nrMatch = text.match(nrPattern)
    if (nrMatch && nrMatch[1]) {
      shippingNote = nrMatch[1].trim()
    } else {
      // Try other patterns
      const shippingNotePatterns = [
        /\bNR[:\s]*(\d{5,7})\b/i, // "NR: 138197" or "NR 138197"
        /verzendnota[:\s]+(\d{5,7})/i,
        /shipping\s*note[:\s]+(\d{5,7})/i,
      ]

      for (const pattern of shippingNotePatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
          shippingNote = match[1].trim()
          break
        }
      }
      
      // Fallback: Look for 6-digit numbers starting with "1" in the top area (to catch OCR errors)
      if (!shippingNote) {
        const topText = text.substring(0, Math.min(2000, text.length))
        // Look for 6-digit numbers that start with 1 (or could be misread as 7)
        const nrNumbers = topText.match(/\b[17](\d{5})\b/g)
        if (nrNumbers && nrNumbers.length > 0) {
          // Prefer numbers starting with 1, but also check if 7 could be 1 (OCR error)
          for (const num of nrNumbers) {
            // If it starts with 7 but could be 1, or starts with 1
            if (num.startsWith('1') || (num.startsWith('7') && parseInt(num) >= 100000 && parseInt(num) < 200000)) {
              shippingNote = num
              break
            }
          }
          // If no match found, take the first one
          if (!shippingNote && nrNumbers.length > 0) {
            shippingNote = nrNumbers[0]
          }
        }
      }
    }

    // Extract motor numbers - Look for 6-digit numbers under "Stuknummer" column
    // These are typically 6-digit codes like 253226, 253365, etc.
    const motorNumbers: string[] = []
    
    // Look for "Stuknummer" section and extract numbers that follow
    const stuknummerIndex = lines.findIndex(line => 
      line.toLowerCase().includes('stuknummer') || 
      line.toLowerCase().includes('stuk nummer') ||
      line.toLowerCase().includes('stuknr')
    )
    
    // If we found "Stuknummer" header, look for numbers in nearby lines
    if (stuknummerIndex >= 0) {
      // Check lines after "Stuknummer" header (skip header line)
      for (let i = stuknummerIndex + 1; i < Math.min(stuknummerIndex + 30, lines.length); i++) {
        const line = lines[i]
        
        // Priority: Look for 6-digit numbers (most common motor number format)
        const sixDigitMatches = line.match(/\b(\d{6})\b/g)
        if (sixDigitMatches) {
          for (const num of sixDigitMatches) {
            // Filter out common false positives
            if (
              parseInt(num) >= 100000 && // Valid 6-digit range
              parseInt(num) < 999999 &&
              !motorNumbers.includes(num) // Avoid duplicates
            ) {
              motorNumbers.push(num)
            }
          }
        }
        
        // Also check for other common motor number formats (5-7 digits)
        const flexibleMatches = line.match(/\b(\d{5,7})\b/g)
        if (flexibleMatches) {
          for (const num of flexibleMatches) {
            // Skip if already found or if it's likely not a motor number
            if (
              !motorNumbers.includes(num) &&
              num.length >= 5 && // At least 5 digits
              parseInt(num) >= 10000 && // Reasonable minimum
              parseInt(num) < 9999999 && // Reasonable maximum
              !/^\d{4}$/.test(num) || parseInt(num) >= 2000 // Not a year
            ) {
              motorNumbers.push(num)
            }
          }
        }
      }
    }
    
    // Also search entire text for 6-digit numbers as fallback
    if (motorNumbers.length === 0) {
      // Priority: Look for 6-digit numbers throughout the document
      const sixDigitMatches = text.match(/\b(\d{6})\b/g)
      if (sixDigitMatches) {
        for (const num of sixDigitMatches) {
          // Filter out common false positives (dates, years, etc.)
          if (
            parseInt(num) >= 100000 && // Valid 6-digit range
            parseInt(num) < 999999 &&
            !motorNumbers.includes(num) && // Avoid duplicates
            num !== shippingNote // Don't include shipping note
          ) {
            motorNumbers.push(num)
          }
        }
      }
      
      // Fallback: Look for 5-7 digit numbers
      if (motorNumbers.length === 0) {
        const flexibleMatches = text.match(/\b(\d{5,7})\b/g)
        if (flexibleMatches) {
          for (const num of flexibleMatches) {
            if (
              !motorNumbers.includes(num) &&
              num.length >= 5 &&
              parseInt(num) >= 10000 &&
              parseInt(num) < 9999999 &&
              num !== shippingNote && // Don't include shipping note
              (!/^\d{4}$/.test(num) || parseInt(num) >= 2000) // Not a year
            ) {
              motorNumbers.push(num)
            }
          }
        }
      }
    }

    // Remove duplicates while preserving original order
    const uniqueMotorNumbers: string[] = []
    const seen = new Set<string>()
    for (const num of motorNumbers) {
      if (!seen.has(num)) {
        seen.add(num)
        uniqueMotorNumbers.push(num)
      }
    }

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

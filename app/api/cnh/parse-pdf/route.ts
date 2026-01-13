import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import pdfImgConvert from 'pdf-img-convert'
import { createWorker } from 'tesseract.js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/parse-pdf - Parse PDF and extract motor numbers and shipping note using OCR for scanned PDFs
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

    let text = ''

    // Try to parse as text-based PDF first
    try {
      const pdfData = await pdfParse(buffer)
      text = pdfData.text
      
      // If we got meaningful text (more than just a few characters), use it
      if (text.length > 100) {
        console.log('PDF contains text, using direct text extraction')
      } else {
        // PDF appears to be scanned, need OCR
        text = ''
        throw new Error('PDF appears to be scanned, using OCR')
      }
    } catch (parseError) {
      // PDF is likely scanned, convert to images and use OCR
      console.log('PDF is scanned or has no text, using OCR...')
      
      try {
        // Convert PDF pages to images
        const outputImages = await pdfImgConvert.convert(buffer, {
          scale: 2.0, // Higher scale for better OCR accuracy
        })

        if (!outputImages || outputImages.length === 0) {
          return NextResponse.json(
            { error: 'Kon PDF niet converteren naar afbeeldingen' },
            { status: 500 }
          )
        }

        // Initialize Tesseract worker
        const worker = await createWorker('nld+eng') // Dutch + English

        // Process each page
        const allText: string[] = []
        for (let i = 0; i < outputImages.length; i++) {
          const image = outputImages[i]
          const { data: { text: pageText } } = await worker.recognize(image)
          allText.push(pageText)
          console.log(`Processed page ${i + 1}/${outputImages.length}`)
        }

        await worker.terminate()
        text = allText.join('\n')
      } catch (ocrError: any) {
        console.error('OCR error:', ocrError)
        return NextResponse.json(
          { error: 'Fout bij OCR verwerking: ' + (ocrError.message || 'Unknown error') },
          { status: 500 }
        )
      }
    }

    // Parse the text to extract motor numbers and shipping note
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

    // Try to find shipping note (common patterns: "Verzendnota", "Shipping Note", "Note:", etc.)
    let shippingNote = ''
    const shippingNotePatterns = [
      /verzendnota[:\s]+([^\n\r]+)/i,
      /shipping\s*note[:\s]+([^\n\r]+)/i,
      /note[:\s]+([^\n\r]+)/i,
      /ref[:\s]+([^\n\r]+)/i,
      /reference[:\s]+([^\n\r]+)/i,
      /lb[:\s]+([^\n\r]+)/i, // "lb" might be the shipping note prefix
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
      /^[A-Z0-9]{6,15}$/, // General alphanumeric pattern
    ]

    for (const line of lines) {
      // Skip lines that are clearly headers/labels
      const lowerLine = line.toLowerCase()
      if (
        lowerLine.includes('motor') ||
        lowerLine.includes('nummer') ||
        lowerLine.includes('number') ||
        lowerLine.includes('verzendnota') ||
        lowerLine.includes('shipping') ||
        lowerLine.includes('note') ||
        lowerLine.includes('ref') ||
        lowerLine.includes('datum') ||
        lowerLine.includes('date') ||
        lowerLine.includes('lb') ||
        lowerLine.includes('pagina') ||
        lowerLine.includes('page') ||
        line.length < 4 ||
        line.length > 30 ||
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(line) // Skip dates
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

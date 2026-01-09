import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to get BC codes
async function getBcCodes(items: Array<{ breedte: number; dikte: number; houtsoort: string }>) {
  try {
    // Get unique items
    const uniqueItems: Array<{ breedte: number; dikte: number; houtsoort: string }> = []
    const seenKeys = new Set<string>()

    items.forEach((item) => {
      const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
      const key = `${item.breedte}-${item.dikte}-${houtsoort}`

      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        uniqueItems.push({
          breedte: item.breedte,
          dikte: item.dikte,
          houtsoort: item.houtsoort || ''
        })
      }
    })

    // Query BC codes from database (table might not exist, so catch error gracefully)
    let bcCodes: any[] = []
    try {
      const { data, error } = await supabaseAdmin
        .from('bc_codes')
        .select('breedte, dikte, houtsoort, bc_code')

      if (error) {
        // Table doesn't exist or other error - just log and continue without BC codes
        console.warn('BC codes table not found or error:', error.message)
        return {}
      }
      bcCodes = data || []
    } catch (error) {
      // Table doesn't exist - return empty object
      console.warn('BC codes table not available')
      return {}
    }

    // Create mapping
    const bcCodeMap: Record<string, string> = {}
    
    if (bcCodes) {
      bcCodes.forEach((row: any) => {
        const houtsoort = row.houtsoort ? row.houtsoort.toLowerCase() : ''
        const key = `${row.breedte}-${row.dikte}-${houtsoort}`
        bcCodeMap[key] = row.bc_code || ''
      })
    }

    return bcCodeMap
  } catch (error) {
    console.error('Error fetching BC codes:', error)
    return {}
  }
}

// Generate PDF using pdf-lib (works better in serverless environments)
async function generateOrderPDF(orderList: any[], columnOrder: string[], columnHeaders: Record<string, string>): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  
  // Landscape A4: 842 x 595 points
  const pageWidth = 842
  const pageHeight = 595
  const margin = 50
  const tableWidth = pageWidth - (margin * 2)
  
  // Fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let yPosition = pageHeight - margin
  
  // Title (centered)
  const titleText = 'Openstaande Bestellijst voor Hout'
  const titleWidth = helveticaBoldFont.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    y: yPosition,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= 30
  
  // Date
  const dateText = `Datum: ${new Date().toLocaleDateString('nl-NL')}`
  const dateWidth = helveticaFont.widthOfTextAtSize(dateText, 10)
  page.drawText(dateText, {
    x: (pageWidth - dateWidth) / 2,
    y: yPosition,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= 30
  
  // Priority legend
  page.drawRectangle({
    x: margin,
    y: yPosition - 10,
    width: 12,
    height: 12,
    color: rgb(1, 0.93, 0.7), // #ffecb3
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  page.drawText('= Prioriteit', {
    x: margin + 17,
    y: yPosition - 2,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= 40
  
  // Column widths matching pdfmake percentages
  const columnWidths: Record<string, number> = {
    'dikte': tableWidth * 0.08,      // 8%
    'breedte': tableWidth * 0.08,     // 8%
    'min_lengte': tableWidth * 0.11,  // 11%
    'aantal_pakken': tableWidth * 0.11, // 11%
    'bc_code': tableWidth * 0.11,     // 11%
    'besteld_op': tableWidth * 0.11,  // 11%
    'houtsoort': tableWidth * 0.15,   // 15%
    'opmerkingen': tableWidth * 0.25, // 25%
  }

  const calculatedWidths = columnOrder.map(col => columnWidths[col] || tableWidth * 0.1)
  const rowHeight = 20
  const cellPadding = 5
  const headerY = yPosition

  // Header row
  let x = margin
  columnOrder.forEach((col, i) => {
    const width = calculatedWidths[i]
    const headerText = columnHeaders[col] || col
    
    // Header background
    page.drawRectangle({
      x,
      y: headerY - rowHeight,
      width,
      height: rowHeight,
      color: rgb(0.96, 0.96, 0.96), // #f5f5f5
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    })
    
    // Header text
    page.drawText(headerText, {
      x: x + cellPadding,
      y: headerY - rowHeight + cellPadding,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
      maxWidth: width - cellPadding * 2,
    })
    
    x += width
  })

  // Data rows
  let currentY = headerY - rowHeight
  orderList.forEach((item) => {
    // Check if we need a new page
    if (currentY - rowHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      currentY = pageHeight - margin - 40
      
      // Redraw header on new page
      x = margin
      columnOrder.forEach((col, i) => {
        const width = calculatedWidths[i]
        const headerText = columnHeaders[col] || col
        
        page.drawRectangle({
          x,
          y: currentY - rowHeight,
          width,
          height: rowHeight,
          color: rgb(0.96, 0.96, 0.96),
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        })
        
        page.drawText(headerText, {
          x: x + cellPadding,
          y: currentY - rowHeight + cellPadding,
          size: 10,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
          maxWidth: width - cellPadding * 2,
        })
        
        x += width
      })
      currentY -= rowHeight
    }

    x = margin
    const fillColor = item.priority ? rgb(1, 0.93, 0.7) : rgb(1, 1, 1) // #ffecb3 or white
    
    columnOrder.forEach((col, i) => {
      const width = calculatedWidths[i]
      let value = ''
      
      if (col === 'besteld_op' && item[col]) {
        value = new Date(item[col]).toLocaleDateString('nl-NL')
      } else if (item[col] !== null && item[col] !== undefined) {
        value = item[col].toString()
      }
      
      // Cell background
      page.drawRectangle({
        x,
        y: currentY - rowHeight,
        width,
        height: rowHeight,
        color: fillColor,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      })
      
      // Cell text (truncate if too long)
      const maxTextWidth = width - cellPadding * 2
      let displayValue = value
      if (helveticaFont.widthOfTextAtSize(value, 9) > maxTextWidth) {
        // Truncate text
        while (helveticaFont.widthOfTextAtSize(displayValue + '...', 9) > maxTextWidth && displayValue.length > 0) {
          displayValue = displayValue.slice(0, -1)
        }
        displayValue += '...'
      }
      
      page.drawText(displayValue, {
        x: x + cellPadding,
        y: currentY - rowHeight + cellPadding,
        size: 9,
        font: helveticaFont,
        color: rgb(0, 0, 0),
        maxWidth: maxTextWidth,
      })
      
      x += width
    })
    
    currentY -= rowHeight
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderList, columnOrder, columnHeaders } = body

    if (!Array.isArray(orderList) || orderList.length === 0) {
      return NextResponse.json(
        { error: 'No orders selected' },
        { status: 400 }
      )
    }

    // Get BC codes for items
    const itemsForBcCode = orderList.map((item: any) => ({
      breedte: item.breedte,
      dikte: item.dikte,
      houtsoort: item.houtsoort || ''
    }))

    const bcCodes = await getBcCodes(itemsForBcCode)

    // Add BC codes to order list
    const updatedOrderList = orderList.map((item: any) => {
      const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
      const key = `${item.breedte}-${item.dikte}-${houtsoort}`
      return {
        ...item,
        bc_code: bcCodes[key] || ''
      }
    })

    // Sort data: priority first, then by houtsoort, dikte, breedte, lengte
    const sortedData = updatedOrderList.sort((a: any, b: any) => {
      if (a.priority !== b.priority) {
        return b.priority ? 1 : -1
      }
      if (a.houtsoort !== b.houtsoort) {
        return a.houtsoort.localeCompare(b.houtsoort)
      }
      const dikteA = parseFloat(a.dikte)
      const dikteB = parseFloat(b.dikte)
      if (dikteA !== dikteB) {
        return dikteA - dikteB
      }
      const breedteA = parseFloat(a.breedte)
      const breedteB = parseFloat(b.breedte)
      if (breedteA !== breedteB) {
        return breedteA - breedteB
      }
      const lengteA = parseFloat(a.min_lengte || 0)
      const lengteB = parseFloat(b.min_lengte || 0)
      return lengteA - lengteB
    })

    // Generate PDF (keep in memory, don't write to disk)
    const pdfBuffer = await generateOrderPDF(sortedData, columnOrder, columnHeaders)

    // Setup email transporter (using same config as airtec flow)
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true' // true for 465, false for other ports
    const user = process.env.SMTP_USER || ''
    const password = process.env.SMTP_PASSWORD || ''
    const from = process.env.SMTP_FROM || user

    if (!user || !password) {
      return NextResponse.json(
        { error: 'Email configuration is missing. Please set SMTP_USER and SMTP_PASSWORD environment variables.' },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    // Send email with PDF buffer directly (no temp file needed)
    await transporter.sendMail({
      from: `"Bestellingen" <${from}>`,
      to: process.env.ORDER_EMAIL_TO || 'prodwilrijk@foresco.eu,j.ploegaerts@foresco.eu',
      subject: 'Nieuwe Bestellijst Hout',
      html: `
        <p>Beste,</p>
        <p>In bijlage vindt u de nieuwste bestellijst voor hout.</p>
        <p>Met vriendelijke groet,</p>
        <p>Foresco Wilrijk</p>
      `,
      attachments: [
        {
          filename: `bestelling_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer, // Use buffer directly instead of file path
          contentType: 'application/pdf'
        }
      ]
    })

    return NextResponse.json({ success: true, message: 'PDF sent successfully' })
  } catch (error) {
    console.error('Error in send_order_pdf:', error)
    
    return NextResponse.json(
      { error: 'Failed to send PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

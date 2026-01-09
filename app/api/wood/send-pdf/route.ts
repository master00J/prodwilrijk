import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

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

    // Query BC codes from database
    const { data: bcCodes, error } = await supabaseAdmin
      .from('bc_codes')
      .select('breedte, dikte, houtsoort, bc_code')

    if (error) {
      console.error('Error fetching BC codes:', error)
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

// Generate PDF using PDFKit (similar layout to pdfmake)
function generateOrderPDF(orderList: any[], columnOrder: string[], columnHeaders: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margin: 50
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)

      // Title
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Openstaande Bestellijst voor Hout', { align: 'center' })
         .moveDown(0.5)

      // Date
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, { align: 'center' })
         .moveDown(1)

      // Priority legend
      const legendY = doc.y
      doc.rect(50, legendY, 12, 12)
         .fillColor('#ffecb3')
         .fill()
         .stroke()
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('black')
         .text('= Prioriteit', 67, legendY + 1)
         .moveDown(1.5)

      // Table setup - matching pdfmake layout exactly
      const tableTop = doc.y
      const rowHeight = 20
      const cellPadding = 5
      const pageWidth = 792 // Landscape A4 width in points
      const pageHeight = 612 // Landscape A4 height in points
      const margin = 50
      const tableWidth = pageWidth - (margin * 2)
      
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

      // Header row
      let x = margin
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('black')
      
      columnOrder.forEach((col, i) => {
        const width = calculatedWidths[i]
        doc.rect(x, tableTop, width, rowHeight)
           .fillColor('#f5f5f5')
           .fill()
           .strokeColor('black')
           .stroke()
        
        doc.text(columnHeaders[col] || col, x + cellPadding, tableTop + cellPadding, {
          width: width - cellPadding * 2,
          align: 'left'
        })
        x += width
      })

      // Data rows
      let currentY = tableTop + rowHeight
      orderList.forEach((item) => {
        // Check if we need a new page
        if (currentY + rowHeight > pageHeight - margin) {
          doc.addPage()
          currentY = margin
        }

        x = margin
        const fillColor = item.priority ? '#ffecb3' : 'white'
        
        columnOrder.forEach((col, i) => {
          const width = calculatedWidths[i]
          let value = ''
          
          if (col === 'besteld_op' && item[col]) {
            value = new Date(item[col]).toLocaleDateString('nl-NL')
          } else if (item[col] !== null && item[col] !== undefined) {
            value = item[col].toString()
          }
          
          doc.rect(x, currentY, width, rowHeight)
             .fillColor(fillColor)
             .fill()
             .strokeColor('black')
             .stroke()
          
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor('black')
             .text(value, x + cellPadding, currentY + cellPadding, {
               width: width - cellPadding * 2,
               align: 'left',
               ellipsis: true
             })
          
          x += width
        })
        
        currentY += rowHeight
      })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null
  
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

    // Generate PDF
    const pdfBuffer = await generateOrderPDF(sortedData, columnOrder, columnHeaders)

    // Save to temp file
    const tempDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    tempFilePath = path.join(tempDir, `bestelling_${Date.now()}.pdf`)
    fs.writeFileSync(tempFilePath, pdfBuffer)

    // Setup email transporter (using same config as airtec flow)
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true' // true for 465, false for other ports
    const user = process.env.SMTP_USER || ''
    const password = process.env.SMTP_PASSWORD || ''
    const from = process.env.SMTP_FROM || user

    if (!user || !password) {
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
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

    // Send email
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
          path: tempFilePath
        }
      ]
    })

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
    }

    return NextResponse.json({ success: true, message: 'PDF sent successfully' })
  } catch (error) {
    console.error('Error in send_order_pdf:', error)
    
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath)
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError)
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to send PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


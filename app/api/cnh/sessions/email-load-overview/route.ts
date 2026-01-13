import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/email-load-overview - Send email with load overview PDF
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, toEmail } = body

    if (!sessionId || !toEmail) {
      return NextResponse.json(
        { error: 'sessionId en toEmail zijn vereist' },
        { status: 400 }
      )
    }

    // 1) Fetch session data
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('cnh_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessie niet gevonden' },
        { status: 404 }
      )
    }

    // 2) Fetch motors for this session
    const { data: sessionMotors, error: sessionMotorsError } = await supabaseAdmin
      .from('cnh_session_motors')
      .select('motor_id')
      .eq('session_id', sessionId)

    if (sessionMotorsError) {
      console.error('Error fetching session motors:', sessionMotorsError)
    }

    const motorIds = sessionMotors?.map((sm) => sm.motor_id) || []

    const { data: motors, error: motorsError } = await supabaseAdmin
      .from('cnh_motors')
      .select('motor_nr, shipping_note')
      .in('id', motorIds)

    if (motorsError) {
      console.error('Error fetching motors:', motorsError)
    }

    // Prepare session data
    const sessData: Record<string, string> = {
      'Laad Referentie:': session.load_reference || '—',
      'Locatie:': session.location || '—',
      'Vrachtwagen:': session.truck_plate || '—',
      'Container:': session.container_no || '—',
      'Booking Ref.:': session.booking_ref || '—',
      'Your Ref.:': session.your_ref || '—',
      'Container Tarra (kg):': session.container_tarra ? session.container_tarra.toString() : '—',
    }

    // Prepare motors
    const motorsList = (motors || []).map((m) => ({
      motorNr: m.motor_nr || '??',
      verzendnota: m.shipping_note || '—',
    }))

    // 3) Generate PDF
    const buffers: Buffer[] = []

    const COLORS = {
      primary: '#00897B',
      text: '#333333',
      lightGray: '#f5f5f5',
      border: '#dddddd',
      rowBg: '#f9f9f9',
    }

    const PAGE_CONFIG = {
      margin: 50,
      width: 495,
      maxY: 750,
    }

    // Motor table generator function
    const generateMotorTable = (
      doc: PDFDocument,
      motors: Array<{ motorNr: string; verzendnota: string }>,
      startY: number,
      pageConfig: typeof PAGE_CONFIG,
      colors: typeof COLORS
    ) => {
      let currentY = startY
      const rowHeight = 25
      const headerHeight = 25
      let headerDrawnOnCurrentPage = false

      const drawHeader = (y: number) => {
        doc.rect(50, y - 5, pageConfig.width, headerHeight)
          .fillColor(colors.lightGray)
          .fill()

        doc.fillColor(colors.text)
          .fontSize(11)
          .text('Motor Nr.', 70, y)
          .text('Verzendnota', 300, y)

        headerDrawnOnCurrentPage = true
        return y + headerHeight
      }

      let currentIndex = 0

      while (currentIndex < motors.length) {
        if (currentY + rowHeight > pageConfig.maxY) {
          doc.addPage()
          currentY = 50
          headerDrawnOnCurrentPage = false
        }

        if (!headerDrawnOnCurrentPage) {
          currentY = drawHeader(currentY)
        }

        if (currentIndex % 2 === 0) {
          doc.rect(50, currentY - 5, pageConfig.width, rowHeight)
            .fillColor(colors.rowBg)
            .fill()
        }

        doc.fillColor(colors.text)
          .font('Helvetica')
          .fontSize(11)
          .text(motors[currentIndex].motorNr, 70, currentY)
          .text(motors[currentIndex].verzendnota, 300, currentY)

        currentY += rowHeight
        currentIndex++
      }

      return currentY
    }

    // Create PDF document
    const doc = new PDFDocument({
      margin: PAGE_CONFIG.margin,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Laadoverzicht ${sessData['Laad Referentie:']}`,
        Author: 'Foresco',
      },
    })

    // Event handlers for PDF data
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))

    // Wait for PDF to finish generating
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers))
      })
      doc.on('error', reject)
    })

    // PDF Content generation
    // Header section - Logo (skip for now, can add later)
    // Reference title
    doc.font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(COLORS.primary)
      .text(sessData['Laad Referentie:'], 220, 50)

    // Date
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(new Date().toLocaleDateString('nl-BE'), 495, 50, {
        align: 'right',
      })

    // General Information section
    doc.moveDown(3)
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text('Algemene Informatie', 50, doc.y)

    // Info box with gray background
    const infoBoxY = doc.y + 10
    const infoBoxHeight = Object.keys(sessData).length * 25 + 30

    doc.rect(50, infoBoxY, PAGE_CONFIG.width, infoBoxHeight)
      .fillColor(COLORS.lightGray)
      .fill()

    // Info items
    let currentY = infoBoxY + 15
    Object.entries(sessData).forEach(([key, value]) => {
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(key, 70, currentY)

      doc.font('Helvetica')
        .text(value, 220, currentY)

      currentY += 25
    })

    // Motors section
    doc.moveDown(4)
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text('Motoren in deze Lading')

    // Generate motor table with pagination
    const tableStartY = doc.y + 20
    generateMotorTable(doc, motorsList, tableStartY, PAGE_CONFIG, COLORS)

    // Add page numbers to all pages
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#999999')
        .text(`Pagina ${i + 1} van ${pages.count}`, 50, doc.page.height - 50, {
          align: 'center',
          width: PAGE_CONFIG.width,
        })
    }

    // Finish PDF
    doc.end()

    // Wait for PDF to be generated
    const pdfData = await pdfPromise

    // 4) Prepare email attachments
    const attachments: Array<{ filename: string; content?: Buffer; path?: string }> = [
      {
        filename: `Laadoverzicht_${sessData['Laad Referentie:']}.pdf`,
        content: pdfData,
      },
    ]

    // Add container photo if available
    if (session.container_photo_url) {
      try {
        // Download photo from Supabase Storage
        const photoUrl = session.container_photo_url
        // Extract path from URL if it's a Supabase storage URL
        const urlParts = photoUrl.split('/')
        const bucketName = 'cnh-photos'
        const filePath = urlParts.slice(urlParts.indexOf(bucketName) + 1).join('/')

        const { data: photoData, error: photoError } = await supabaseAdmin.storage
          .from(bucketName)
          .download(filePath)

        if (!photoError && photoData) {
          const arrayBuffer = await photoData.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          attachments.push({
            filename: `container_photo_${sessionId}.jpg`,
            content: buffer,
          })
        }
      } catch (photoErr) {
        console.error('Error downloading container photo:', photoErr)
        // Continue without photo
      }
    }

    // 5) Send email
    const transporter = nodemailer.createTransport({
      host: 'mail.prodwilrijk.be',
      port: 465,
      secure: true,
      auth: {
        user: 'jason@prodwilrijk.be',
        pass: 'prodwilrijk147',
      },
    })

    await transporter.sendMail({
      from: 'jason@prodwilrijk.be',
      to: toEmail,
      subject: `Laadoverzicht: ${sessData['Laad Referentie:']}`,
      html: `
        <p>Beste,<br/>
           In bijlage het laadoverzicht van <b>${sessData['Laad Referentie:']}</b>.<br/>
           Groeten,<br/>
           Foresco Wilrijk
        </p>
      `,
      attachments,
    })

    return NextResponse.json({
      success: true,
      message: 'E-mail verzonden met PDF (en evt. foto)!',
    })
  } catch (error: any) {
    console.error('email_load_overview error:', error)
    return NextResponse.json(
      { error: 'Fout bij mail: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}


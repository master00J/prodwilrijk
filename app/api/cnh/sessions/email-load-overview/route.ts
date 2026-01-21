import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const getEmailConfig = () => {
  const host = process.env.SMTP_HOST || 'mail.prodwilrijk.be'
  const port = parseInt(process.env.SMTP_PORT || '465')
  const secure = process.env.SMTP_SECURE === 'true' || port === 465
  const user = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = process.env.SMTP_FROM || user

  return { host, port, secure, user, password, from }
}

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

    // 3) Generate PDF with pdf-lib
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size in points
    const { width, height } = page.getSize()
    const margin = 50
    const pageWidth = width - 2 * margin
    let currentY = height - margin

    // Colors
    const colors = {
      primary: rgb(0, 0.537, 0.486), // #00897B
      text: rgb(0.2, 0.2, 0.2), // #333333
      lightGray: rgb(0.961, 0.961, 0.961), // #f5f5f5
      rowBg: rgb(0.976, 0.976, 0.976), // #f9f9f9
    }

    // Fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Header - Reference title
    page.drawText(sessData['Laad Referentie:'] || '', {
      x: margin + 170,
      y: currentY - 30,
      size: 24,
      font: fontBold,
      color: colors.primary,
    })

    // Date
    const dateText = new Date().toLocaleDateString('nl-BE')
    const dateWidth = font.widthOfTextAtSize(dateText, 10)
    page.drawText(dateText, {
      x: width - margin - dateWidth,
      y: currentY - 30,
      size: 10,
      font: font,
      color: colors.text,
    })

    currentY -= 100

    // General Information section
    page.drawText('Algemene Informatie', {
      x: margin,
      y: currentY,
      size: 14,
      font: fontBold,
      color: colors.primary,
    })

    currentY -= 30

    // Info box background
    const infoBoxHeight = Object.keys(sessData).length * 25 + 30
    page.drawRectangle({
      x: margin,
      y: currentY - infoBoxHeight,
      width: pageWidth,
      height: infoBoxHeight,
      color: colors.lightGray,
    })

    // Info items
    let infoY = currentY - 20
    Object.entries(sessData).forEach(([key, value]) => {
      page.drawText(key, {
        x: margin + 20,
        y: infoY,
        size: 11,
        font: fontBold,
        color: colors.text,
      })
      page.drawText(value, {
        x: margin + 170,
        y: infoY,
        size: 11,
        font: font,
        color: colors.text,
      })
      infoY -= 25
    })

    currentY -= infoBoxHeight + 50

    // Motors section title
    page.drawText('Motoren in deze Lading', {
      x: margin,
      y: currentY,
      size: 14,
      font: fontBold,
      color: colors.primary,
    })

    currentY -= 40

    // Motor table header
    const headerY = currentY
    page.drawRectangle({
      x: margin,
      y: headerY - 20,
      width: pageWidth,
      height: 25,
      color: colors.lightGray,
    })
    page.drawText('Motor Nr.', {
      x: margin + 20,
      y: headerY - 5,
      size: 11,
      font: font,
      color: colors.text,
    })
    page.drawText('Verzendnota', {
      x: margin + 250,
      y: headerY - 5,
      size: 11,
      font: font,
      color: colors.text,
    })

    currentY -= 35

    // Motor rows
    const rowHeight = 25
    let rowIndex = 0
    let currentPage = page
    for (const motor of motorsList) {
      // Check if we need a new page
      if (currentY < margin + 50) {
        const newPage = pdfDoc.addPage([595, 842])
        const { height: newHeight } = newPage.getSize()
        currentY = newHeight - margin - 100
        currentPage = newPage

        // Draw header on new page
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 20,
          width: pageWidth,
          height: 25,
          color: colors.lightGray,
        })
        currentPage.drawText('Motor Nr.', {
          x: margin + 20,
          y: currentY - 5,
          size: 11,
          font: font,
          color: colors.text,
        })
        currentPage.drawText('Verzendnota', {
          x: margin + 250,
          y: currentY - 5,
          size: 11,
          font: font,
          color: colors.text,
        })

        currentY -= 35
        rowIndex = 0
      }

      // Alternate row background
      if (rowIndex % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 20,
          width: pageWidth,
          height: rowHeight,
          color: colors.rowBg,
        })
      }

      currentPage.drawText(motor.motorNr, {
        x: margin + 20,
        y: currentY - 5,
        size: 11,
        font: font,
        color: colors.text,
      })
      currentPage.drawText(motor.verzendnota, {
        x: margin + 250,
        y: currentY - 5,
        size: 11,
        font: font,
        color: colors.text,
      })

      currentY -= rowHeight
      rowIndex++
    }

    // Add page numbers
    const pages = pdfDoc.getPages()
    pages.forEach((page, index) => {
      const pageNumber = `Pagina ${index + 1} van ${pages.length}`
      const pageNumberWidth = font.widthOfTextAtSize(pageNumber, 9)
      page.drawText(pageNumber, {
        x: (width - pageNumberWidth) / 2,
        y: 30,
        size: 9,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
      })
    })

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // 4) Prepare email attachments
    const attachments: Array<{ filename: string; content?: Buffer; path?: string }> = [
      {
        filename: `Laadoverzicht_${sessData['Laad Referentie:']}.pdf`,
        content: Buffer.from(pdfBytes),
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
    const emailConfig = getEmailConfig()
    if (!emailConfig.user || !emailConfig.password) {
      return NextResponse.json(
        { error: 'Email configuratie ontbreekt. Vul SMTP_USER en SMTP_PASSWORD in.' },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    })

    await transporter.sendMail({
      from: emailConfig.from,
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

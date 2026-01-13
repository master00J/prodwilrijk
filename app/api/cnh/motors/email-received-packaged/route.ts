import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/motors/email-received-packaged - Send email with overview of motors currently at Foresco
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toEmail } = body

    if (!toEmail) {
      return NextResponse.json(
        { error: 'toEmail is vereist' },
        { status: 400 }
      )
    }

    // 1) Fetch all motors with state 'received' or 'packaged'
    const { data: motors, error: motorsError } = await supabaseAdmin
      .from('cnh_motors')
      .select('*')
      .in('state', ['received', 'packaged'])
      .order('shipping_note', { ascending: true })
      .order('motor_nr', { ascending: true })

    if (motorsError) {
      console.error('Error fetching motors:', motorsError)
      return NextResponse.json(
        { error: 'Fout bij ophalen motoren' },
        { status: 500 }
      )
    }

    if (!motors || motors.length === 0) {
      return NextResponse.json(
        { error: 'Geen motoren gevonden in status received of packaged.' },
        { status: 404 }
      )
    }

    // 2) Generate PDF with pdf-lib
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size in points
    const { width, height } = page.getSize()
    const margin = 50
    const pageWidth = width - 2 * margin
    let currentY = height - margin

    // Colors
    const colors = {
      primary: rgb(0, 0.537, 0.486), // #00897B
      secondary: rgb(0.333, 0.333, 0.333), // #555555
      border: rgb(0.878, 0.878, 0.878), // #e0e0e0
      background: rgb(0.976, 0.976, 0.976), // #f9f9f9
      rowBackground: rgb(0.941, 0.941, 0.941), // #f0f0f0
      text: rgb(0.173, 0.173, 0.173), // #2c2c2c
    }

    // Fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Helper functions
    function drawDivider(y: number) {
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.5,
        color: colors.border,
      })
    }

    // Header
    const title = 'Overzicht Motoren: Momenteel bij Foresco'
    const titleWidth = fontBold.widthOfTextAtSize(title, 20)
    page.drawText(title, {
      x: margin,
      y: currentY - 20,
      size: 20,
      font: fontBold,
      color: colors.primary,
    })

    const date = new Date().toLocaleDateString('nl-BE')
    const dateWidth = font.widthOfTextAtSize(date, 10)
    page.drawText(date, {
      x: width - margin - dateWidth,
      y: currentY - 18,
      size: 10,
      font: font,
      color: colors.secondary,
    })

    currentY -= 50
    drawDivider(currentY)
    currentY -= 20

    // Statistics section
    const stats = motors.reduce((acc: any, motor: any) => {
      const key = `${motor.location || 'Onbekend'}-${motor.state || 'Onbekend'}`
      if (!acc[key]) {
        acc[key] = {
          location: motor.location || 'Onbekend',
          state: motor.state || 'Onbekend',
          count: 0,
        }
      }
      acc[key].count++
      return acc
    }, {})

    // Section title: Overzicht Aantallen
    page.drawRectangle({
      x: margin,
      y: currentY - 18,
      width: pageWidth,
      height: 20,
      color: colors.rowBackground,
    })
    page.drawText('Overzicht Aantallen', {
      x: margin + 10,
      y: currentY - 5,
      size: 13,
      font: fontBold,
      color: colors.primary,
    })
    currentY -= 40

    // Statistics table - define column positions
    const statsColumns = {
      location: { x: margin + 10, width: 200 },
      state: { x: margin + 220, width: 150 },
      count: { x: margin + 380, width: 100 },
    }

    // Statistics table header
    page.drawRectangle({
      x: margin,
      y: currentY - 18,
      width: pageWidth,
      height: 22,
      color: colors.background,
    })
    page.drawText('Locatie', {
      x: statsColumns.location.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('Status', {
      x: statsColumns.state.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('Aantal', {
      x: statsColumns.count.x + statsColumns.count.width - fontBold.widthOfTextAtSize('Aantal', 11),
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    currentY -= 30

    // Statistics rows
    const statsList = Object.values(stats).sort((a: any, b: any) => {
      if (a.location !== b.location) return a.location.localeCompare(b.location)
      return a.state.localeCompare(b.state)
    })

    let totalMotors = 0
    statsList.forEach((stat: any, i: number) => {
      if (i % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: currentY - 18,
          width: pageWidth,
          height: 20,
          color: colors.rowBackground,
        })
      }

      page.drawText(stat.location, {
        x: statsColumns.location.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      page.drawText(stat.state, {
        x: statsColumns.state.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      const countText = stat.count.toString()
      const countWidth = font.widthOfTextAtSize(countText, 10)
      page.drawText(countText, {
        x: statsColumns.count.x + statsColumns.count.width - countWidth,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })

      totalMotors += stat.count
      currentY -= 25
    })

    currentY -= 10
    drawDivider(currentY)
    currentY -= 15

    // Total
    const totalText = `Totaal aantal motoren: ${totalMotors}`
    page.drawText(totalText, {
      x: margin + 15,
      y: currentY,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    currentY -= 40

    // Motors table section
    page.drawRectangle({
      x: margin,
      y: currentY - 18,
      width: pageWidth,
      height: 20,
      color: colors.rowBackground,
    })
    page.drawText('Motoren in received/packaged status', {
      x: margin + 10,
      y: currentY - 5,
      size: 13,
      font: fontBold,
      color: colors.primary,
    })
    currentY -= 40

    // Motors table - define column positions
    const motorsColumns = {
      id: { x: margin + 10, width: 50 },
      motor_nr: { x: margin + 70, width: 100 },
      location: { x: margin + 180, width: 90 },
      state: { x: margin + 280, width: 80 },
      shippingNote: { x: margin + 370, width: 120 },
    }

    // Table header
    page.drawRectangle({
      x: margin,
      y: currentY - 18,
      width: pageWidth,
      height: 22,
      color: colors.background,
    })
    page.drawText('ID', {
      x: motorsColumns.id.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('MotorNr', {
      x: motorsColumns.motor_nr.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('Locatie', {
      x: motorsColumns.location.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('State', {
      x: motorsColumns.state.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    page.drawText('Verzendnota', {
      x: motorsColumns.shippingNote.x,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: colors.primary,
    })
    currentY -= 30
    drawDivider(currentY)
    currentY -= 10

    // Motors rows
    let currentPage = page
    motors.forEach((m: any, i: number) => {
      // Check if we need a new page
      if (currentY < 100) {
        const newPage = pdfDoc.addPage([595, 842])
        const { width: newWidth, height: newHeight } = newPage.getSize()
        newPage.drawText('Overzicht Motoren: Momenteel bij Foresco', {
          x: margin,
          y: newHeight - margin - 20,
          size: 20,
          font: fontBold,
          color: colors.primary,
        })
        currentY = newHeight - margin - 70
        newPage.drawLine({
          start: { x: margin, y: currentY },
          end: { x: newWidth - margin, y: currentY },
          thickness: 0.5,
          color: colors.border,
        })
        currentY -= 40

        // Redraw section title and table header on new page
        newPage.drawRectangle({
          x: margin,
          y: currentY - 18,
          width: pageWidth,
          height: 20,
          color: colors.rowBackground,
        })
        newPage.drawText('Motoren in received/packaged status', {
          x: margin + 10,
          y: currentY - 5,
          size: 13,
          font: fontBold,
          color: colors.primary,
        })
        currentY -= 40

        newPage.drawRectangle({
          x: margin,
          y: currentY - 18,
          width: pageWidth,
          height: 22,
          color: colors.background,
        })
        newPage.drawText('ID', {
          x: motorsColumns.id.x,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: colors.primary,
        })
        newPage.drawText('MotorNr', {
          x: motorsColumns.motor_nr.x,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: colors.primary,
        })
        newPage.drawText('Locatie', {
          x: motorsColumns.location.x,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: colors.primary,
        })
        newPage.drawText('State', {
          x: motorsColumns.state.x,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: colors.primary,
        })
        newPage.drawText('Verzendnota', {
          x: motorsColumns.shippingNote.x,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: colors.primary,
        })
        currentY -= 30
        newPage.drawLine({
          start: { x: margin, y: currentY },
          end: { x: newWidth - margin, y: currentY },
          thickness: 0.5,
          color: colors.border,
        })
        currentY -= 10
        currentPage = newPage
      }

      if (i % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 18,
          width: pageWidth,
          height: 20,
          color: colors.rowBackground,
        })
      }

      currentPage.drawText(m.id?.toString() || '', {
        x: motorsColumns.id.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      currentPage.drawText(m.motor_nr || '', {
        x: motorsColumns.motor_nr.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      currentPage.drawText(m.location || '', {
        x: motorsColumns.location.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      currentPage.drawText(m.state || '', {
        x: motorsColumns.state.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })
      currentPage.drawText(m.shipping_note || '', {
        x: motorsColumns.shippingNote.x,
        y: currentY - 5,
        size: 10,
        font: font,
        color: colors.text,
      })

      currentY -= 25
    })

    // Add page numbers
    const pages = pdfDoc.getPages()
    pages.forEach((p, i) => {
      const pageNumber = `Pagina ${i + 1} van ${pages.length}`
      const pageNumberWidth = font.widthOfTextAtSize(pageNumber, 9)
      p.drawText(pageNumber, {
        x: (width - pageNumberWidth) / 2,
        y: 30,
        size: 9,
        font: font,
        color: colors.secondary,
      })
    })

    const pdfBytes = await pdfDoc.save()

    // 3) Send email
    const transporter = nodemailer.createTransport({
      host: 'mail.prodwilrijk.be',
      port: 465,
      secure: true,
      auth: {
        user: 'jason@prodwilrijk.be',
        pass: process.env.EMAIL_PASSWORD || 'prodwilrijk147',
      },
    })

    await transporter.sendMail({
      from: 'jason@prodwilrijk.be',
      to: toEmail,
      subject: 'Overzicht van motoren momenteel bij Foresco',
      html: `<p>Beste,<br>In bijlage het overzicht van alle motoren die momenteel bij Foresco staan.<br>Groeten,<br>Team Foresco</p>`,
      attachments: [
        {
          filename: `Overzicht motoren momenteel bij Foresco.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ],
    })

    return NextResponse.json({
      success: true,
      message: 'PDF verzonden!',
    })
  } catch (error: any) {
    console.error('email_received_packaged error:', error)
    return NextResponse.json(
      { error: 'Fout bij mail: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}

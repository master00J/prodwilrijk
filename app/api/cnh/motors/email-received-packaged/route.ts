import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'

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

    // 2) Generate PDF
    const buffers: Buffer[] = []
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
    })

    doc.on('data', (chunk) => buffers.push(chunk))
    
    // PDF Styling configuration
    const COLORS = {
      primary: '#00897B',
      secondary: '#555555',
      border: '#e0e0e0',
      background: '#f9f9f9',
      rowBackground: '#f0f0f0',
      text: '#2c2c2c',
    }

    const FONTS = {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
    }

    const PAGE_CONFIG = {
      margin: 50,
      contentWidth: 495,
      maxY: 750,
    }

    // Helper functions
    function addDivider(doc: any) {
      doc.strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(PAGE_CONFIG.margin, doc.y)
        .lineTo(PAGE_CONFIG.margin + PAGE_CONFIG.contentWidth, doc.y)
        .stroke()
      doc.moveDown(0.5)
    }

    function addHeader(doc: any, title: string) {
      doc.fontSize(20)
        .font(FONTS.bold)
        .fillColor(COLORS.primary)
        .text(title, PAGE_CONFIG.margin, doc.y)

      const date = new Date().toLocaleDateString('nl-BE')
      doc.fontSize(10)
        .font(FONTS.normal)
        .fillColor(COLORS.secondary)
        .text(date, PAGE_CONFIG.margin + 380, doc.y - 18, {
          width: 120,
          align: 'right',
        })

      doc.moveDown(1)
      addDivider(doc)
    }

    function addSectionTitle(doc: any, title: string) {
      const y = doc.y
      doc.save()
        .fillColor(COLORS.rowBackground)
        .rect(PAGE_CONFIG.margin, y - 2, PAGE_CONFIG.contentWidth, 20)
        .fill()
        .restore()

      doc.fillColor(COLORS.primary)
        .fontSize(13)
        .font(FONTS.bold)
        .text(title, PAGE_CONFIG.margin + 10, y)

      doc.moveDown(2)
    }

    function addStatistics(doc: any, motors: any[]) {
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

      const statsColumns = {
        location: { x: PAGE_CONFIG.margin, width: 200 },
        state: { x: PAGE_CONFIG.margin + 200, width: 150 },
        count: { x: PAGE_CONFIG.margin + 350, width: 100 },
      }

      // Stats header
      doc.font(FONTS.bold)
        .fontSize(11)
        .fillColor(COLORS.primary)

      const headerY = doc.y
      doc.save()
        .fillColor(COLORS.background)
        .rect(PAGE_CONFIG.margin, headerY - 5, PAGE_CONFIG.contentWidth, 22)
        .fill()
        .restore()

      doc.text('Locatie', statsColumns.location.x + 10, headerY, {
        width: statsColumns.location.width - 10,
        align: 'left',
      })
      doc.text('Status', statsColumns.state.x, headerY, {
        width: statsColumns.state.width,
        align: 'left',
      })
      doc.text('Aantal', statsColumns.count.x, headerY, {
        width: statsColumns.count.width - 10,
        align: 'right',
      })

      doc.moveDown(1)

      // Stats rows
      const statsList = Object.values(stats).sort((a: any, b: any) => {
        if (a.location !== b.location) return a.location.localeCompare(b.location)
        return a.state.localeCompare(b.state)
      })

      let totalMotors = 0
      statsList.forEach((stat: any, i: number) => {
        if (i % 2 === 0) {
          doc.save()
            .fillColor(COLORS.rowBackground)
            .rect(PAGE_CONFIG.margin, doc.y - 2, PAGE_CONFIG.contentWidth, 20)
            .fill()
            .restore()
        }

        const yPos = doc.y
        doc.font(FONTS.normal)
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(stat.location, statsColumns.location.x + 10, yPos, {
            width: statsColumns.location.width - 10,
            align: 'left',
          })
          .text(stat.state, statsColumns.state.x, yPos, {
            width: statsColumns.state.width,
            align: 'left',
          })
          .text(stat.count.toString(), statsColumns.count.x, yPos, {
            width: statsColumns.count.width - 10,
            align: 'right',
          })

        totalMotors += stat.count
        doc.moveDown(1)
      })

      doc.moveDown(0.5)
      addDivider(doc)

      doc.font(FONTS.bold)
        .fontSize(11)
        .fillColor(COLORS.primary)
        .text('Totaal aantal motoren:', PAGE_CONFIG.margin + 15, doc.y, {
          continued: true,
        })
        .text(` ${totalMotors}`, { align: 'left' })

      doc.moveDown(2)
    }

    function addTableHeader(doc: any) {
      const columns = {
        id: { x: 60, width: 40 },
        motor_nr: { x: 110, width: 100 },
        location: { x: 215, width: 90 },
        state: { x: 310, width: 60 },
        shippingNote: { x: 375, width: 135 },
      }

      const headerY = doc.y
      doc.save()
        .fillColor(COLORS.background)
        .rect(PAGE_CONFIG.margin, headerY - 5, PAGE_CONFIG.contentWidth, 22)
        .fill()
        .restore()

      doc.font(FONTS.bold)
        .fontSize(11)
        .fillColor(COLORS.primary)

      doc.text('ID', columns.id.x, headerY, {
        width: columns.id.width,
        align: 'left',
      })
      doc.text('MotorNr', columns.motor_nr.x, headerY, {
        width: columns.motor_nr.width,
        align: 'left',
      })
      doc.text('Locatie', columns.location.x, headerY, {
        width: columns.location.width,
        align: 'left',
      })
      doc.text('State', columns.state.x, headerY, {
        width: columns.state.width,
        align: 'left',
      })
      doc.text('Verzendnota', columns.shippingNote.x, headerY, {
        width: columns.shippingNote.width,
        align: 'left',
      })

      doc.moveDown(1)
      addDivider(doc)
      return columns
    }

    function addMotorsTable(doc: any, motors: any[]) {
      const columns = addTableHeader(doc)

      doc.font(FONTS.normal)
        .fontSize(10)
        .fillColor(COLORS.text)

      motors.forEach((m: any, i: number) => {
        if (doc.y > PAGE_CONFIG.maxY) {
          doc.addPage()
          addHeader(doc, 'Overzicht Motoren: Momenteel bij Foresco')
          addSectionTitle(doc, 'Motoren in received/packaged status')
          addTableHeader(doc)
        }

        if (i % 2 === 0) {
          doc.save()
            .fillColor(COLORS.rowBackground)
            .rect(PAGE_CONFIG.margin, doc.y - 2, PAGE_CONFIG.contentWidth, 20)
            .fill()
            .restore()
        }

        const yPos = doc.y
        doc.fillColor(COLORS.text)
          .text(m.id?.toString() || '', columns.id.x, yPos, {
            width: columns.id.width,
          })
          .text(m.motor_nr || '', columns.motor_nr.x, yPos, {
            width: columns.motor_nr.width,
          })
          .text(m.location || '', columns.location.x, yPos, {
            width: columns.location.width,
          })
          .text(m.state || '', columns.state.x, yPos, {
            width: columns.state.width,
          })
          .text(m.shipping_note || '', columns.shippingNote.x, yPos, {
            width: columns.shippingNote.width,
          })

        doc.moveDown(1)
      })
    }

    function addFooters(doc: any) {
      const pages = doc.bufferedPageRange()
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i)
        doc.fontSize(9)
          .font(FONTS.normal)
          .fillColor(COLORS.secondary)
          .text(
            `Pagina ${i + 1} van ${pages.count}`,
            PAGE_CONFIG.margin,
            doc.page.height - 50,
            { align: 'center', width: PAGE_CONFIG.contentWidth }
          )
      }
    }

    // Generate PDF
    addHeader(doc, 'Overzicht Motoren: Momenteel bij Foresco')
    addSectionTitle(doc, 'Overzicht Aantallen')
    addStatistics(doc, motors)

    addSectionTitle(doc, 'Motoren in received/packaged status')
    addMotorsTable(doc, motors)

    addFooters(doc)

    doc.end()

    // Wait for PDF to finish
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve())
    })

    const pdfData = Buffer.concat(buffers)

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
          content: pdfData,
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


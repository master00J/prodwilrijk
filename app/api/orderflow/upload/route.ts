import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { withAuth } from '@/lib/api/with-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { extractOrderflowPdfText } from '@/lib/orderflow/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const BUCKET = 'orderflow-documents'
const MAX_PREVIEW_ROWS = 200

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const TEXT_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'message/rfc822',
])

function isPdf(file: File, mimeType: string): boolean {
  return mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'order-document'
}

function inferMimeType(file: File): string {
  if (file.type) return file.type
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lowerName.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (lowerName.endsWith('.csv')) return 'text/csv'
  if (lowerName.endsWith('.eml')) return 'message/rfc822'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  return 'application/octet-stream'
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).replace(/\s+/g, ' ').trim()
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function rowsToMarkdown(rows: unknown[][]): string {
  const visibleRows = rows
    .slice(0, MAX_PREVIEW_ROWS)
    .map(row => row.map(cell => escapeMarkdownCell(stringifyCell(cell))))
    .filter(row => row.some(cell => cell.length > 0))

  if (visibleRows.length === 0) return ''

  const columnCount = Math.max(...visibleRows.map(row => row.length))
  const normalizedRows = visibleRows.map(row => {
    const next = [...row]
    while (next.length < columnCount) next.push('')
    return next
  })
  const header = normalizedRows[0]
  const body = normalizedRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function extractExcelAsMarkdown(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return ''
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    })
    const markdown = rowsToMarkdown(rows)
    return markdown ? `## Sheet: ${sheetName}\n\n${markdown}` : ''
  })
    .filter(Boolean)
    .join('\n\n')
}

async function extractRawText(file: File, buffer: Buffer, mimeType: string): Promise<string | null> {
  if (isPdf(file, mimeType)) {
    return extractOrderflowPdfText(buffer)
  }

  if (EXCEL_MIME_TYPES.has(mimeType) || /\.(xlsx|xls)$/i.test(file.name)) {
    return extractExcelAsMarkdown(buffer)
  }

  if (TEXT_MIME_TYPES.has(mimeType) || /\.(csv|eml|txt)$/i.test(file.name)) {
    return buffer.toString('utf8')
  }

  return null
}

export const GET = withAuth(async () => {
  const { data, error } = await supabaseAdmin
    .from('orderflow_incoming_documents')
    .select('id, source, customer_label, original_filename, mime_type, file_size_bytes, status, error, received_at, created_at')
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ documents: data || [] })
})

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const customerLabel = String(formData.get('customerLabel') || '').trim() || null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload een PDF, Excelbestand, mailbestand of tekstbestand.' }, { status: 400 })
    }

    const mimeType = inferMimeType(file)
    const originalFilename = sanitizeFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    if (!buffer.length) {
      return NextResponse.json({ error: 'Het uploadbestand is leeg.' }, { status: 400 })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 10)
    const filePath = `${user.id}/${timestamp}-${random}-${originalFilename}`
    const rawText = await extractRawText(file, buffer, mimeType)

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: false })

    if (uploadError) {
      console.error('Orderflow upload storage error:', uploadError)
      return NextResponse.json({ error: 'Upload naar opslag mislukt.' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('orderflow_incoming_documents')
      .insert({
        source: 'upload',
        customer_label: customerLabel,
        file_path: filePath,
        mime_type: mimeType,
        original_filename: originalFilename,
        file_size_bytes: buffer.length,
        raw_text: rawText,
        status: 'uploaded',
        uploaded_by: user.id,
      })
      .select('id, status, original_filename, mime_type, file_path, raw_text, created_at')
      .single()

    if (error) {
      console.error('Orderflow upload insert error:', error)
      return NextResponse.json({ error: 'Documentregistratie mislukt.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: {
        id: data.id,
        status: data.status,
        original_filename: data.original_filename,
        mime_type: data.mime_type,
        file_path: data.file_path,
        raw_text_available: Boolean(data.raw_text),
        created_at: data.created_at,
      },
    })
  } catch (error) {
    console.error('Orderflow upload route error:', error)
    return NextResponse.json({ error: 'Orderflow upload mislukt.' }, { status: 500 })
  }
})

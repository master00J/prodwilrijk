import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { generateLumipaperImport, type LumipaperGeneratedFile } from '@/lib/lumipaper/configurator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function stripFileContent(files: LumipaperGeneratedFile[]) {
  return files.map(({ base64, ...file }) => ({
    ...file,
    sizeBytes: Buffer.byteLength(base64, 'base64'),
  }))
}

async function saveImport(params: {
  messageId?: string | null
  subject?: string | null
  sourceEmail?: string | null
  sourceFile?: string | null
  rawText: string
  createdBy?: string | null
}) {
  const result = await generateLumipaperImport(params.rawText)

  const payload = {
    message_id: params.messageId || null,
    order_number: result.orderNumber,
    subject: params.subject || null,
    source_email: params.sourceEmail || null,
    source_file: params.sourceFile || null,
    total_lines: result.totalLines,
    generated_files: result.generatedFiles,
    parsed_lines: result.lines,
    unmapped_lines: result.unmapped,
    status: result.unmapped.length > 0 ? 'partial' : 'processed',
    created_by: params.createdBy || null,
  }

  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .insert(payload)
    .select('id, order_number, subject, source_email, source_file, total_lines, generated_files, parsed_lines, unmapped_lines, status, error, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Deze mail werd al eerder verwerkt.')
    }
    throw new Error(error.message)
  }

  return {
    ...data,
    generated_files: stripFileContent((data.generated_files || []) as LumipaperGeneratedFile[]),
  }
}

export const GET = withAdmin(async () => {
  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .select('id, order_number, subject, source_email, source_file, total_lines, generated_files, parsed_lines, unmapped_lines, status, error, created_at')
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    imports: (data || []).map((row: any) => ({
      ...row,
      generated_files: stripFileContent((row.generated_files || []) as LumipaperGeneratedFile[]),
    })),
  })
})

export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const contentType = request.headers.get('content-type') || ''
    let rawText = ''
    let sourceFile: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Upload een .eml bestand.' }, { status: 400 })
      }
      rawText = await file.text()
      sourceFile = file.name
    } else {
      const body = await request.json().catch(() => null)
      rawText = String(body?.rawText || '')
      sourceFile = body?.sourceFile ? String(body.sourceFile) : null
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Geen mailinhoud ontvangen.' }, { status: 400 })
    }

    const saved = await saveImport({
      rawText,
      sourceFile,
      createdBy: user.email || user.id,
    })

    return NextResponse.json({ success: true, import: saved })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lumipaper import mislukt.' },
      { status: 500 }
    )
  }
})

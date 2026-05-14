import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import type { LumipaperGeneratedFile } from '@/lib/lumipaper/configurator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAdmin(async (
  _request: NextRequest,
  _user,
  { params }: { params: Promise<{ id: string; index: string }> }
) => {
  const { id, index } = await params
  const fileIndex = Number(index)

  if (!Number.isInteger(fileIndex) || fileIndex < 0) {
    return NextResponse.json({ error: 'Ongeldige bestandsindex.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .select('generated_files')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Import niet gevonden.' }, { status: 404 })
  }

  const files = (data.generated_files || []) as LumipaperGeneratedFile[]
  const file = files[fileIndex]
  if (!file?.base64) {
    return NextResponse.json({ error: 'Bestand niet gevonden.' }, { status: 404 })
  }

  const buffer = Buffer.from(file.base64, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
      'Content-Length': String(buffer.length),
    },
  })
})

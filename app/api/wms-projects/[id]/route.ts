import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = Number(params.id)
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('wms_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('wms_project_lines')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    if (linesError) {
      console.error('Error fetching WMS lines:', linesError)
      return NextResponse.json({ error: 'Failed to fetch project lines' }, { status: 500 })
    }

    const lineIds = (lines || []).map((line: any) => line.id)
    let lineImagesById = new Map<number, string[]>()
    let projectImages: string[] = []

    if (lineIds.length > 0) {
      const { data: lineImages } = await supabaseAdmin
        .from('item_images')
        .select('item_id, image_url')
        .eq('item_type', 'wms_project_line')
        .in('item_id', lineIds)

      lineImages?.forEach((img: any) => {
        if (!lineImagesById.has(img.item_id)) {
          lineImagesById.set(img.item_id, [])
        }
        lineImagesById.get(img.item_id)!.push(img.image_url)
      })
    }

    const { data: projectImagesData } = await supabaseAdmin
      .from('item_images')
      .select('image_url')
      .eq('item_type', 'wms_project')
      .eq('item_id', projectId)

    projectImages = (projectImagesData || []).map((img: any) => img.image_url)

    const linesWithImages = (lines || []).map((line: any) => ({
      ...line,
      images: lineImagesById.get(line.id) || [],
    }))

    const response = NextResponse.json({
      project,
      lines: linesWithImages,
      projectImages,
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error fetching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

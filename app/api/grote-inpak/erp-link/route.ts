import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode, normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

function normalizeBouwpakketCode(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return normalizeErpCode(trimmed) || trimmed.toUpperCase()
}

export const dynamic = 'force-dynamic'

// GET - Fetch all ERP LINK entries (query param ?sync_kanban=1 om ontbrekende kisten naar Kanban te syncen)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const syncKanban = searchParams.get('sync_kanban') === '1'

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')
      .order('kistnummer', { ascending: true })

    if (error) {
      throw error
    }

    if (syncKanban && data && data.length > 0) {
      for (const row of data) {
        const kist = normalizeKistnummer(row.kistnummer)
        if (!kist) continue
        const prodLoc = row.productielocatie ? (String(row.productielocatie).toLowerCase().includes('genk') ? 'Genk' : 'Wilrijk') : 'Wilrijk'
        await supabaseAdmin
          .from('grote_inpak_kanban_config')
          .upsert({
            case_type: kist,
            rek_sectie: 'Links',
            rek_niveau: 4,
            rek_kolom: 99,
            productielocatie: prodLoc,
            stapel: 1,
            posities: 1,
            stapels_per_pos: 2,
            verbruik_per_dag: null,
            prioriteit: 'low',
            actief: true,
          }, { onConflict: 'case_type' })
      }
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      ...(syncKanban && { _synced_kanban: true }),
    })
  } catch (error: any) {
    console.error('Error fetching ERP LINK data:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching ERP LINK data' },
      { status: 500 }
    )
  }
}

// POST - Create new ERP LINK entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kistnummer, erp_code, productielocatie, description, stapel, bouwpakket_code } = body

    if (!kistnummer) {
      return NextResponse.json(
        { error: 'kistnummer is required' },
        { status: 400 }
      )
    }

    // Normalize productielocatie
    let normalizedProductielocatie = ''
    if (productielocatie) {
      const normalized = String(productielocatie).toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        normalizedProductielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        normalizedProductielocatie = 'Genk'
      }
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .insert({
        kistnummer: String(kistnummer).trim().toUpperCase(),
        erp_code: erp_code ? String(erp_code).trim() : null,
        productielocatie: normalizedProductielocatie || null,
        description: description ? String(description).trim() : null,
        stapel: stapel !== undefined && stapel !== null ? Math.max(1, Number(stapel) || 1) : 1,
        bouwpakket_code: normalizeBouwpakketCode(bouwpakket_code),
      })
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Kistnummer already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    // Sync naar Kanban config: nieuwe kist moet ook in rekindeling staan voor stock/Excel
    const kistNorm = normalizeKistnummer(kistnummer)
    if (kistNorm) {
      await supabaseAdmin
        .from('grote_inpak_kanban_config')
        .upsert({
          case_type: kistNorm,
          rek_sectie: 'Links',
          rek_niveau: 4,
          rek_kolom: 99,
          productielocatie: normalizedProductielocatie || 'Wilrijk',
          stapel: 1,
          posities: 1,
          stapels_per_pos: 2,
          verbruik_per_dag: null,
          prioriteit: 'low',
          actief: true,
        }, { onConflict: 'case_type' })
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Error creating ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating ERP LINK entry' },
      { status: 500 }
    )
  }
}

// PUT - Update existing ERP LINK entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, kistnummer, erp_code, productielocatie, description, stapel, bouwpakket_code } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Normalize productielocatie
    let normalizedProductielocatie = ''
    if (productielocatie) {
      const normalized = String(productielocatie).toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        normalizedProductielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        normalizedProductielocatie = 'Genk'
      }
    }

    const updateData: any = {}
    if (kistnummer !== undefined) updateData.kistnummer = normalizeKistnummer(kistnummer)
    if (erp_code !== undefined) updateData.erp_code = erp_code ? String(erp_code).trim() : null
    if (productielocatie !== undefined) updateData.productielocatie = normalizedProductielocatie || null
    if (description !== undefined) updateData.description = description ? String(description).trim() : null
    if (stapel !== undefined) updateData.stapel = Math.max(1, Number(stapel) || 1)
    if (bouwpakket_code !== undefined) updateData.bouwpakket_code = normalizeBouwpakketCode(bouwpakket_code)

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Kistnummer already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    // Sync productielocatie naar kanban_config als die velden gewijzigd zijn
    const kistKey = (updateData.kistnummer || data.kistnummer || '').toUpperCase().trim()
    if (kistKey && updateData.productielocatie !== undefined) {
      await supabaseAdmin
        .from('grote_inpak_kanban_config')
        .update({ productielocatie: updateData.productielocatie })
        .eq('case_type', kistKey)
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Error updating ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating ERP LINK entry' },
      { status: 500 }
    )
  }
}

// DELETE - Delete ERP LINK entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('Error deleting ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error deleting ERP LINK entry' },
      { status: 500 }
    )
  }
}



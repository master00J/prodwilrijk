import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  formatKistnummerForErpLink,
  normalizeErpCode,
  normalizeKistnummer,
} from '@/lib/utils/erp-code-normalizer'

function normalizeBouwpakketCode(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return normalizeErpCode(trimmed) || trimmed.toUpperCase()
}

function formatDbError(error: { message?: string; code?: string; details?: string } | null): string {
  const msg = [error?.message, error?.details].filter(Boolean).join(' — ')
  if (
    msg.includes('bouwpakket_code') ||
    error?.code === 'PGRST204' ||
    msg.includes('schema cache')
  ) {
    return 'Kolom bouwpakket_code ontbreekt in de database. Voer migratie 20260520_erp_link_bouwpakket.sql uit in Supabase (SQL Editor).'
  }
  return msg || 'Databasefout'
}

/** Zoek bestaande rij ook bij V/K-varianten (V154 vs K154) zodat upsert geen duplicaat maakt. */
function kistLookupCandidates(kistRaw: string): string[] {
  const trimmed = String(kistRaw || '').trim().replace(/\s+/g, '').toUpperCase()
  if (!trimmed) return []
  const candidates = new Set<string>([trimmed])
  const normalized = normalizeKistnummer(trimmed)
  if (normalized) candidates.add(normalized)
  const m = trimmed.match(/^([KV])(\d+)$/)
  if (m) {
    const num = parseInt(m[2], 10)
    if (num >= 1 && num <= 99) {
      candidates.add(`V${m[2]}`)
      candidates.add(`K${m[2]}`)
    } else if (num >= 100) {
      candidates.add(`K${m[2]}`)
      candidates.add(`V${m[2]}`)
    }
  }
  return [...candidates]
}

async function findExistingErpLinkRow(kistRaw: string, id?: number | null) {
  if (id && Number.isFinite(id) && id > 0) {
    const { data } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (data) return data
  }
  const candidates = kistLookupCandidates(kistRaw)
  if (candidates.length === 0) return null
  const { data } = await supabaseAdmin
    .from('grote_inpak_erp_link')
    .select('*')
    .in('kistnummer', candidates)
    .limit(1)
  return data?.[0] ?? null
}

function buildErpLinkRow(body: {
  kistnummer: string
  erp_code?: unknown
  productielocatie?: unknown
  description?: unknown
  stapel?: unknown
  bouwpakket_code?: unknown
}) {
  const { kistnummer, erp_code, productielocatie, description, stapel, bouwpakket_code } = body

  let normalizedProductielocatie = ''
  if (productielocatie) {
    const normalized = String(productielocatie).toLowerCase().trim()
    if (normalized.includes('wilrijk')) normalizedProductielocatie = 'Wilrijk'
    else if (normalized.includes('genk')) normalizedProductielocatie = 'Genk'
  }

  return {
    kistnummer: formatKistnummerForErpLink(kistnummer),
    erp_code: erp_code ? normalizeErpCode(String(erp_code)) || String(erp_code).trim() : null,
    productielocatie: normalizedProductielocatie || null,
    description: description ? String(description).trim() : null,
    stapel: stapel !== undefined && stapel !== null ? Math.max(1, Number(stapel) || 1) : 1,
    bouwpakket_code: normalizeBouwpakketCode(bouwpakket_code),
  }
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

// POST - Nieuw of bijwerken (zoekt bestaande rij op id én kist-varianten V/K)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kistnummer, id: bodyId } = body

    if (!kistnummer) {
      return NextResponse.json(
        { error: 'kistnummer is required' },
        { status: 400 }
      )
    }

    const row = buildErpLinkRow(body)
    const numericId = bodyId != null ? Number(bodyId) : null
    const existing = await findExistingErpLinkRow(kistnummer, numericId)

    if (!row.kistnummer) {
      return NextResponse.json({ error: 'Kistnummer is ongeldig' }, { status: 400 })
    }

    if (existing?.id) {
      const { data: conflict } = await supabaseAdmin
        .from('grote_inpak_erp_link')
        .select('id, kistnummer')
        .eq('kistnummer', row.kistnummer)
        .neq('id', existing.id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          { error: `Kistnummer ${row.kistnummer} bestaat al (rij id ${conflict.id})` },
          { status: 400 }
        )
      }
    }

    let data
    let error

    if (existing?.id) {
      const oldKist = existing.kistnummer ? String(existing.kistnummer).trim() : ''
      ;({ data, error } = await supabaseAdmin
        .from('grote_inpak_erp_link')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single())

      if (!error && oldKist && oldKist !== row.kistnummer) {
        const oldVariants = new Set([oldKist, ...kistLookupCandidates(oldKist)])
        for (const oldCase of oldVariants) {
          await supabaseAdmin
            .from('grote_inpak_kanban_config')
            .update({ case_type: row.kistnummer })
            .eq('case_type', oldCase)
        }
      }
    } else {
      ;({ data, error } = await supabaseAdmin
        .from('grote_inpak_erp_link')
        .insert(row)
        .select()
        .single())
    }

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Kistnummer bestaat al' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: formatDbError(error) }, { status: 500 })
    }

    const kistNorm = row.kistnummer
    if (kistNorm) {
      await supabaseAdmin
        .from('grote_inpak_kanban_config')
        .upsert({
          case_type: kistNorm,
          rek_sectie: 'Links',
          rek_niveau: 4,
          rek_kolom: 99,
          productielocatie: row.productielocatie || 'Wilrijk',
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
      updated: Boolean(existing?.id),
    })
  } catch (error: any) {
    console.error('Error creating ERP LINK entry:', error)
    return NextResponse.json(
      { error: formatDbError(error) || error.message || 'Error creating ERP LINK entry' },
      { status: 500 }
    )
  }
}

// PUT - Zelfde logica als POST (backwards compatible)
export async function PUT(request: NextRequest) {
  return POST(request)
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



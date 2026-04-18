import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Pair = { item: string; pallet: string }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * POST { pairs: [{ item, pallet }] }
 * Zoekt in packed_items (item_number + po_number = pallet) de meest recente
 * date_packed per (item, pallet) paar.
 *
 * Response: { results: { "<item>\t<pallet>": "<ISO date>" | null } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { pairs?: Pair[] }
    const pairs = Array.isArray(body?.pairs) ? body.pairs : []
    if (pairs.length === 0) {
      return NextResponse.json({ results: {} })
    }

    const uniquePallets = Array.from(
      new Set(pairs.map((p) => String(p.pallet ?? '').trim()).filter(Boolean))
    )

    const packedByKey = new Map<string, string>()

    for (const palletBatch of chunk(uniquePallets, 500)) {
      const { data, error } = await supabaseAdmin
        .from('packed_items')
        .select('item_number, po_number, date_packed')
        .in('po_number', palletBatch)
        .order('date_packed', { ascending: false })

      if (error) {
        console.error('packed-lookup error:', error)
        return NextResponse.json(
          { error: 'Lookup mislukt', details: error.message },
          { status: 500 }
        )
      }

      for (const row of data || []) {
        const key = `${String(row.item_number).trim()}\t${String(row.po_number).trim()}`
        if (!packedByKey.has(key)) {
          packedByKey.set(key, row.date_packed as string)
        }
      }
    }

    const results: Record<string, string | null> = {}
    for (const p of pairs) {
      const key = `${String(p.item ?? '').trim()}\t${String(p.pallet ?? '').trim()}`
      results[key] = packedByKey.get(key) ?? null
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 }
    )
  }
}

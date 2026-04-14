import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [prepackRes, airtecRes, prepackTotalRes, airtecTotalRes] = await Promise.all([
      supabaseAdmin
        .from('items_to_pack')
        .select('id, item_number, po_number, amount, date_added, priority, problem, measurement')
        .eq('packed', false)
        .eq('priority', true)
        .order('date_added', { ascending: true }),
      supabaseAdmin
        .from('items_to_pack_airtec')
        .select('id, beschrijving, item_number, lot_number, kistnummer, divisie, quantity, priority, datum_ontvangen')
        .eq('packed', false)
        .eq('priority', true)
        .order('datum_ontvangen', { ascending: true }),
      supabaseAdmin
        .from('items_to_pack')
        .select('id', { count: 'exact', head: true })
        .eq('packed', false),
      supabaseAdmin
        .from('items_to_pack_airtec')
        .select('id', { count: 'exact', head: true })
        .eq('packed', false),
    ])

    const prepackItems = (prepackRes.data || []).map((item: any) => ({
      source: 'prepack' as const,
      id: item.id,
      label: item.item_number,
      subLabel: item.po_number ? `Pallet ${item.po_number}` : null,
      quantity: item.amount,
      date: item.date_added,
      problem: item.problem || false,
      measurement: item.measurement || false,
    }))

    const airtecItems = (airtecRes.data || []).map((item: any) => ({
      source: 'airtec' as const,
      id: item.id,
      label: item.item_number || item.beschrijving || `#${item.id}`,
      subLabel: [item.kistnummer ? `Kist ${item.kistnummer}` : null, item.lot_number].filter(Boolean).join(' · ') || null,
      quantity: item.quantity,
      date: item.datum_ontvangen,
      problem: false,
      measurement: false,
    }))

    const response = NextResponse.json({
      prepack: prepackItems,
      airtec: airtecItems,
      stats: {
        prepackTotal: prepackTotalRes.count ?? 0,
        airtecTotal: airtecTotalRes.count ?? 0,
        prepackPrio: prepackItems.length,
        airtecPrio: airtecItems.length,
      },
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: unknown) {
    console.error('priorities tv-slides:', error)
    return NextResponse.json({ error: 'Kon prioriteiten niet laden' }, { status: 500 })
  }
}

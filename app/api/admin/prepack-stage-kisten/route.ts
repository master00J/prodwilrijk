import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { aggregateStageKistenNeedForQueue } from '@/lib/prepack/stage-kisten-stock'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 600

export const GET = withAdmin(async () => {
  try {
    const { data: queueItems, error } = await supabaseAdmin
      .from('items_to_pack')
      .select('item_number, amount')
      .eq('packed', false)
      .limit(MAX_ROWS)

    if (error) throw error

    const rows = queueItems || []
    const { totals, perItem } = await aggregateStageKistenNeedForQueue(rows)

    return NextResponse.json({
      totals,
      perItem,
      queueLineCount: rows.length,
      capped: rows.length >= MAX_ROWS,
    })
  } catch (e: any) {
    console.error('prepack-stage-kisten GET:', e)
    return NextResponse.json({ error: e?.message || 'Serverfout' }, { status: 500 })
  }
})

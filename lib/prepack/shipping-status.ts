import { supabaseAdmin } from '@/lib/supabase/server'

function normalizePackageNo(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text.toUpperCase() : null
}

export async function markItemsToPackShippedForPackageNos(values: unknown[]) {
  const packageNos = [...new Set(values.map(normalizePackageNo).filter(Boolean) as string[])]
  if (packageNos.length === 0) return { updated: 0 }

  let updated = 0

  for (const packageNo of packageNos) {
    const { data: latestScan } = await supabaseAdmin
      .from('prepack_scans')
      .select('id, created_at')
      .ilike('code', packageNo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const update: Record<string, unknown> = {
      shipping_status: 'shipped',
      shipped_at: latestScan?.created_at || new Date().toISOString(),
    }
    if (latestScan?.id) update.shipped_scan_id = latestScan.id

    const { data, error } = await supabaseAdmin
      .from('items_to_pack')
      .update(update)
      .ilike('current_package_no', packageNo)
      .eq('packed', false)
      .select('id')

    if (error) {
      console.error('markItemsToPackShippedForPackageNos:', error)
      continue
    }

    updated += data?.length || 0

    const { data: packedData, error: packedError } = await supabaseAdmin
      .from('packed_items')
      .update(update)
      .ilike('current_package_no', packageNo)
      .select('id')

    if (packedError) {
      console.error('markPackedItemsShippedForPackageNos:', packedError)
      continue
    }

    updated += packedData?.length || 0
  }

  return { updated }
}


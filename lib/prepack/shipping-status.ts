import { supabaseAdmin } from '@/lib/supabase/server'

function normalizePackageNo(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text.toUpperCase() : null
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const current = next
      next += 1
      results[current] = await fn(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

type MarkShippedOptions = {
  shippedAt?: string
  shippedAtByPackageNo?: Map<string, string>
  skipScanLookup?: boolean
  onlyScansSince?: string
}

export async function markItemsToPackShippedForPackageNos(
  values: unknown[],
  options: MarkShippedOptions = {}
) {
  const packageNos = [...new Set(values.map(normalizePackageNo).filter(Boolean) as string[])]
  if (packageNos.length === 0) return { updated: 0 }

  const latestScanByPackageNo = new Map<string, { id: number; created_at: string }>()

  if (options.skipScanLookup) {
    for (const packageNo of packageNos) {
      const shippedAt =
        options.shippedAtByPackageNo?.get(packageNo) ||
        options.shippedAt ||
        new Date().toISOString()
      latestScanByPackageNo.set(packageNo, { id: 0, created_at: shippedAt })
    }
  } else {
    for (const packageChunk of chunk(packageNos, 500)) {
      let query = supabaseAdmin
        .from('prepack_scans')
        .select('id, code, created_at')
        .in('code', packageChunk)
        .order('created_at', { ascending: false })

      if (options.onlyScansSince) {
        query = query.gte('created_at', options.onlyScansSince)
      }

      const { data: scans, error } = await query

      if (error) {
        console.error('markItemsToPackShippedForPackageNos scans:', error)
        continue
      }

      for (const scan of scans || []) {
        const key = normalizePackageNo(scan.code)
        if (key && !latestScanByPackageNo.has(key)) {
          latestScanByPackageNo.set(key, { id: scan.id, created_at: scan.created_at })
        }
      }
    }
  }

  const scannedPackageNos = packageNos.filter((packageNo) => latestScanByPackageNo.has(packageNo))
  if (scannedPackageNos.length === 0) return { updated: 0 }

  const counts = await mapWithConcurrency(scannedPackageNos, 20, async (packageNo) => {
    const latestScan = latestScanByPackageNo.get(packageNo)
    if (!latestScan) return 0

    const update: Record<string, unknown> = {
      shipping_status: 'shipped',
      shipped_at: latestScan.created_at,
    }
    if (latestScan.id > 0) update.shipped_scan_id = latestScan.id

    const [openResult, packedResult] = await Promise.all([
      supabaseAdmin
        .from('items_to_pack')
        .update(update)
        .ilike('current_package_no', packageNo)
        .eq('packed', false)
        .select('id'),
      supabaseAdmin
        .from('packed_items')
        .update(update)
        .ilike('current_package_no', packageNo)
        .select('id'),
    ])

    if (openResult.error) {
      console.error('markItemsToPackShippedForPackageNos:', openResult.error)
    }
    if (packedResult.error) {
      console.error('markPackedItemsShippedForPackageNos:', packedResult.error)
    }

    return (openResult.data?.length || 0) + (packedResult.data?.length || 0)
  })

  return { updated: counts.reduce((sum, count) => sum + count, 0) }
}


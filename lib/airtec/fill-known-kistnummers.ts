import { supabaseAdmin } from '@/lib/supabase/server'
import type { AirtecIncomingExcelRow } from '@/lib/airtec/parse-incoming-excel'

type AirtecIncomingRow = AirtecIncomingExcelRow

function normalizeItemNumber(value: string | null): string | null {
  if (!value) return null
  return value.replace(/[\s\-\.]/g, '').toUpperCase() || null
}

function normalizeKistnummer(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (!text || text === '0') return null
  return text.slice(-3)
}

export async function fillKnownAirtecKistnummers<T extends AirtecIncomingRow>(rows: T[]): Promise<T[]> {
  const missingKistItemNumbers = Array.from(
    new Set(
      rows
        .filter(row => !row.kistnummer)
        .map(row => normalizeItemNumber(row.item_number))
        .filter((itemNumber): itemNumber is string => Boolean(itemNumber))
    )
  )

  if (missingKistItemNumbers.length === 0) return rows

  const { data, error } = await supabaseAdmin
    .from('packed_items_airtec')
    .select('item_number,kistnummer,date_packed')
    .not('kistnummer', 'is', null)
    .order('date_packed', { ascending: false })

  if (error) throw error

  const latestKistByItem = new Map<string, string>()
  for (const packedItem of data || []) {
    const itemNumber = normalizeItemNumber(packedItem.item_number)
    const kistnummer = normalizeKistnummer(packedItem.kistnummer)
    if (!itemNumber || !kistnummer || latestKistByItem.has(itemNumber)) continue
    latestKistByItem.set(itemNumber, kistnummer)
  }

  return rows.map(row => {
    if (row.kistnummer) return row

    const itemNumber = normalizeItemNumber(row.item_number)
    const knownKistnummer = itemNumber ? latestKistByItem.get(itemNumber) : null
    return knownKistnummer ? { ...row, kistnummer: knownKistnummer } : row
  })
}

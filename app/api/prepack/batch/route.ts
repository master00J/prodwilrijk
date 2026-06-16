import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { markItemsToPackShippedForPackageNos } from '@/lib/prepack/shipping-status'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Entry = {
  /** Stabiele UUID vanuit de client, gebruikt voor idempotente upsert. */
  client_id?: string | null
  ts?: string
  code: string
  location?: string
  note?: string
}

function parseScanTimestamp(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null

  // Nieuwe scans worden lokaal als "YYYY-MM-DD HH:mm:ss" opgeslagen op de tablet.
  // Interpreteer die als Brussels-tijd; shipped_at moet het scanmoment zijn, niet
  // het latere syncmoment.
  const localMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (localMatch) {
    const [, year, month, day, hour, minute, second = '00'] = localMatch
    const utcGuess = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ))
    // Europe/Brussels is UTC+1 of UTC+2. Bepaal de offset rond dit moment via Intl.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcGuess)
    const brusselsAsUtc = Date.UTC(
      Number(parts.find((p) => p.type === 'year')?.value),
      Number(parts.find((p) => p.type === 'month')?.value) - 1,
      Number(parts.find((p) => p.type === 'day')?.value),
      Number(parts.find((p) => p.type === 'hour')?.value),
      Number(parts.find((p) => p.type === 'minute')?.value),
      Number(parts.find((p) => p.type === 'second')?.value)
    )
    const offsetMs = brusselsAsUtc - utcGuess.getTime()
    return new Date(utcGuess.getTime() - offsetMs).toISOString()
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entries: Entry[] = Array.isArray(body?.entries) ? body.entries : []
    const employeeId = body?.employee_id ?? null
    const sessionId = body?.session_id ?? null

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Geen entries' }, { status: 400 })
    }

    const rows = entries
      .map((e) => ({
        client_id: e.client_id ? String(e.client_id) : null,
        ts: e.ts || null,
        code: String(e.code || '').trim(),
        location: e.location || null,
        note: e.note || null,
        employee_id: employeeId ? Number(employeeId) : null,
        session_id: sessionId ? Number(sessionId) : null,
        created_at: new Date().toISOString(),
      }))
      .filter((r) => r.code)

    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, synced_client_ids: [] })
    }

    // Wanneer de client een client_id meestuurt gebruiken we upsert zodat een
    // retry na een mislukte response (waarbij de insert wel al gelukt was)
    // geen dubbele rij oplevert. Rijen zonder client_id vallen terug op een
    // normale insert (oud gedrag).
    const rowsWithId = rows.filter((r) => r.client_id)
    const rowsWithoutId = rows.filter((r) => !r.client_id)

    if (rowsWithId.length > 0) {
      const { error } = await supabaseAdmin
        .from('prepack_scans')
        .upsert(rowsWithId, { onConflict: 'client_id', ignoreDuplicates: false })
      if (error) {
        console.error('prepack/batch upsert error, retrying without client_id:', error)
        // Fallback voor omgevingen waar de client_id migratie nog niet is toegepast.
        // Liever mogelijk een dubbele legacy-scan dan dat de scanner op 500 blijft hangen.
        const fallbackRows = rowsWithId.map(({ client_id, ...row }) => row)
        const { error: fallbackError } = await supabaseAdmin
          .from('prepack_scans')
          .insert(fallbackRows)
        if (fallbackError) {
          console.error('prepack/batch fallback insert error:', fallbackError)
          return NextResponse.json({ success: false }, { status: 500 })
        }
      }
    }

    if (rowsWithoutId.length > 0) {
      const { error } = await supabaseAdmin.from('prepack_scans').insert(rowsWithoutId)
      if (error) {
        console.error('prepack/batch insert error:', error)
        return NextResponse.json({ success: false }, { status: 500 })
      }
    }

    let shippedItemsUpdated = 0
    try {
      const shippedAtByPackageNo = new Map<string, string>()
      for (const row of rows) {
        const code = String(row.code || '').trim().toUpperCase()
        if (!code) continue
        const shippedAt = parseScanTimestamp(row.ts) || row.created_at
        const existing = shippedAtByPackageNo.get(code)
        if (!existing || shippedAt > existing) shippedAtByPackageNo.set(code, shippedAt)
      }
      const shippedResult = await markItemsToPackShippedForPackageNos(rows.map((r) => r.code), {
        shippedAt: new Date().toISOString(),
        shippedAtByPackageNo,
        skipScanLookup: true,
      })
      shippedItemsUpdated = shippedResult.updated
    } catch (error) {
      // Shipped-status is verrijking. Scan-sync zelf mag hierdoor nooit falen.
      console.error('prepack/batch shipped status update skipped:', error)
    }

    return NextResponse.json({
      success: true,
      inserted: rows.length,
      synced_client_ids: rowsWithId.map((r) => r.client_id),
      shipped_items_updated: shippedItemsUpdated,
    })
  } catch (error) {
    console.error('prepack/batch error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

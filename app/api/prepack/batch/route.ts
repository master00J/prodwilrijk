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
        console.error('prepack/batch upsert error:', error)
        return NextResponse.json({ success: false }, { status: 500 })
      }
    }

    if (rowsWithoutId.length > 0) {
      const { error } = await supabaseAdmin.from('prepack_scans').insert(rowsWithoutId)
      if (error) {
        console.error('prepack/batch insert error:', error)
        return NextResponse.json({ success: false }, { status: 500 })
      }
    }

    const shippedResult = await markItemsToPackShippedForPackageNos(rows.map((r) => r.code))

    return NextResponse.json({
      success: true,
      inserted: rows.length,
      synced_client_ids: rowsWithId.map((r) => r.client_id),
      shipped_items_updated: shippedResult.updated,
    })
  } catch (error) {
    console.error('prepack/batch error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

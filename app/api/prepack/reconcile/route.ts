import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Candidate = {
  ts: string
  code: string
  location?: string | null
}

/**
 * Reconcile-endpoint voor legacy scans die vóór de offline-first update zijn
 * gedaan. De tablet stuurt alle (ts, code, location) triples die hij lokaal
 * heeft staan en wij antwoorden welke daarvan al in prepack_scans zitten.
 *
 * De client gebruikt dit antwoord om lokaal de juiste scans als "synced" te
 * markeren zonder ze opnieuw te uploaden (duplicaten vermijden).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const candidates: Candidate[] = Array.isArray(body?.entries) ? body.entries : []
    if (candidates.length === 0) {
      return NextResponse.json({ matched: [] })
    }

    // Alleen candidates met een echte ts reconciliëren — zonder tijdstempel is
    // een (code, location)-paar niet uniek genoeg en lopen we het risico
    // oudere scans verkeerd als "al verzonden" te markeren.
    const withTs = candidates
      .map((c) => ({
        ts: String(c.ts || '').trim(),
        code: String(c.code || '').trim(),
        location: c.location ? String(c.location) : null,
      }))
      .filter((c) => c.ts && c.code)

    if (withTs.length === 0) {
      return NextResponse.json({ matched: [] })
    }

    // We filteren server-side op de set van timestamp-waarden die de client
    // heeft, en vergelijken nadien in JS zodat onze query simpel blijft. De
    // hoeveelheid scans per tablet is klein (paar honderd) dus dit schaalt
    // ruim voldoende.
    const uniqueTs = Array.from(new Set(withTs.map((c) => c.ts)))
    const uniqueCodes = Array.from(new Set(withTs.map((c) => c.code)))

    const { data, error } = await supabaseAdmin
      .from('prepack_scans')
      .select('ts, code, location')
      .in('ts', uniqueTs)
      .in('code', uniqueCodes)
    if (error) {
      console.error('prepack/reconcile error:', error)
      return NextResponse.json({ matched: [], error: 'db_error' }, { status: 500 })
    }

    const dbSet = new Set<string>()
    for (const row of data || []) {
      dbSet.add(`${row.ts}||${row.code}||${row.location ?? ''}`)
    }

    const matched = withTs
      .filter((c) => dbSet.has(`${c.ts}||${c.code}||${c.location ?? ''}`))
      .map((c) => ({ ts: c.ts, code: c.code, location: c.location }))

    return NextResponse.json({ matched })
  } catch (error) {
    console.error('prepack/reconcile error:', error)
    return NextResponse.json({ matched: [], error: 'internal' }, { status: 500 })
  }
}

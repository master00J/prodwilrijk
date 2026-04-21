import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MappingRow {
  old_code: string
  new_code: string
  description: string | null
  updated_at?: string
}

// GET /api/admin/bc-mappings — volledige lijst met optionele search (old of new code).
export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(Number(searchParams.get('limit') || 1000), 10000)

    let query = supabaseAdmin
      .from('bc_item_mapping')
      .select('old_code,new_code,description,updated_at')
      .order('old_code', { ascending: true })
      .limit(limit)

    if (q) {
      // ILIKE op old_code OR new_code OR description
      query = query.or(
        `old_code.ilike.%${q}%,new_code.ilike.%${q}%,description.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ mappings: data || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

// POST /api/admin/bc-mappings — bulk upsert.
// Body: { mappings: [{ old_code, new_code, description? }], replace?: boolean }
// Als replace=true wordt eerst de hele tabel geleegd.
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      mappings?: Array<Partial<MappingRow>>
      replace?: boolean
    }
    const rows = Array.isArray(body.mappings) ? body.mappings : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Geen mappings meegegeven' }, { status: 400 })
    }

    const clean: MappingRow[] = []
    for (const r of rows) {
      const oldCode = String(r.old_code ?? '').trim()
      const newCode = String(r.new_code ?? '').trim()
      if (!oldCode || !newCode) continue
      clean.push({
        old_code: oldCode,
        new_code: newCode,
        description: r.description != null ? String(r.description).trim() || null : null,
      })
    }
    if (clean.length === 0) {
      return NextResponse.json({ error: 'Geen geldige rijen (old_code en new_code vereist)' }, { status: 400 })
    }

    if (body.replace) {
      // neq 'x' → alles matchen; we kunnen niet truncate via rest-api, dus bulk-delete.
      const { error: delErr } = await supabaseAdmin
        .from('bc_item_mapping')
        .delete()
        .neq('old_code', '__never_matches__')
      if (delErr) throw delErr
    }

    // Upsert in chunks (supabase heeft een limiet rond 1000 rijen per call).
    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < clean.length; i += chunkSize) {
      const chunk = clean.slice(i, i + chunkSize).map((r) => ({
        ...r,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabaseAdmin
        .from('bc_item_mapping')
        .upsert(chunk, { onConflict: 'old_code' })
      if (error) throw error
      inserted += chunk.length
    }

    return NextResponse.json({ success: true, count: inserted })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

// DELETE /api/admin/bc-mappings?old_code=GP000004 — enkele rij of alles (?all=true).
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const oldCode = searchParams.get('old_code')
    const all = searchParams.get('all')

    if (all === 'true') {
      const { error } = await supabaseAdmin
        .from('bc_item_mapping')
        .delete()
        .neq('old_code', '__never_matches__')
      if (error) throw error
      return NextResponse.json({ success: true, cleared: true })
    }

    if (!oldCode) {
      return NextResponse.json({ error: 'old_code vereist' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bc_item_mapping')
      .delete()
      .eq('old_code', oldCode)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

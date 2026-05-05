import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { SawSharpeningLine, SawSharpeningRound } from '@/types/database'

export const dynamic = 'force-dynamic'

const lineInputSchema = z.object({
  description: z.string().min(1, 'Omschrijving is verplicht').max(500),
  quantity_pickup: z.number().int().min(0),
  quantity_return: z.number().int().min(0).nullable().optional(),
  sort_order: z.number().int().optional(),
})

const postSchema = z.object({
  pickup_at: z.string().min(4).optional(),
  return_at: z.string().min(4).nullable().optional(),
  driver_name: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lines: z.array(lineInputSchema).min(1, 'Minstens één regel'),
})

async function attachLines(rounds: SawSharpeningRound[]): Promise<SawSharpeningRound[]> {
  if (rounds.length === 0) return rounds
  const ids = rounds.map(r => r.id)
  const { data: lines, error } = await supabaseAdmin
    .from('saw_sharpening_lines')
    .select('*')
    .in('round_id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw error

  const byRound = new Map<number, SawSharpeningLine[]>()
  for (const row of lines || []) {
    const list = byRound.get(row.round_id) || []
    list.push(row as SawSharpeningLine)
    byRound.set(row.round_id, list)
  }

  return rounds.map(r => ({
    ...r,
    photo_urls: Array.isArray(r.photo_urls) ? r.photo_urls : [],
    lines: byRound.get(r.id) || [],
  }))
}

export async function GET() {
  try {
    const { data: rounds, error } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .select('*')
      .order('pickup_at', { ascending: false })

    if (error) throw error

    const merged = await attachLines((rounds || []) as SawSharpeningRound[])
    return NextResponse.json({ rounds: merged })
  } catch (e) {
    console.error('saw-sharpening GET rounds', e)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = postSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { pickup_at, return_at, driver_name, notes, lines } = parsed.data

    const { data: round, error: insErr } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .insert({
        pickup_at: pickup_at || new Date().toISOString(),
        return_at: return_at ?? null,
        driver_name: driver_name ?? null,
        notes: notes ?? null,
        photo_urls: [],
      })
      .select()
      .single()

    if (insErr || !round) {
      console.error(insErr)
      return NextResponse.json({ error: 'Aanmaken ronde mislukt' }, { status: 500 })
    }

    const lineRows = lines.map((l, i) => ({
      round_id: round.id,
      sort_order: l.sort_order ?? i,
      description: l.description.trim(),
      quantity_pickup: l.quantity_pickup,
      quantity_return: l.quantity_return === undefined ? null : l.quantity_return,
    }))

    const { error: lineErr } = await supabaseAdmin.from('saw_sharpening_lines').insert(lineRows)

    if (lineErr) {
      await supabaseAdmin.from('saw_sharpening_rounds').delete().eq('id', round.id)
      console.error(lineErr)
      return NextResponse.json({ error: 'Regels opslaan mislukt' }, { status: 500 })
    }

    const [withLines] = await attachLines([round as SawSharpeningRound])
    return NextResponse.json({ round: withLines })
  } catch (e) {
    console.error('saw-sharpening POST', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

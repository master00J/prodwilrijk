import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { SawSharpeningLine, SawSharpeningRound } from '@/types/database'

export const dynamic = 'force-dynamic'

const lineInputSchema = z.object({
  description: z.string().min(1).max(500),
  quantity_pickup: z.number().int().min(0),
  quantity_return: z.number().int().min(0).nullable().optional(),
  sort_order: z.number().int().optional(),
})

const patchSchema = z.object({
  pickup_at: z.string().min(4).optional(),
  return_at: z.string().min(4).nullable().optional(),
  driver_name: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lines: z.array(lineInputSchema).min(1),
})

async function oneWithLines(id: number): Promise<SawSharpeningRound | null> {
  const { data: round, error } = await supabaseAdmin
    .from('saw_sharpening_rounds')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !round) return null

  const { data: lines } = await supabaseAdmin
    .from('saw_sharpening_lines')
    .select('*')
    .eq('round_id', id)
    .order('sort_order', { ascending: true })

  return {
    ...(round as SawSharpeningRound),
    photo_urls: Array.isArray(round.photo_urls) ? round.photo_urls : [],
    lines: (lines || []) as SawSharpeningLine[],
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

    const round = await oneWithLines(id)
    if (!round) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    return NextResponse.json({ round })
  } catch (e) {
    console.error('saw-sharpening GET id', e)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

    const json = await request.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { pickup_at, return_at, driver_name, notes, lines } = parsed.data

    const updatePayload: Record<string, unknown> = {}
    if (pickup_at !== undefined) updatePayload.pickup_at = pickup_at
    if (return_at !== undefined) updatePayload.return_at = return_at
    if (driver_name !== undefined) updatePayload.driver_name = driver_name
    if (notes !== undefined) updatePayload.notes = notes

    if (Object.keys(updatePayload).length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from('saw_sharpening_rounds')
        .update(updatePayload)
        .eq('id', id)

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: 'Ronde bijwerken mislukt' }, { status: 500 })
      }
    }

    const { error: delErr } = await supabaseAdmin.from('saw_sharpening_lines').delete().eq('round_id', id)
    if (delErr) {
      console.error(delErr)
      return NextResponse.json({ error: 'Oude regels wissen mislukt' }, { status: 500 })
    }

    const lineRows = lines.map((l, i) => ({
      round_id: id,
      sort_order: l.sort_order ?? i,
      description: l.description.trim(),
      quantity_pickup: l.quantity_pickup,
      quantity_return: l.quantity_return === undefined ? null : l.quantity_return,
    }))

    const { error: insErr } = await supabaseAdmin.from('saw_sharpening_lines').insert(lineRows)
    if (insErr) {
      console.error(insErr)
      return NextResponse.json({ error: 'Regels opslaan mislukt' }, { status: 500 })
    }

    const round = await oneWithLines(id)
    return NextResponse.json({ round })
  } catch (e) {
    console.error('saw-sharpening PATCH', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

    const { error } = await supabaseAdmin.from('saw_sharpening_rounds').delete().eq('id', id)
    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('saw-sharpening DELETE', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

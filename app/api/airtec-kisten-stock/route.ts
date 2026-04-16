import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth, withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async () => {
  const { data, error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .select('*')
    .order('kistnummer', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Fout bij ophalen stock' }, { status: 500 })
  }

  const enriched = (data || []).map((row: any) => ({
    ...row,
    te_bestellen: Math.max(0, (row.minimum_voorraad || 0) - (row.huidige_voorraad || 0)),
  }))

  return NextResponse.json({ data: enriched })
})

export const POST = withAdmin(async (request) => {
  const body = await request.json()
  const { kistnummer, erp_code, huidige_voorraad, minimum_voorraad } = body

  if (!kistnummer) {
    return NextResponse.json({ error: 'Kistnummer is verplicht' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .insert({
      kistnummer: String(kistnummer).trim(),
      erp_code: erp_code ? String(erp_code).trim() : null,
      huidige_voorraad: Number(huidige_voorraad) || 0,
      minimum_voorraad: Number(minimum_voorraad) || 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Kistnummer bestaat al' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Fout bij toevoegen' }, { status: 500 })
  }

  return NextResponse.json({ data })
})

export const PUT = withAdmin(async (request) => {
  const body = await request.json()
  const { id, kistnummer, erp_code, huidige_voorraad, minimum_voorraad } = body

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (kistnummer !== undefined) update.kistnummer = String(kistnummer).trim()
  if (erp_code !== undefined) update.erp_code = erp_code ? String(erp_code).trim() : null
  if (huidige_voorraad !== undefined) update.huidige_voorraad = Math.max(0, Number(huidige_voorraad) || 0)
  if (minimum_voorraad !== undefined) update.minimum_voorraad = Math.max(0, Number(minimum_voorraad) || 0)

  const { data, error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fout bij updaten' }, { status: 500 })
  }

  return NextResponse.json({ data })
})

export const DELETE = withAdmin(async (request) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .delete()
    .eq('id', Number(id))

  if (error) {
    return NextResponse.json({ error: 'Fout bij verwijderen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

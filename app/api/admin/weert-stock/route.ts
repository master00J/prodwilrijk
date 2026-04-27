import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'

const STATUSES = ['in_stock', 'reserved', 'shipped', 'damaged'] as const

function text(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function positiveNumber(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function dateOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function normalizeStatus(value: unknown) {
  const normalized = String(value ?? 'in_stock').trim()
  return STATUSES.includes(normalized as any) ? normalized : 'in_stock'
}

function searchTerm(value: string) {
  return value.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const GET = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchTerm(String(searchParams.get('search') || ''))
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')

    const { data: customers, error: customersError } = await supabaseAdmin
      .from('weert_customers')
      .select('*')
      .order('name', { ascending: true })

    if (customersError) throw customersError

    let query = supabaseAdmin
      .from('weert_stock_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', Number(customerId))
    if (status && STATUSES.includes(status as any)) query = query.eq('status', status)
    if (search) {
      query = query.or(
        `item_code.ilike.%${search}%,description.ilike.%${search}%,pallet_or_package.ilike.%${search}%,location.ilike.%${search}%`
      )
    }

    const { data: items, error: itemsError } = await query
    if (itemsError) throw itemsError

    const customerMap = new Map((customers || []).map((customer: any) => [customer.id, customer]))
    const enrichedItems = (items || []).map((item: any) => ({
      ...item,
      min_stock: Number(item.min_stock) || 0,
      max_stock: Number(item.max_stock) || 0,
      reorder_shortage: Math.max(0, (Number(item.min_stock) || 0) - (Number(item.quantity) || 0)),
      reorder_quantity:
        (Number(item.quantity) || 0) < (Number(item.min_stock) || 0)
          ? Math.max(0, (Number(item.max_stock) || 0) - (Number(item.quantity) || 0))
          : 0,
      customer: item.customer_id ? customerMap.get(item.customer_id) || null : null,
    }))

    const summary = enrichedItems.reduce(
      (acc: any, item: any) => {
        acc.totalLines += 1
        acc.totalQuantity += Number(item.quantity) || 0
        acc.totalToOrder += Number(item.reorder_quantity) || 0
        if ((Number(item.reorder_quantity) || 0) > 0) acc.linesToOrder += 1
        acc.byStatus[item.status] = (acc.byStatus[item.status] || 0) + (Number(item.quantity) || 0)
        return acc
      },
      { totalLines: 0, totalQuantity: 0, totalToOrder: 0, linesToOrder: 0, byStatus: {} }
    )

    return NextResponse.json({ customers: customers || [], items: enrichedItems, summary })
  } catch (error) {
    logApiError(error, { route: '/api/admin/weert-stock', method: 'GET' })
    return NextResponse.json({ error: 'Fout bij ophalen Weert stock' }, { status: 500 })
  }
})

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json()

    if (body.type === 'customer') {
      const name = text(body.name)
      if (!name) return NextResponse.json({ error: 'Klantnaam is verplicht' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('weert_customers')
        .insert({
          name,
          contact_name: text(body.contact_name),
          email: text(body.email),
          phone: text(body.phone),
          notes: text(body.notes),
          active: body.active !== false,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Deze klant bestaat al' }, { status: 409 })
        }
        throw error
      }

      return NextResponse.json({ data })
    }

    if (body.type === 'item') {
      const description = text(body.description)
      if (!description) return NextResponse.json({ error: 'Omschrijving is verplicht' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('weert_stock_items')
        .insert({
          customer_id: body.customer_id ? Number(body.customer_id) : null,
          item_code: text(body.item_code),
          description,
          pallet_or_package: text(body.pallet_or_package),
          quantity: positiveNumber(body.quantity),
          min_stock: positiveNumber(body.min_stock),
          max_stock: positiveNumber(body.max_stock),
          unit: text(body.unit) || 'stuks',
          location: text(body.location),
          status: normalizeStatus(body.status),
          received_at: dateOrNull(body.received_at),
          last_counted_at: dateOrNull(body.last_counted_at),
          notes: text(body.notes),
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
  } catch (error) {
    logApiError(error, { route: '/api/admin/weert-stock', method: 'POST' })
    return NextResponse.json({ error: 'Fout bij opslaan Weert stock' }, { status: 500 })
  }
})

export const PUT = withAdmin(async (request) => {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

    if (body.type === 'customer') {
      const update: Record<string, any> = { updated_at: new Date().toISOString() }
      if (body.name !== undefined) update.name = text(body.name)
      if (body.contact_name !== undefined) update.contact_name = text(body.contact_name)
      if (body.email !== undefined) update.email = text(body.email)
      if (body.phone !== undefined) update.phone = text(body.phone)
      if (body.notes !== undefined) update.notes = text(body.notes)
      if (body.active !== undefined) update.active = Boolean(body.active)

      const { data, error } = await supabaseAdmin
        .from('weert_customers')
        .update(update)
        .eq('id', Number(body.id))
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    if (body.type === 'item') {
      const update: Record<string, any> = { updated_at: new Date().toISOString() }
      if (body.customer_id !== undefined) update.customer_id = body.customer_id ? Number(body.customer_id) : null
      if (body.item_code !== undefined) update.item_code = text(body.item_code)
      if (body.description !== undefined) update.description = text(body.description)
      if (body.pallet_or_package !== undefined) update.pallet_or_package = text(body.pallet_or_package)
      if (body.quantity !== undefined) update.quantity = positiveNumber(body.quantity)
      if (body.min_stock !== undefined) update.min_stock = positiveNumber(body.min_stock)
      if (body.max_stock !== undefined) update.max_stock = positiveNumber(body.max_stock)
      if (body.unit !== undefined) update.unit = text(body.unit) || 'stuks'
      if (body.location !== undefined) update.location = text(body.location)
      if (body.status !== undefined) update.status = normalizeStatus(body.status)
      if (body.received_at !== undefined) update.received_at = dateOrNull(body.received_at)
      if (body.last_counted_at !== undefined) update.last_counted_at = dateOrNull(body.last_counted_at)
      if (body.notes !== undefined) update.notes = text(body.notes)

      const { data, error } = await supabaseAdmin
        .from('weert_stock_items')
        .update(update)
        .eq('id', Number(body.id))
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
  } catch (error) {
    logApiError(error, { route: '/api/admin/weert-stock', method: 'PUT' })
    return NextResponse.json({ error: 'Fout bij updaten Weert stock' }, { status: 500 })
  }
})

export const DELETE = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')
    if (!type || !id) return NextResponse.json({ error: 'Type en ID zijn verplicht' }, { status: 400 })

    if (type === 'customer') {
      const { count, error: countError } = await supabaseAdmin
        .from('weert_stock_items')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', Number(id))

      if (countError) throw countError
      if ((count || 0) > 0) {
        return NextResponse.json(
          { error: 'Deze klant heeft nog stocklijnen. Zet de klant eventueel op inactief.' },
          { status: 409 }
        )
      }

      const { error } = await supabaseAdmin.from('weert_customers').delete().eq('id', Number(id))
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'item') {
      const { error } = await supabaseAdmin.from('weert_stock_items').delete().eq('id', Number(id))
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
  } catch (error) {
    logApiError(error, { route: '/api/admin/weert-stock', method: 'DELETE' })
    return NextResponse.json({ error: 'Fout bij verwijderen Weert stock' }, { status: 500 })
  }
})

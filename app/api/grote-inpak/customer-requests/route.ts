import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES = ['open', 'waiting_forecast', 'on_pils'] as const
const ALL_STATUSES = [...ACTIVE_STATUSES, 'handled', 'cancelled'] as const

type CustomerRequestStatus = (typeof ALL_STATUSES)[number]

function normalizeStatus(value: unknown): CustomerRequestStatus {
  const status = String(value || 'open').trim()
  return ALL_STATUSES.includes(status as CustomerRequestStatus)
    ? (status as CustomerRequestStatus)
    : 'open'
}

function normalizeText(value: unknown): string | null {
  const text = value == null ? '' : String(value).trim()
  return text || null
}

function normalizeCaseLabel(value: unknown): string {
  return String(value || '').trim()
}

function parseCaseLabels(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
}

function rowFromBody(body: Record<string, unknown>) {
  const status = normalizeStatus(body.status)
  return {
    case_label: normalizeCaseLabel(body.case_label),
    case_type: normalizeText(body.case_type),
    customer_name: normalizeText(body.customer_name),
    request_text: normalizeText(body.request_text),
    requested_action: normalizeText(body.requested_action),
    status,
    due_date: normalizeText(body.due_date),
    created_from: normalizeText(body.created_from) || 'forecast',
    resolved_at: status === 'handled' || status === 'cancelled' ? new Date().toISOString() : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const caseLabel = normalizeCaseLabel(searchParams.get('case_label'))
    const caseLabels = parseCaseLabels(searchParams.get('case_labels'))
    const status = searchParams.get('status')
    const activeOnly = searchParams.get('active') !== '0'

    let query = supabaseAdmin
      .from('grote_inpak_customer_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (caseLabel) {
      query = query.eq('case_label', caseLabel)
    } else if (caseLabels.length > 0) {
      query = query.in('case_label', caseLabels)
    }

    if (status && status !== 'all') {
      query = query.eq('status', normalizeStatus(status))
    } else if (activeOnly) {
      query = query.in('status', [...ACTIVE_STATUSES])
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error('Error fetching forecast customer requests:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching customer requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const row = rowFromBody(body)

    if (!row.case_label) {
      return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
    }
    if (!row.request_text) {
      return NextResponse.json({ error: 'request_text is verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_customer_requests')
      .insert(row)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating forecast customer request:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating customer request' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const key of ['case_type', 'customer_name', 'request_text', 'requested_action', 'due_date', 'created_from']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates[key] = normalizeText(body[key])
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'case_label')) {
      const caseLabel = normalizeCaseLabel(body.case_label)
      if (!caseLabel) return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
      updates.case_label = caseLabel
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = normalizeStatus(body.status)
      updates.status = status
      updates.resolved_at = status === 'handled' || status === 'cancelled' ? new Date().toISOString() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_customer_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating forecast customer request:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating customer request' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('grote_inpak_customer_requests')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting forecast customer request:', error)
    return NextResponse.json(
      { error: error.message || 'Error deleting customer request' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { allocateGroteInpakAutoStatus, type GroteInpakStatusAllocationPool } from '@/lib/grote-inpak/auto-status'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'

function stripAutomaticStatus(updates: Record<string, any>) {
  const allowedUpdates = { ...updates }
  delete allowedUpdates.status
  return allowedUpdates
}

function allocationKey(caseType: unknown) {
  const kt = String(caseType || '').trim().toUpperCase()
  if (!kt) return ''
  return kt.startsWith('V') ? `K${kt.substring(1)}` : kt
}

function sortCasesForAllocation(a: any, b: any) {
  const aDate = a.arrival_date ? new Date(a.arrival_date).getTime() : Number.MAX_SAFE_INTEGER
  const bDate = b.arrival_date ? new Date(b.arrival_date).getTime() : Number.MAX_SAFE_INTEGER
  if (aDate !== bDate) return aDate - bDate
  return String(a.case_label || '').localeCompare(String(b.case_label || ''))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get('location')
    const status = searchParams.get('status')
    const inWillebroek = searchParams.get('in_willebroek')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')

    let query = supabaseAdmin
      .from('grote_inpak_cases')
      .select('*')
      .order('arrival_date', { ascending: true, nullsFirst: false })

    // Apply filters
    if (location && location !== 'Alle') {
      query = query.eq('productielocatie', location)
    }

    if (inWillebroek === 'true') {
      query = query.eq('in_willebroek', true)
    } else if (inWillebroek === 'false') {
      query = query.eq('in_willebroek', false)
    }

    if (priority === 'true') {
      query = query.eq('priority', true)
    } else if (priority === 'false') {
      query = query.eq('priority', false)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    let filteredData = data || []

    if (filteredData.length > 0) {
      // Forecast datums ophalen per caselabel
      const caseLabels = filteredData.map((item: any) => item.case_label).filter(Boolean)
      const { data: forecastRows } = await supabaseAdmin
        .from('grote_inpak_forecast')
        .select('case_label, arrival_date')
        .in('case_label', caseLabels)

      const forecastMap = new Map<string, string>()
      ;(forecastRows || []).forEach((row: any) => {
        if (row.case_label) forecastMap.set(row.case_label, row.arrival_date)
      })

      // Stock + productie ophalen per kistnummer (= case_type)
      const caseTypes = [...new Set(
        filteredData.flatMap((item: any) => {
          const kt = String(item.case_type || '').trim().toUpperCase()
          if (!kt) return []
          return kt.startsWith('V') ? [kt, 'K' + kt.substring(1)] : [kt]
        })
      )]

      const stockWillebroekMap = new Map<string, number>()
      const stockGenkMap       = new Map<string, number>()
      const stockWilrijkMap    = new Map<string, number>()
      const inProductieMap     = new Map<string, number>()
      const inTransferMap      = new Map<string, number>()

      if (caseTypes.length > 0) {
        // 'productie' = kolom K uit stock file (Qty. on Prod. Order)
        const { data: stockRows } = await supabaseAdmin
          .from('grote_inpak_stock')
          .select('kistnummer, erp_code, location, quantity, productie')

        // Bouw erp_code → kistnummer map voor items zonder kistnummer
        const erpToKist = new Map<string, string>()
        ;(stockRows || []).forEach((row: any) => {
          if (row.erp_code && row.kistnummer) {
            erpToKist.set(String(row.erp_code).trim().toUpperCase(), String(row.kistnummer).trim().toUpperCase())
          }
        })

        ;(stockRows || []).forEach((row: any) => {
          let kt = String(row.kistnummer || '').trim().toUpperCase()
          if (!kt && row.erp_code) kt = erpToKist.get(String(row.erp_code).trim().toUpperCase()) || ''
          if (!kt || !caseTypes.includes(kt)) return

          const loc = String(row.location || '').toLowerCase()
          const qty = Number(row.quantity) || 0
          const prod = Number(row.productie) || 0  // 'productie' = Qty. on Prod. Order (kolom K)

          if (loc.includes('willebroek')) {
            stockWillebroekMap.set(kt, (stockWillebroekMap.get(kt) || 0) + qty)
          } else if (loc.includes('genk')) {
            stockGenkMap.set(kt, (stockGenkMap.get(kt) || 0) + qty)
          } else if (loc.includes('wilrijk')) {
            stockWilrijkMap.set(kt, (stockWilrijkMap.get(kt) || 0) + qty)
          }
          // in_productie telt over alle locaties
          inProductieMap.set(kt, (inProductieMap.get(kt) || 0) + prod)
        })

        // Transfer orders ophalen
        const { data: transferRows } = await supabaseAdmin
          .from('grote_inpak_transfer')
          .select('kistnummer, quantity')
          .in('kistnummer', caseTypes)

        ;(transferRows || []).forEach((row: any) => {
          const kt = String(row.kistnummer || '').trim().toUpperCase()
          if (!kt) return
          inTransferMap.set(kt, (inTransferMap.get(kt) || 0) + (Number(row.quantity) || 0))
        })
      }

      const enrichedData = filteredData.map((item: any) => {
        const kt = String(item.case_type || '').trim().toUpperCase()
        const ktAlt = kt.startsWith('V') ? 'K' + kt.substring(1) : null
        const lookup = (m: Map<string, number>) => (m.get(kt) ?? 0) || (ktAlt ? (m.get(ktAlt) ?? 0) : 0)
        return {
          ...item,
          forecast_date:       forecastMap.get(item.case_label) ?? null,
          stock_willebroek:    lookup(stockWillebroekMap),
          stock_genk:          lookup(stockGenkMap),
          stock_wilrijk:       lookup(stockWilrijkMap),
          in_productie_qty:    lookup(inProductieMap),
          in_transfer_qty:     lookup(inTransferMap),
        }
      })

      const pools = new Map<string, GroteInpakStatusAllocationPool>()
      for (const item of enrichedData) {
        const key = allocationKey(item.case_type)
        if (!key || pools.has(key)) continue
        pools.set(key, {
          stock_willebroek: Number(item.stock_willebroek) || 0,
          stock_genk: Number(item.stock_genk) || 0,
          stock_wilrijk: Number(item.stock_wilrijk) || 0,
          in_transfer_qty: Number(item.in_transfer_qty) || 0,
          in_productie_qty: Number(item.in_productie_qty) || 0,
        })
      }

      const allocatedByCase = new Map<string, { status: string; reason: string }>()
      ;[...enrichedData].sort(sortCasesForAllocation).forEach((item: any) => {
        const key = allocationKey(item.case_type)
        const pool = key ? pools.get(key) : null
        if (!pool) {
          allocatedByCase.set(item.case_label, {
            status: 'Nog te produceren',
            reason: 'Geen kisttype gevonden om stock of productie te matchen',
          })
          return
        }
        allocatedByCase.set(item.case_label, allocateGroteInpakAutoStatus(pool))
      })

      filteredData = enrichedData.map((item: any) => {
        const allocated = allocatedByCase.get(item.case_label)
        return {
          ...item,
          status: allocated?.status ?? 'Nog te produceren',
          status_reason: allocated?.reason ?? 'Geen statusallocatie gevonden',
        }
      })
    }

    // Apply status filter after enrichment because status is automatic/live.
    if (status && status !== 'Alle') {
      filteredData = filteredData.filter((item: any) => item.status === status)
    }

    // Apply search filter in memory
    if (search) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter((item: any) => {
        return (
          item.case_label?.toLowerCase().includes(searchLower) ||
          item.case_type?.toLowerCase().includes(searchLower) ||
          item.item_number?.toLowerCase().includes(searchLower) ||
          item.stock_location?.toLowerCase().includes(searchLower) ||
          item.comment?.toLowerCase().includes(searchLower)
        )
      })
    }

    return NextResponse.json({ data: filteredData, count: filteredData.length })
  } catch (error: any) {
    logApiError(error, { route: '/api/grote-inpak/cases', method: 'GET' })
    return NextResponse.json(
      { error: error.message || 'Error fetching cases' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { case_label, updates } = body

    if (!case_label || !updates) {
      return NextResponse.json(
        { error: 'case_label and updates are required' },
        { status: 400 }
      )
    }

    const caseUpdates = stripAutomaticStatus(updates)

    if (Object.keys(caseUpdates).length === 0) {
      return NextResponse.json({ success: true, ignored: ['status'] })
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .update(caseUpdates)
      .eq('case_label', case_label)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    logApiError(error, { route: '/api/grote-inpak/cases', method: 'PATCH' })
    return NextResponse.json(
      { error: error.message || 'Error updating case' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body // Array of { case_label, ...updates }

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates must be an array' },
        { status: 400 }
      )
    }

    // Update multiple cases
    const promises = updates.map((item: any) => {
      const { case_label, ...rawUpdates } = item
      const caseUpdates = stripAutomaticStatus(rawUpdates)

      if (Object.keys(caseUpdates).length === 0) {
        return Promise.resolve()
      }

      return supabaseAdmin
        .from('grote_inpak_cases')
        .update(caseUpdates)
        .eq('case_label', case_label)
    })

    await Promise.all(promises)

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error: any) {
    logApiError(error, { route: '/api/grote-inpak/cases', method: 'PUT' })
    return NextResponse.json(
      { error: error.message || 'Error bulk updating cases' },
      { status: 500 }
    )
  }
}


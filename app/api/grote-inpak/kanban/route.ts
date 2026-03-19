import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

function countBusinessDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)

  while (current <= endDate) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count += 1
    }
    current.setDate(current.getDate() + 1)
  }

  return Math.max(count, 1)
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const dateFrom = params.get('date_from')
    const dateTo = params.get('date_to')
    const leadTimeDays = Number(params.get('lead_time_days') || 5)
    const stacksPerPos = Number(params.get('stacks_per_pos') || 2)
    const safetyFactor = Number(params.get('safety_factor') || 1.2)
    const onlyC = params.get('only_c') !== 'false'

    const fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    const toDate = dateTo ? new Date(dateTo) : new Date()

    const { data: packedData, error: packedError } = await supabaseAdmin
      .from('grote_inpak_packed')
      .select('case_label, case_type, packed_date')
      .gte('packed_date', fromDate.toISOString().split('T')[0])
      .lte('packed_date', toDate.toISOString().split('T')[0])

    if (packedError) {
      throw packedError
    }

    const caseLabelsNeedingType = new Set<string>()
    packedData?.forEach((row: any) => {
      if (!row.case_type && row.case_label) {
        caseLabelsNeedingType.add(row.case_label)
      }
    })

    let caseTypeMap = new Map<string, string>()
    if (caseLabelsNeedingType.size > 0) {
      const { data: casesData } = await supabaseAdmin
        .from('grote_inpak_cases')
        .select('case_label, case_type')
        .in('case_label', Array.from(caseLabelsNeedingType))
      casesData?.forEach((row: any) => {
        if (row.case_label && row.case_type) {
          caseTypeMap.set(row.case_label, row.case_type)
        }
      })
    }

    const businessDays = countBusinessDays(fromDate, toDate)
    const statsMap = new Map<string, number>()

    packedData?.forEach((row: any) => {
      let caseType = row.case_type || caseTypeMap.get(row.case_label) || ''
      caseType = String(caseType || '').trim().toUpperCase().replace(/^[V]/, 'K')
      if (!caseType) return
      if (onlyC && !caseType.startsWith('C')) return
      statsMap.set(caseType, (statsMap.get(caseType) || 0) + 1)
    })

    const stats = Array.from(statsMap.entries()).map(([case_type, totaal_verbruik]) => ({
      case_type,
      totaal_verbruik,
      gemiddeld_per_dag: totaal_verbruik / businessDays,
    }))

    const { data: erpData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, stapel, productielocatie')

    const erpMap = new Map<string, { stapel: number; productielocatie: string }>()
    erpData?.forEach((row: any) => {
      if (!row.kistnummer) return
      const key = String(row.kistnummer).trim().toUpperCase().replace(/^[V]/, 'K')
      erpMap.set(key, {
        stapel: Math.max(1, Number(row.stapel) || 1),
        productielocatie: row.productielocatie || 'Wilrijk',
      })
    })

    const plan = stats
      .map((row) => {
        const erp = erpMap.get(row.case_type) || { stapel: 1, productielocatie: 'Wilrijk' }
        const demand = row.gemiddeld_per_dag * leadTimeDays * safetyFactor
        const kanbans = Math.max(1, Math.ceil(demand / erp.stapel))
        const posities = Math.max(1, Math.ceil(kanbans / stacksPerPos))
        const locatie = erp.productielocatie?.toLowerCase().includes('genk') ? 'G' : 'W'
        return {
          case_type: row.case_type,
          gemiddeld_per_dag: row.gemiddeld_per_dag,
          stapel: erp.stapel,
          kanbans,
          posities,
          locatie,
          productielocatie: erp.productielocatie || 'Wilrijk',
        }
      })
      .sort((a, b) => b.gemiddeld_per_dag - a.gemiddeld_per_dag)

    const limitedPlan: typeof plan = []
    let used = 0
    for (const row of plan) {
      used += row.posities
      if (used > 65) break
      limitedPlan.push(row)
    }

    return NextResponse.json({
      stats,
      plan: limitedPlan,
      business_days: businessDays,
    })
  } catch (error: any) {
    console.error('Error building kanban plan:', error)
    return NextResponse.json(
      { error: error.message || 'Error building kanban plan' },
      { status: 500 }
    )
  }
}

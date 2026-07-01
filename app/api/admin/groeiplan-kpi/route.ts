import { NextResponse } from 'next/server'
import { computeGroeiplanKpiReport } from '@/lib/kpi/groeiplan-compute'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const report = await computeGroeiplanKpiReport()
    const response = NextResponse.json(report)
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('groeiplan-kpi error:', error)
    return NextResponse.json({ error: 'KPI-rapport kon niet worden opgebouwd' }, { status: 500 })
  }
}

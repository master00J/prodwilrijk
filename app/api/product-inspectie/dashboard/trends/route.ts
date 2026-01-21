import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

type TrendBucket = {
  period: string
  total_controles: number
  goedgekeurd: number
  afgekeurd: number
  in_behandeling: number
}

const formatDateKey = (date: Date) => date.toISOString().split('T')[0]

const formatWeekKey = (date: Date) => {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') || '7d'
    let fromDate = new Date()
    let groupBy: 'day' | 'week' = 'day'

    if (period === '30d') {
      fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === '3m') {
      fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      groupBy = 'week'
    } else {
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    const { data, error } = await supabaseAdmin
      .from('product_controles')
      .select('controle_datum, status')
      .gte('controle_datum', fromDate.toISOString())
      .order('controle_datum', { ascending: true })

    if (error) {
      console.error('Error fetching trends:', error)
      return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 })
    }

    const buckets: Record<string, TrendBucket> = {}

    data?.forEach((row: any) => {
      const date = new Date(row.controle_datum)
      const key = groupBy === 'week' ? formatWeekKey(date) : formatDateKey(date)

      if (!buckets[key]) {
        buckets[key] = {
          period: key,
          total_controles: 0,
          goedgekeurd: 0,
          afgekeurd: 0,
          in_behandeling: 0,
        }
      }

      buckets[key].total_controles += 1
      if (row.status === 'goedgekeurd') buckets[key].goedgekeurd += 1
      else if (row.status === 'afgekeurd') buckets[key].afgekeurd += 1
      else buckets[key].in_behandeling += 1
    })

    const result = Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

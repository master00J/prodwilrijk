import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const startOfDay = (day: string) => new Date(`${day}T00:00:00.000Z`)
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999Z`)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const day = searchParams.get('day') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const location = searchParams.get('location') || ''
    const sessionId = searchParams.get('session_id') || ''

    if (day) {
      let scanQuery = supabaseAdmin
        .from('prepack_scans')
        .select('id, ts, code, location, note, created_at, employee_id, session_id')
        .gte('created_at', startOfDay(day).toISOString())
        .lte('created_at', endOfDay(day).toISOString())

      if (location && location !== 'ALL') {
        scanQuery = scanQuery.eq('location', location)
      }
      if (sessionId) {
        scanQuery = scanQuery.eq('session_id', Number(sessionId))
      }

      const { data: rows, error } = await scanQuery.order('created_at', { ascending: false })
      if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })

      const total = rows?.length || 0
      const uniq = new Set((rows || []).map((r: any) => r.code)).size

      const employeeIds = new Set<number>()
      rows?.forEach((r: any) => {
        if (r.employee_id) employeeIds.add(r.employee_id)
      })

      let session: any = null
      if (sessionId) {
        const { data: sRow } = await supabaseAdmin
          .from('prepack_sessions')
          .select('*')
          .eq('id', Number(sessionId))
          .single()
        if (sRow) session = sRow
      }

      if (session?.bc_employee_id) employeeIds.add(session.bc_employee_id)
      if (session?.web_employee_id) employeeIds.add(session.web_employee_id)

      const idList = Array.from(employeeIds)
      const idToName: Record<number, string> = {}
      if (idList.length > 0) {
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('*')
          .in('id', idList)
        employees?.forEach((emp: any) => {
          idToName[emp.id] = emp.name || emp.full_name || emp.username || `#${emp.id}`
        })
      }

      let dayDiffs: any = null
      if (!sessionId) {
        const { data: sessions } = await supabaseAdmin
          .from('prepack_sessions')
          .select('id, bc_total, web_total')
          .eq('day', day)

        const { data: diffs } = await supabaseAdmin
          .from('prepack_session_diffs')
          .select('pac, side, session_id')
          .in('session_id', (sessions || []).map((s: any) => s.id))

        const onlyInBc = new Set<string>()
        const onlyInWeb = new Set<string>()
        const matches = new Set<string>()
        diffs?.forEach((d: any) => {
          if (d.side === 'BC_ONLY') onlyInBc.add(d.pac)
          else if (d.side === 'WEB_ONLY') onlyInWeb.add(d.pac)
          else if (d.side === 'MATCH') matches.add(d.pac)
        })

        dayDiffs = {
          bc_total_sum: (sessions || []).reduce((sum: number, s: any) => sum + (s.bc_total || 0), 0),
          web_total_sum: (sessions || []).reduce((sum: number, s: any) => sum + (s.web_total || 0), 0),
          only_in_bc: Array.from(onlyInBc).sort(),
          only_in_web: Array.from(onlyInWeb).sort(),
          matches: Array.from(matches).sort(),
        }
      }

      let sessionPayload: any = null
      if (session) {
        const { data: diffs } = await supabaseAdmin
          .from('prepack_session_diffs')
          .select('pac, side')
          .eq('session_id', session.id)
        const only_in_bc = (diffs || []).filter((d: any) => d.side === 'BC_ONLY').map((d: any) => d.pac)
        const only_in_web = (diffs || []).filter((d: any) => d.side === 'WEB_ONLY').map((d: any) => d.pac)
        const matches = (diffs || []).filter((d: any) => d.side === 'MATCH').map((d: any) => d.pac)

        sessionPayload = {
          id: session.id,
          day: session.day,
          label: session.label || null,
          started_at: session.started_at || null,
          ended_at: session.ended_at || null,
          bc_employee: session.bc_employee_id
            ? { id: session.bc_employee_id, name: idToName[session.bc_employee_id] || null }
            : null,
          web_employee: session.web_employee_id
            ? { id: session.web_employee_id, name: idToName[session.web_employee_id] || null }
            : null,
          only_in_bc,
          only_in_web,
          matches,
        }
      }

      const entries = (rows || []).map((r: any) => ({
        ...r,
        employee_name: r.employee_id ? idToName[r.employee_id] || null : null,
        bc_employee_name: session?.bc_employee_id ? idToName[session.bc_employee_id] || null : null,
      }))

      return NextResponse.json({
        success: true,
        summary: { total, unique: uniq },
        entries,
        session: sessionPayload,
        day_diffs: dayDiffs,
      })
    }

    // Overview per day
    let scanQuery = supabaseAdmin
      .from('prepack_scans')
      .select('created_at, code, location')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (from) scanQuery = scanQuery.gte('created_at', new Date(from).toISOString())
    if (to) scanQuery = scanQuery.lte('created_at', endOfDay(to).toISOString())

    const { data: scans, error } = await scanQuery
    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })

    const dayMap = new Map<string, any>()
    ;(scans || []).forEach((s: any) => {
      const dayKey = new Date(s.created_at).toISOString().slice(0, 10)
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { day: dayKey, total: 0, codes: new Set<string>(), cnt_3pl: 0, cnt_service: 0, cnt_powertools: 0 })
      }
      const row = dayMap.get(dayKey)
      row.total += 1
      row.codes.add(s.code)
      if (s.location === '3PL') row.cnt_3pl += 1
      if (s.location === 'Service center') row.cnt_service += 1
      if (s.location === 'Powertools') row.cnt_powertools += 1
    })

    const days = Array.from(dayMap.values())
      .map((d) => ({
        ...d,
        unique_codes: d.codes.size,
      }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 60)

    return NextResponse.json({ success: true, days })
  } catch (error) {
    console.error('history error:', error)
    return NextResponse.json({ success: false, error: 'Serverfout bij historiek' }, { status: 500 })
  }
}

export type ProtimeDayStatus = 'aanwezig' | 'afwezig' | 'verlof' | 'ziek' | 'thuiswerk'

export interface ProtimeCalendarDay {
  dayLabel: string
  dateIso: string
}

export interface ProtimeEmployeeRow {
  firstName: string
  lastName: string
  fullName: string
  days: Array<{
    date: string
    status: ProtimeDayStatus
    raw: string
  }>
}

export interface ProtimeParseResult {
  generatedAt: string | null
  days: ProtimeCalendarDay[]
  employees: ProtimeEmployeeRow[]
  warnings: string[]
}

const PAGE_MARKER_RE = /^--\s*\d+\s+of\s+\d+\s*--$/i
const SECTION_RE =
  /^(Arbeiders|Euroworkers|Inpakteam|Uitzendkrachten|.*Wilrijk)/i
const SUMMARY_RE = /^Aanwezig\/totaal/i
const GENERATED_RE = /Gegenereerd op\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i
const DATE_HEADER_RE = /Naam\s+((?:(?:ma|di|wo|do|vr|za|zo)\s+\d{1,2}\/\d{1,2}\s*)+)/i
const DAY_PART_RE = /(ma|di|wo|do|vr|za|zo)\s+(\d{1,2})\/(\d{1,2})/gi
const CODE_RE = /^[A-Z]{1,4}(\([A-Z]{1,3}\))?$/
const SCHEDULE_HINT_RE =
  /WI-A|Weekend|AFWEZIG|FEESTDAG|Tijdskrediet|Ouderschaps|-----|Inactief/i

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s*\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Koppelt Protime-voornaam aan medewerkers (database bevat enkel voornamen). */
export function matchEmployeeByName(
  protimeFirstName: string,
  employees: Array<{ id: number; name: string }>,
): number | null {
  const first = normalizeName(protimeFirstName.split(/\s+/)[0] ?? '')
  if (!first) return null

  const exact = employees.filter((e) => normalizeName(e.name) === first)
  if (exact.length === 1) return exact[0].id
  if (exact.length > 1) return null

  const fuzzy = employees.filter((e) => {
    const n = normalizeName(e.name)
    return n.length >= 3 && (first.startsWith(n) || n.startsWith(first))
  })
  if (fuzzy.length === 1) return fuzzy[0].id

  return null
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim()).filter(Boolean)
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)
}

function isScheduleLine(line: string): boolean {
  return SCHEDULE_HINT_RE.test(line) && (line.includes('\t') || /\d{1,2}:\d{2}/.test(line))
}

function isLegendLine(line: string): boolean {
  if (!line.includes('\t')) return false
  const cells = splitCells(line)
  if (cells.length < 3) return false
  return cells.every((c) => /^(FEESTDAG|AFWEZIG)$/i.test(c))
}

function isSkippableLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (PAGE_MARKER_RE.test(t)) return true
  if (SECTION_RE.test(t) && !t.includes('\t')) return true
  if (SUMMARY_RE.test(t)) return true
  if (DATE_HEADER_RE.test(t)) return true
  if (t === 'Naam') return true
  return false
}

function parseYear(text: string): number {
  const m = text.match(GENERATED_RE)
  if (m) return Number(m[3])
  return new Date().getFullYear()
}

function parseDateHeader(line: string, year: number): ProtimeCalendarDay[] | null {
  const m = line.match(DATE_HEADER_RE)
  if (!m) return null

  const days: ProtimeCalendarDay[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(DAY_PART_RE.source, 'gi')
  while ((match = re.exec(m[1])) !== null) {
    const dayLabel = match[1]
    const day = Number(match[2])
    const month = Number(match[3])
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ dayLabel, dateIso })
  }
  return days.length > 0 ? days : null
}

export function classifyProtimeCell(cell: string): ProtimeDayStatus | null {
  const c = cell.trim()
  if (!c) return null
  if (/AFWEZIG/i.test(c)) return 'afwezig'
  if (/FEESTDAG/i.test(c)) return 'afwezig'
  if (/Weekend|-----/i.test(c)) return 'afwezig'
  if (/Ouderschaps/i.test(c)) return 'verlof'
  if (/Tijdskrediet/i.test(c)) return 'afwezig'
  if (/Ziek/i.test(c)) return 'ziek'
  if (/thuiswerk|telewerk/i.test(c)) return 'thuiswerk'
  if (/WI-A/i.test(c)) return 'aanwezig'
  return null
}

const STATUS_PRIORITY: Record<ProtimeDayStatus, number> = {
  afwezig: 5,
  ziek: 4,
  verlof: 3,
  thuiswerk: 2,
  aanwezig: 1,
}

function mergeDayStatus(cells: string[]): { status: ProtimeDayStatus; raw: string } | null {
  const classified = cells
    .map((c) => ({ raw: c, status: classifyProtimeCell(c) }))
    .filter((x): x is { raw: string; status: ProtimeDayStatus } => x.status !== null)

  if (classified.length === 0) return null

  const best = classified.reduce((a, b) =>
    STATUS_PRIORITY[b.status] > STATUS_PRIORITY[a.status] ? b : a,
  )
  return { status: best.status, raw: classified.map((x) => x.raw).join(' | ') }
}

function looksLikeCode(line: string): boolean {
  const t = line.trim()
  return CODE_RE.test(t) || /^[A-Z]{1,3}\([A-Z]{1,3}\)?$/.test(t)
}

function flushEmployee(
  pending: { firstName: string; lastName: string; scheduleRows: string[][] } | null,
  days: ProtimeCalendarDay[],
  out: ProtimeEmployeeRow[],
): { firstName: string; lastName: string; scheduleRows: string[][] } | null {
  if (!pending || !pending.firstName || !pending.lastName || days.length === 0) return null

  const dayCount = days.length
  const mergedCells: string[][] = Array.from({ length: dayCount }, () => [])

  for (const row of pending.scheduleRows) {
    const cells = row.slice(0, dayCount)
    while (cells.length < dayCount) cells.push('')
    cells.forEach((cell, idx) => {
      if (cell) mergedCells[idx].push(cell)
    })
  }

  const mappedDays: ProtimeEmployeeRow['days'] = []
  mergedCells.forEach((cells, idx) => {
    const merged = mergeDayStatus(cells)
    if (!merged) return
    mappedDays.push({
      date: days[idx].dateIso,
      status: merged.status,
      raw: merged.raw,
    })
  })

  if (mappedDays.length > 0) {
    const fullName = `${pending.firstName} ${pending.lastName}`.replace(/\s+/g, ' ').trim()
    out.push({ firstName: pending.firstName, lastName: pending.lastName, fullName, days: mappedDays })
  }

  return null
}

export function parseProtimeTeamCalendarText(text: string): ProtimeParseResult {
  const warnings: string[] = []
  const employees: ProtimeEmployeeRow[] = []
  const year = parseYear(text)

  const generatedMatch = text.match(GENERATED_RE)
  const generatedAt = generatedMatch
    ? `${generatedMatch[3]}-${generatedMatch[2].padStart(2, '0')}-${generatedMatch[1].padStart(2, '0')}`
    : null

  let days: ProtimeCalendarDay[] = []
  for (const line of text.split(/\r?\n/)) {
    const headerDays = parseDateHeader(line, year)
    if (headerDays) days = headerDays
  }
  if (days.length === 0) {
    warnings.push('Geen datums gevonden in de teamkalender.')
    return { generatedAt, days, employees, warnings }
  }

  let pending: { firstName: string; lastName: string; scheduleRows: string[][] } | null = null
  let state: 'idle' | 'first' | 'last' | 'code' = 'idle'

  const lines = text.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (isSkippableLine(line)) {
      if (DATE_HEADER_RE.test(line)) {
        pending = flushEmployee(pending, days, employees)
        state = 'idle'
      }
      continue
    }

    if (isLegendLine(line)) {
      pending = flushEmployee(pending, days, employees)
      state = 'idle'
      continue
    }

    if (isScheduleLine(line)) {
      if (!pending) continue
      if (state === 'last' || state === 'code') {
        pending.scheduleRows.push(splitCells(line))
        state = 'code'
        continue
      }
      if (state === 'first') {
        pending.lastName = line.split('\t')[0]?.trim() || line
        pending.scheduleRows.push(splitCells(line))
        state = 'code'
        continue
      }
      if (pending.scheduleRows.length > 0) {
        pending.scheduleRows.push(splitCells(line))
        continue
      }
    }

    if (state === 'code' || (pending && pending.scheduleRows.length > 0)) {
      pending = flushEmployee(pending, days, employees)
      state = 'idle'
    }

    if (state === 'idle') {
      pending = { firstName: line, lastName: '', scheduleRows: [] }
      state = 'first'
      continue
    }

    if (state === 'first') {
      if (!pending) {
        pending = { firstName: line, lastName: '', scheduleRows: [] }
        state = 'first'
        continue
      }
      if (looksLikeCode(line)) {
        pending.scheduleRows.push([])
        state = 'code'
        continue
      }
      pending.lastName = line
      state = 'last'
      continue
    }

    if (state === 'last') {
      if (!pending) {
        state = 'idle'
        continue
      }
      if (looksLikeCode(line)) {
        state = 'code'
        continue
      }
      pending = flushEmployee(pending, days, employees)
      pending = { firstName: line, lastName: '', scheduleRows: [] }
      state = 'first'
    }
  }

  flushEmployee(pending, days, employees)

  if (employees.length === 0) {
    warnings.push('Geen medewerkers gevonden in de PDF.')
  }

  return { generatedAt, days, employees, warnings }
}

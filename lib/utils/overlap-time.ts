/**
 * Proportionele tijdverdeling bij overlappende time_logs.
 *
 * Wanneer een medewerker tegelijk op meerdere flows werkt (bijv. items_to_pack
 * én items_to_pack_airtec), wordt de overlappende tijd gelijkmatig verdeeld
 * over de actieve flows. Dit voorkomt dat uren dubbel geteld worden.
 *
 * Voorbeeld:
 *   - items_to_pack:        10:00 – 18:00 (8u)
 *   - items_to_pack_airtec: 10:00 – 18:00 (8u)
 *   → Elke flow krijgt 4u effectieve tijd toegewezen (50/50)
 *
 * Voorbeeld met gedeeltelijke overlap:
 *   - items_to_pack:        09:00 – 18:00 (9u)
 *   - items_to_pack_airtec: 12:00 – 18:00 (6u)
 *   → items_to_pack:        09:00–12:00 (3u vol) + 12:00–18:00 (3u half) = 6u
 *   → items_to_pack_airtec: 12:00–18:00 (3u half) = 3u
 *   → Totaal: 6u + 3u = 9u = werkelijk gewerkte tijd ✓
 */

interface RawLog {
  start_time: string
  end_time: string
}

/**
 * Berekent de proportiefactor (0.0 – 1.0) voor één specifiek log ten opzichte
 * van alle andere gelijktijdig actieve logs van dezelfde medewerker.
 *
 * De factor geeft aan welk deel van de logtijd aan dit log wordt toegewezen.
 * Bij volledige overlap met 1 andere log: 0.5 (50/50).
 * Zonder overlap: 1.0 (volledige tijd).
 */
export function calculateProportionFactor(
  target: RawLog,
  allEmployeeLogs: RawLog[]
): number {
  const targetStart = new Date(target.start_time).getTime()
  const targetEnd = new Date(target.end_time).getTime()
  const totalDuration = targetEnd - targetStart

  if (totalDuration <= 0) return 0

  // Alle logs die overlappen met het doellog (inclusief het doellog zelf)
  const overlapping = allEmployeeLogs.filter(l => {
    const s = new Date(l.start_time).getTime()
    const e = new Date(l.end_time).getTime()
    return s < targetEnd && e > targetStart
  })

  if (overlapping.length <= 1) return 1.0

  // Verzamel alle tijdpunten binnen het doelinterval
  const timePoints = new Set<number>([targetStart, targetEnd])
  overlapping.forEach(l => {
    const s = new Date(l.start_time).getTime()
    const e = new Date(l.end_time).getTime()
    if (s > targetStart && s < targetEnd) timePoints.add(s)
    if (e > targetStart && e < targetEnd) timePoints.add(e)
  })

  const sortedPoints = [...timePoints].sort((a, b) => a - b)

  let weightedSum = 0
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i]
    const segEnd = sortedPoints[i + 1]
    const segDuration = segEnd - segStart
    const mid = (segStart + segEnd) / 2

    // Hoeveel logs zijn actief in dit segment?
    const count = overlapping.filter(l => {
      const s = new Date(l.start_time).getTime()
      const e = new Date(l.end_time).getTime()
      return s <= mid && e > mid
    }).length

    weightedSum += (segDuration / totalDuration) * (1 / Math.max(count, 1))
  }

  return weightedSum
}

/**
 * Groepeert logs per employee_id voor efficiënte lookup.
 */
export function groupLogsByEmployee(
  logs: Array<RawLog & { employee_id: number }>
): Map<number, RawLog[]> {
  const map = new Map<number, RawLog[]>()
  logs.forEach(log => {
    if (!map.has(log.employee_id)) map.set(log.employee_id, [])
    map.get(log.employee_id)!.push(log)
  })
  return map
}

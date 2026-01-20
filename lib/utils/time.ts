export function calculateWorkedSeconds(start: Date, end: Date) {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return 0

  const breakStartMinutes = 11 * 60
  const breakEndMinutes = 11 * 60 + 30

  let totalSeconds = 0
  let cursor = new Date(start)

  while (cursor.getTime() < endMs) {
    const dayStart = new Date(cursor)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const segmentEnd = endMs < dayEnd.getTime() ? new Date(endMs) : dayEnd
    const segmentSeconds = (segmentEnd.getTime() - cursor.getTime()) / 1000

    const breakStart = new Date(dayStart)
    breakStart.setMinutes(breakStartMinutes, 0, 0)
    const breakEnd = new Date(dayStart)
    breakEnd.setMinutes(breakEndMinutes, 0, 0)

    const overlapStart = new Date(Math.max(cursor.getTime(), breakStart.getTime()))
    const overlapEnd = new Date(Math.min(segmentEnd.getTime(), breakEnd.getTime()))
    const overlapSeconds = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / 1000)

    totalSeconds += Math.max(0, segmentSeconds - overlapSeconds)
    cursor = dayEnd
  }

  return Math.max(0, Math.floor(totalSeconds))
}

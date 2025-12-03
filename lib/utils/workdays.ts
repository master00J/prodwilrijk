/**
 * Calculates the number of working days between two dates
 * (excludes weekends: Saturday and Sunday)
 */
export function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  while (current < end) {
    const dayOfWeek = current.getDay()
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Gets a date that is N working days ago from the given date
 * (excludes weekends)
 */
export function getWorkingDaysAgo(referenceDate: Date, workingDays: number): Date {
  const result = new Date(referenceDate)
  result.setHours(0, 0, 0, 0)
  let daysToSubtract = 0
  let workingDaysCounted = 0

  while (workingDaysCounted < workingDays) {
    daysToSubtract++
    const checkDate = new Date(referenceDate)
    checkDate.setDate(checkDate.getDate() - daysToSubtract)
    checkDate.setHours(0, 0, 0, 0)
    
    const dayOfWeek = checkDate.getDay()
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDaysCounted++
    }
  }

  result.setDate(result.getDate() - daysToSubtract)
  return result
}

/**
 * Checks if an item date is older than N working days
 */
export function isOlderThanWorkingDays(itemDate: Date, referenceDate: Date, workingDays: number): boolean {
  const workingDaysAgo = getWorkingDaysAgo(referenceDate, workingDays)
  return itemDate < workingDaysAgo
}



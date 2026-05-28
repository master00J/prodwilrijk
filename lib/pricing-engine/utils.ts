/** Rond bedragen af op 2 decimalen (server-side, controleerbare regels). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function assertPositive(value: unknown, fieldLabel: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${fieldLabel} moet groter zijn dan 0`)
  }
  return n
}

export function assertNonNegative(value: unknown, fieldLabel: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${fieldLabel} mag niet negatief zijn`)
  }
  return n
}

export function assertRequired(value: unknown, fieldLabel: string): void {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldLabel} is verplicht`)
  }
}

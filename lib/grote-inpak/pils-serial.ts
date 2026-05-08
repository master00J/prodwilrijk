/**
 * Laatste 6 cijfers van het serienummer (alleen cijfers), voor koppeling met BC shop order / lijn.
 */
export function pilsShopOrderKeyFromSerial(serial: string | null | undefined): string | null {
  const d = String(serial || '').replace(/\D/g, '')
  if (d.length >= 6) return d.slice(-6)
  return d.length > 0 ? d : null
}

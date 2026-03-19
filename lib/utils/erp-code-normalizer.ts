/**
 * Normalize ERP code consistently across the application
 * This matches the logic used in stock file parsing and ERP LINK parsing
 * 
 * Handles:
 * - Uppercase conversion
 * - Trimming whitespace
 * - Removing spaces
 * - Extracting GP codes from embedded format (e.g., "7773 GP008760" -> "GP008760")
 * - Extracting ERP codes from multi-part strings
 * 
 * @param erpCode - The ERP code to normalize (can be string, null, or undefined)
 * @returns Normalized ERP code string or null if input is invalid
 */
export function normalizeErpCode(erpCode: string | null | undefined): string | null {
  if (!erpCode) return null
  
  let normalized = String(erpCode).toUpperCase().trim().replace(/\s+/g, '')
  
  // Extract GP code if embedded (e.g., "7773 GP008760" -> "GP008760")
  const gpMatch = normalized.match(/\b(GP\d+)\b/i)
  if (gpMatch) {
    return gpMatch[1]
  }
  
  // If it's already a valid ERP code format, use it
  if (normalized.match(/^[A-Z]{2,}\d+/)) {
    return normalized
  }

  // Excel kan GP-codes als getal opslaan (6064 i.p.v. GP006064) → probeer GP + 6 cijfers
  if (normalized.match(/^\d{4,6}$/)) {
    return 'GP' + normalized.padStart(6, '0')
  }
  
  // Try to extract from parts if it contains spaces (shouldn't happen after replace, but just in case)
  const parts = normalized.split(/\s+/)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim()
    if (part.match(/^[A-Z]{2,}\d+/i)) {
      return part
    }
  }
  
  // If still no match, return the normalized value (might be a valid code we just don't recognize)
  return normalized || null
}

/**
 * Normaliseert kistnummer/case_type consistent voor matching en lookups.
 * Verwijdert spaties zodat "C 352" en "C352" hetzelfde worden.
 */
export function normalizeKistnummer(value: string | null | undefined): string {
  const normalized = String(value || '').trim().replace(/\s+/g, '').toUpperCase()
  if (!normalized) return ''
  if (normalized.startsWith('V')) return `K${normalized.slice(1)}`
  return normalized
}



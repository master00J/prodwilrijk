/**
 * Shop-order / serienummer-sleutel: PILS ↔ BC.
 *
 * - **PILS** (serial e.d.): bevat meestal méér cijfers; we nemen de **laatste 6**.
 * - **BC-export**: bevat vaak **alleen** die 6 cijfers. Staat dat in Excel als getal,
 *   dan verdwijnen **voorloopnullen** (bv. `083733` → `83733`); die vullen we links
 *   weer aan tot 6 tekens zodat de match toch slaagt.
 */
export function shopOrderMatchKey(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length >= 6) return d.slice(-6)
  // BC: enkel suffix zonder voorloopnullen (korter dan 6 cijfers)
  return d.padStart(6, '0')
}

/** Zelfde als {@link shopOrderMatchKey} — oude naam voor PILS-serial. */
export function pilsShopOrderKeyFromSerial(serial: string | null | undefined): string | null {
  return shopOrderMatchKey(serial)
}

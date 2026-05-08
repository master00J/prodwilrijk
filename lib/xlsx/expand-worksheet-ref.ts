import type { WorkSheet } from 'xlsx'
import * as XLSX from 'xlsx'

/**
 * BC/Excel schrijft soms een te krappe `!ref` (dimensions). SheetJS gebruikt die
 * voor o.a. `decode_range` en `sheet_to_json`, waardoor lage rijen "verdwijnen".
 */
export function expandWorksheetRef(ws: WorkSheet | undefined): void {
  if (!ws) return
  if (!ws['!ref']) {
    ws['!ref'] = 'A1'
  }
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (const key of Object.keys(ws)) {
    if (key[0] === '!') continue
    try {
      const addr = XLSX.utils.decode_cell(key)
      if (addr.r > range.e.r) range.e.r = addr.r
      if (addr.c > range.e.c) range.e.c = addr.c
    } catch {
      /* ongeldige sleutel negeren */
    }
  }
  ws['!ref'] = XLSX.utils.encode_range(range)
}

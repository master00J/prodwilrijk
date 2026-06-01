/** Gedeelde upload-limieten voor API-routes (Excel, PDF, afbeeldingen). */

export const MAX_EXCEL_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
])

export function validateExcelUpload(file: File | null): string | null {
  if (!file || file.size === 0) return 'Geen bestand ontvangen'
  if (file.size > MAX_EXCEL_UPLOAD_BYTES) {
    return `Bestand te groot (max ${MAX_EXCEL_UPLOAD_BYTES / (1024 * 1024)}MB)`
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.xlsm')) {
    return 'Alleen Excel-bestanden (.xlsx, .xls, .xlsm) zijn toegestaan'
  }
  if (file.type && !EXCEL_MIME_TYPES.has(file.type) && !file.type.startsWith('application/')) {
    return 'Ongeldig bestandstype'
  }
  return null
}

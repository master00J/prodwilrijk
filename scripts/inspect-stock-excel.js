/**
 * Inspecteert de structuur van Stock Excel-bestanden (headers + eerste datarij).
 * Gebruik: node scripts/inspect-stock-excel.js "pad/naar/Stock Genk.xlsx"
 */
const XLSX = require('xlsx')
const path = process.argv[2]
if (!path) {
  console.error('Gebruik: node scripts/inspect-stock-excel.js "pad/naar/Stock Genk.xlsx"')
  process.exit(1)
}

const workbook = XLSX.readFile(path)
const sheetName = workbook.SheetNames[0]
const ws = workbook.Sheets[sheetName]
const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

console.log('Sheet:', sheetName)
console.log('Range:', ws['!ref'], '-> rows', range.e.r + 1, 'cols', range.e.c + 1)
console.log('')

// Eerste 10 rijen, alle kolommen tot 20
const maxCol = Math.min(20, range.e.c + 1)
for (let r = 0; r < Math.min(10, range.e.r + 1); r++) {
  const row = []
  for (let c = 0; c < maxCol; c++) {
    const cell = XLSX.utils.encode_cell({ r, c })
    const val = ws[cell]
    const v = val && val.v !== undefined ? val.v : ''
    const preview = typeof v === 'string' && v.length > 30 ? v.slice(0, 27) + '...' : v
    row.push(preview)
  }
  console.log('Row', r + 1, ':', JSON.stringify(row))
}
console.log('')
console.log('Kolomindex -> header (row 0):')
for (let c = 0; c < maxCol; c++) {
  const cell = XLSX.utils.encode_cell({ r: 0, c })
  const val = ws[cell]
  const v = val && val.v !== undefined ? String(val.v) : ''
  console.log('  ', c, '(', String.fromCharCode(65 + c), '):', v)
}

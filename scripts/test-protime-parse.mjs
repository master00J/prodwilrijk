import { readFileSync } from 'fs'
import { parseProtimeTeamCalendarText } from '../lib/protime/parse-team-calendar.ts'

const pdfPath = process.argv[2] || 'C:/Users/j.ploegaerts/Desktop/Teamkalender - myProtime.pdf'

let text = ''
try {
  const { PDFParse } = await import('pdf-parse')
  const buf = readFileSync(pdfPath)
  const parser = new PDFParse({ data: buf })
  const pdfData = await parser.getText()
  await parser.destroy()
  text = pdfData.text
} catch (e) {
  console.error('PDF read failed, using stdin sample', e.message)
  process.exit(1)
}

const parsed = parseProtimeTeamCalendarText(text)
console.log('days', parsed.days)
console.log('employees', parsed.employees.length)
console.log('warnings', parsed.warnings)
for (const e of parsed.employees.slice(0, 5)) {
  console.log('-', e.fullName, e.days.map((d) => `${d.date}:${d.status}`).join(', '))
}
const jurgen = parsed.employees.find((e) => e.fullName.toUpperCase().includes('JURGEN'))
if (jurgen) console.log('Jurgen', jurgen.days)
const danny = parsed.employees.find((e) => e.fullName.toUpperCase().includes('DANNY'))
if (danny) console.log('Danny', danny.days)

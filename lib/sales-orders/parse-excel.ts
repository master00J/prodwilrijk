import * as XLSX from 'xlsx'

function extractItemNumber(description: string): string | null {
  if (!description) return null
  const match = description.match(/\(([^)]+)\)\s*$/)
  return match?.[1]?.trim() ?? null
}

function parseFlexibleNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/\s/g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function detectSalesOrderColumns(rows: any[][]): {
  descriptionIndex: number
  priceIndex: number
  detected: boolean
} {
  const sampleRows = rows.slice(0, 200)
  const maxCols = sampleRows.reduce((max, row) => Math.max(max, row?.length || 0), 0)
  const descriptionScores = new Array(maxCols).fill(0)

  sampleRows.forEach((row) => {
    if (!row) return
    for (let col = 0; col < maxCols; col += 1) {
      const value = row[col]
      if (!value) continue
      const itemNumber = extractItemNumber(String(value))
      if (itemNumber) descriptionScores[col] += 1
    }
  })

  let descriptionIndex: number | null = null
  let bestDescriptionScore = 0
  descriptionScores.forEach((score, col) => {
    if (score > bestDescriptionScore) {
      bestDescriptionScore = score
      descriptionIndex = col
    }
  })

  let priceIndex: number | null = null
  let bestPairedScore = -1
  let bestNumericScore = -1
  for (let col = 0; col < maxCols; col += 1) {
    if (col === descriptionIndex) continue
    let numericScore = 0
    let pairedScore = 0
    sampleRows.forEach((row) => {
      if (!row) return
      const value = row[col]
      const price = parseFlexibleNumber(value)
      if (price === null) return
      numericScore += 1
      if (descriptionIndex !== null) {
        const descriptionValue = row[descriptionIndex]
        const itemNumber = descriptionValue ? extractItemNumber(String(descriptionValue)) : null
        if (itemNumber) pairedScore += 1
      }
    })
    if (pairedScore > bestPairedScore || (pairedScore === bestPairedScore && numericScore > bestNumericScore)) {
      bestPairedScore = pairedScore
      bestNumericScore = numericScore
      priceIndex = col
    }
  }

  return {
    descriptionIndex: descriptionIndex ?? 10,
    priceIndex: priceIndex ?? 0,
    detected: descriptionIndex !== null && priceIndex !== null,
  }
}

export async function processSalesOrderExcel(file: File): Promise<Array<{ item_number: string; price: number; description: string }>> {
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })

  const workbook = XLSX.read(data, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

  const { descriptionIndex, priceIndex } = detectSalesOrderColumns(jsonData)

  const validItems: Array<{ item_number: string; price: number; description: string }> = []

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || row.length === 0) continue

    const price = parseFlexibleNumber(row[priceIndex])
    const description = row[descriptionIndex] ? String(row[descriptionIndex]).trim() : null

    if (!description || price === null || isNaN(price) || price < 0) continue

    const itemNumber = extractItemNumber(description)
    if (!itemNumber) continue

    validItems.push({ item_number: itemNumber, price, description })
  }

  return validItems
}

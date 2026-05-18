export type CnhPdfExtractResult = {
  shippingNote: string | null
  motorNumbers: string[]
}

/** Corrigeer veelvoorkomende OCR-fout: leading 7 → 1 bij 6-cijferige nummers. */
export function correctOcrNumber(num: string): string {
  if (num.startsWith('7') && num.length === 6) {
    const corrected = '1' + num.substring(1)
    const value = parseInt(corrected, 10)
    if (value >= 100000 && value < 200000) {
      num = corrected
    }
  }
  if (num.startsWith('7') && num.endsWith('7') && num.length === 6) {
    const corrected = '1' + num.substring(1, num.length - 1) + '1'
    const value = parseInt(corrected, 10)
    if (value >= 100000 && value < 200000) {
      num = corrected
    }
  }
  return num
}

export function extractCnhFieldsFromText(text: string): CnhPdfExtractResult {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

  let shippingNote = ''

  const nrMatch = text.match(/\bNR\s+(\d{5,7})\b/i)
  if (nrMatch?.[1]) {
    shippingNote = correctOcrNumber(nrMatch[1].trim())
  } else {
    const shippingNotePatterns = [
      /\bNR[:\s]*(\d{5,7})\b/i,
      /verzendnota[:\s]+(\d{5,7})/i,
      /shipping\s*note[:\s]+(\d{5,7})/i,
      /\bC\d{10,14}\b/i,
    ]

    for (const pattern of shippingNotePatterns) {
      const match = text.match(pattern)
      if (match?.[1]) {
        shippingNote = correctOcrNumber(match[1].trim())
        break
      }
      if (match?.[0] && pattern.source.includes('C\\d')) {
        shippingNote = match[0].trim()
        break
      }
    }

    if (!shippingNote) {
      const topText = text.substring(0, Math.min(2000, text.length))
      const nrNumbers = topText.match(/\b(\d{6})\b/g)
      if (nrNumbers?.length) {
        for (const num of nrNumbers) {
          const corrected = correctOcrNumber(num)
          if (corrected.startsWith('1') || (parseInt(corrected, 10) >= 100000 && parseInt(corrected, 10) < 200000)) {
            shippingNote = corrected
            break
          }
        }
        if (!shippingNote) {
          shippingNote = correctOcrNumber(nrNumbers[0])
        }
      }
    }
  }

  const motorNumbers: string[] = []

  const stuknummerIndex = lines.findIndex(
    (line) =>
      line.toLowerCase().includes('stuknummer') ||
      line.toLowerCase().includes('stuk nummer') ||
      line.toLowerCase().includes('stuknr')
  )

  if (stuknummerIndex >= 0) {
    for (let i = stuknummerIndex + 1; i < Math.min(stuknummerIndex + 30, lines.length); i++) {
      const line = lines[i]
      const sixDigitMatches = line.match(/\b(\d{6})\b/g)
      if (sixDigitMatches) {
        for (const num of sixDigitMatches) {
          if (parseInt(num, 10) >= 100000 && parseInt(num, 10) < 999999 && !motorNumbers.includes(num)) {
            motorNumbers.push(num)
          }
        }
      }

      const flexibleMatches = line.match(/\b(\d{5,7})\b/g)
      if (flexibleMatches) {
        for (const num of flexibleMatches) {
          if (
            !motorNumbers.includes(num) &&
            num.length >= 5 &&
            parseInt(num, 10) >= 10000 &&
            parseInt(num, 10) < 9999999 &&
            (!/^\d{4}$/.test(num) || parseInt(num, 10) >= 2000)
          ) {
            motorNumbers.push(num)
          }
        }
      }
    }
  }

  if (motorNumbers.length === 0) {
    const sixDigitMatches = text.match(/\b(\d{6})\b/g)
    if (sixDigitMatches) {
      for (const num of sixDigitMatches) {
        if (
          parseInt(num, 10) >= 100000 &&
          parseInt(num, 10) < 999999 &&
          !motorNumbers.includes(num) &&
          num !== shippingNote
        ) {
          motorNumbers.push(num)
        }
      }
    }

    if (motorNumbers.length === 0) {
      const flexibleMatches = text.match(/\b(\d{5,7})\b/g)
      if (flexibleMatches) {
        for (const num of flexibleMatches) {
          if (
            !motorNumbers.includes(num) &&
            num.length >= 5 &&
            parseInt(num, 10) >= 10000 &&
            parseInt(num, 10) < 9999999 &&
            num !== shippingNote &&
            (!/^\d{4}$/.test(num) || parseInt(num, 10) >= 2000)
          ) {
            motorNumbers.push(num)
          }
        }
      }
    }
  }

  const uniqueMotorNumbers: string[] = []
  const seen = new Set<string>()
  for (const num of motorNumbers) {
    if (!seen.has(num)) {
      seen.add(num)
      uniqueMotorNumbers.push(num)
    }
  }

  return {
    shippingNote: shippingNote || null,
    motorNumbers: uniqueMotorNumbers,
  }
}

export function mergeCnhExtractResults(results: CnhPdfExtractResult[]): CnhPdfExtractResult {
  let shippingNote: string | null = null
  const motorNumbers: string[] = []
  const seen = new Set<string>()

  for (const result of results) {
    if (!shippingNote && result.shippingNote) {
      shippingNote = result.shippingNote
    }
    for (const num of result.motorNumbers) {
      if (!seen.has(num)) {
        seen.add(num)
        motorNumbers.push(num)
      }
    }
  }

  return { shippingNote, motorNumbers }
}

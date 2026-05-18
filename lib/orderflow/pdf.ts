import 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.ORDERFLOW_OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini'
const MIN_USEFUL_TEXT_CHARS = 100
const DEFAULT_MAX_VISION_PAGES = 6

const PDF_VISION_PROMPT = `You are an OCR assistant for B2B purchase order PDFs.

Read this PDF page image and return all visible text needed for order extraction.
Preserve line order, table structure, article codes, quantities, prices, dates, addresses, and customer references.
If the page contains a table, render it as plain text or markdown-like rows.

Return ONLY valid JSON:
{"text":"<all readable text from this page>"}

If no useful text is visible, return:
{"text":""}`

function getMaxVisionPages(): number {
  const parsed = Number(process.env.ORDERFLOW_PDF_VISION_MAX_PAGES || DEFAULT_MAX_VISION_PAGES)
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_VISION_PAGES
  return Math.min(Math.max(Math.trunc(parsed), 1), 12)
}

function parseVisionText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const text = (raw as Record<string, unknown>).text
  return typeof text === 'string' ? text.trim() : ''
}

async function callOpenAiPdfVision(base64Image: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PDF_VISION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  const rawBody = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI PDF vision error ${response.status}: ${rawBody.slice(0, 500)}`)
  }

  const result = JSON.parse(rawBody)
  const text: string = result.choices?.[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return ''

  return parseVisionText(JSON.parse(jsonMatch[0]))
}

async function extractTextWithVision(parser: PDFParse): Promise<string | null> {
  const screenshots = await parser.getScreenshot({ scale: 2, first: getMaxVisionPages() })
  const pages: string[] = []

  for (const [index, page] of screenshots.pages.entries()) {
    const imageData = page.data
    if (!imageData || (!(imageData instanceof Uint8Array) && !Buffer.isBuffer(imageData))) {
      continue
    }

    const pageText = await callOpenAiPdfVision(Buffer.from(imageData).toString('base64'))
    if (pageText) {
      pages.push(`## PDF page ${index + 1}\n\n${pageText}`)
    }
  }

  return pages.length > 0 ? pages.join('\n\n') : null
}

export async function extractOrderflowPdfText(buffer: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: buffer })
  let text = ''

  try {
    try {
      const pdfData = await parser.getText()
      text = (pdfData.text || '').trim()
    } catch (error) {
      console.error('Orderflow PDF text extraction failed:', error)
      text = ''
    }

    if (text.length >= MIN_USEFUL_TEXT_CHARS) {
      return text
    }

    try {
      const visionText = await extractTextWithVision(parser)
      return visionText || text || null
    } catch (error) {
      console.error('Orderflow PDF vision extraction failed:', error)
      return text || null
    }
  } finally {
    await parser.destroy()
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { callOpenAIVision, isLabelProvider, type LabelProvider } from '@/lib/labels/openai-vision'
import { isErrorResponse, scanLabelSchema, validateBody } from '@/lib/api/validation'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function normalizeItemNumber(raw: string): string {
  return raw.replace(/[\s\-\.]/g, '').toUpperCase()
}

interface LabelData {
  item_number: string | null
  quantity: number | null
  description: string | null
  po_line: string | null
  supplier: string | null
  date: string | null
  delivery_notice: string | null
  location: string | null
  receiver: string | null
}

const PREPACK_PROMPT = `Analyze this shipping/pallet label. Labels come in several layouts:

LAYOUT A - Atlas Copco / supplier pallet label (most common):
  Contains labelled fields such as "PART NO (P)", "QUANTITY (Q)", "P.O.NO-LINE (K)" or "O.NO-LINE (K)",
  "LOCATION (2L)", "SUPPLIER", "DELIVERY NOTICE", "SERIAL NUMBER (H)", "SHOP ORDER NUMBER (2P)",
  "DATE", "DESCRIPTION", "SUPPLIER CODE", "LABEL NUMBER". Each has its own barcode.

LAYOUT B - Foresco / Alteco / destination label:
  Big "FORESCO" text, smaller sticker with "Prepack", "QTY", "Dest", "Pallet", a large bold dashed
  item number like "1624-8375-00", and a description like "PIPE". No PART NO / P.O.NO-LINE fields.

Return ONLY valid JSON, no other text:

{
  "item_number": "...",
  "quantity": integer,
  "description": "...",
  "po_line": "...",
  "supplier": "...",
  "date": "YYYYMMDD",
  "delivery_notice": "...",
  "location": "...",
  "receiver": "..."
}

CRITICAL rules for item_number:
- LAYOUT A: item_number MUST be the value of the field labelled "PART NO (P)" / "PART NR" / "PART NO".
  This is the large bold number with its own barcode (typically 10 digits, often shown with spaces,
  e.g. "1621 1617 11" or "1503 9013 80"). Return it WITHOUT spaces (e.g. "1621161711").
- LAYOUT B (Foresco / Alteco): item_number is the large bold dashed number (e.g. "1624-8375-00").
  Keep the dashes as shown on the label.
- NEVER EVER take item_number from these fields — they are order/admin numbers, NOT item numbers:
    * P.O.NO-LINE, O.NO-LINE, PO LINE (bv. "487527-001", "471814-001")
    * SHOP ORDER NUMBER / 2P (bv. "Z017226467")
    * SERIAL NUMBER / H / AIA (bv. "801724")
    * DELIVERY NOTICE (bv. "0000000", "D006906")
    * SUPPLIER CODE (bv. "75112")
    * LABEL NUMBER (bv. "390249")
    * PALLET number (bv. "554884"), BackOrderQty, PrepackNr
  If the only candidate you see matches one of these fields, return item_number: null.

Rules for other fields:
- quantity: integer from "QUANTITY (Q)" on layout A, or "Qty"/"QTY" on layout B.
- po_line: from "P.O.NO-LINE (K)" / "O.NO-LINE (K)" only (e.g. "487527-001" or a long 12+ digit number). Null on layout B.
- delivery_notice: value from "DELIVERY NOTICE" or "SERIAL NUMBER (H)". Keep D-numbers (e.g. "D006906") as-is. "0" or "0000000" stays as given.
- location: short code like "FSILS", "BPTD", "FLSML", "FL3ML", usually near top-right. Strip trailing codes like "AID".
- receiver: company/address at top-left (e.g. "ATLAS COPCO B2610 WILRIJK SERVICE CENTER", "Power Tools Distribution").
- supplier: the supplier name (e.g. "ITK NV", "ALTECO N.V.").
- date: format YYYYMMDD. If the label shows "16/04/2026" return "20260416".
- description: the item description (DESCR on layout A, or the item text like "PIPE" / "CONNECTION").
- If a field is not readable or not present, use null.

Return ONLY the JSON object, nothing else`

function postProcessPrepack(parsed: any): LabelData {
  let itemNumber: string | null = parsed.item_number || null
  let poLine: string | null = parsed.po_line || null

  // Veiligheidscheck 1: het typische "P.O.NO-LINE" formaat (bv. 471814-001 / 487527-001) mag nooit
  // als item_number doorgaan. Als Claude dit toch meegeeft, zetten we het eventueel om naar po_line
  // en weigeren we het als item_number.
  const orderLineRe = /^\s*\d{4,8}-\d{1,4}\s*$/
  if (itemNumber && orderLineRe.test(itemNumber)) {
    if (!poLine) poLine = itemNumber.trim()
    itemNumber = null
  }

  // Veiligheidscheck 2: Atlas Copco part numbers zijn 10 cijfers, soms met spaties. Als Claude
  // een zuiver numerieke string van 10 cijfers gaf (met of zonder spaties) zetten we alvast de
  // spaties weg zodat matching in de DB werkt.
  if (itemNumber) {
    const compact = itemNumber.replace(/\s+/g, '')
    if (/^\d{10}$/.test(compact)) {
      itemNumber = compact
    } else {
      itemNumber = itemNumber.trim()
    }
  }

  // Veiligheidscheck 3: delivery_notice zoals "0", "0000000" of "Z01…" mag nooit per ongeluk als
  // itemnummer gebruikt worden.
  const deliveryNotice: string | null = parsed.delivery_notice || null
  if (itemNumber && deliveryNotice && itemNumber.trim() === deliveryNotice.trim()) {
    itemNumber = null
  }

  return {
    item_number: itemNumber,
    quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
    description: parsed.description || null,
    po_line: poLine,
    supplier: parsed.supplier || null,
    date: parsed.date || null,
    delivery_notice: deliveryNotice,
    location: parsed.location || null,
    receiver: parsed.receiver || null,
  }
}

async function extractLabelWithClaude(base64Image: string, mediaType: string): Promise<LabelData> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            { type: 'text', text: PREPACK_PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errBody}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text || ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude returned no valid JSON')
  }

  try {
    return postProcessPrepack(JSON.parse(jsonMatch[0]))
  } catch {
    throw new Error('Claude returned invalid JSON')
  }
}

async function extractLabelWithOpenAI(base64Image: string, mediaType: string): Promise<LabelData> {
  const parsed = (await callOpenAIVision(PREPACK_PROMPT, base64Image, mediaType)) as any
  return postProcessPrepack(parsed)
}

async function extractLabel(
  provider: LabelProvider,
  base64Image: string,
  mediaType: string
): Promise<LabelData> {
  if (provider === 'gpt5') {
    return extractLabelWithOpenAI(base64Image, mediaType)
  }
  return extractLabelWithClaude(base64Image, mediaType)
}

function detectLabelType(label: LabelData): 'prepack' | 'powertools' | 'd_nummer' {
  if (label.delivery_notice && /^D\d+$/i.test(label.delivery_notice.trim())) {
    return 'd_nummer'
  }
  const loc = (label.location || '').toUpperCase()
  const recv = (label.receiver || '').toUpperCase()
  const poLine = (label.po_line || '').trim()

  if (loc.startsWith('BPTD') || recv.includes('POWER TOOLS') || recv.includes('HASSELT')) {
    return 'powertools'
  }
  // Powertools P.O. lines are long numeric strings (12+ digits), regular prepack uses shorter formats like "487527-001"
  if (poLine.length >= 12 && /^\d+$/.test(poLine)) {
    return 'powertools'
  }
  return 'prepack'
}

export async function POST(request: Request) {
  try {
    const body = await validateBody(request, scanLabelSchema)
    if (isErrorResponse(body)) return body
    const { image, mediaType, provider: providerRaw } = body

    if (!image || !mediaType) {
      return NextResponse.json({ error: 'Missing image or mediaType' }, { status: 400 })
    }

    const activeProvider: LabelProvider = isLabelProvider(providerRaw) ? providerRaw : 'haiku'

    if (activeProvider === 'haiku' && !ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }
    if (activeProvider === 'gpt5' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const labelData = await extractLabel(activeProvider, image, mediaType)
    const labelType = detectLabelType(labelData)

    if (!labelData.item_number) {
      return NextResponse.json({
        label: labelData,
        labelType,
        matches: [],
        warning: 'Kon geen item nummer uitlezen van het label',
        provider: activeProvider,
      })
    }

    if (labelType === 'powertools') {
      return NextResponse.json({
        label: labelData,
        labelType,
        matches: [],
        warning: null,
        provider: activeProvider,
      })
    }

    if (labelType === 'd_nummer') {
      return NextResponse.json({
        label: labelData,
        labelType,
        matches: [],
        warning: null,
        provider: activeProvider,
      })
    }

    const normalizedScan = normalizeItemNumber(labelData.item_number)

    const { data: allItems, error } = await supabaseAdmin
      .from('incoming_goods')
      .select('*')

    if (error) throw error

    const matched = (allItems || []).filter((item: any) => {
      if (!item.item_number) return false
      const normalizedDb = normalizeItemNumber(item.item_number)
      return normalizedDb === normalizedScan
    })

    let warning: string | null = null
    if (matched.length === 0) {
      warning = `Geen items gevonden voor item nummer ${labelData.item_number}`
    } else if (labelData.quantity != null) {
      const totalQty = matched.reduce((sum: number, m: any) => sum + (m.amount || 0), 0)
      if (totalQty !== labelData.quantity) {
        warning = `Let op: label toont ${labelData.quantity} stuks, maar in de lijst staan ${totalQty} stuks voor dit item`
      }
    }

    return NextResponse.json({
      label: labelData,
      labelType,
      matches: matched.map((m: any) => ({
        id: m.id,
        item_number: m.item_number,
        po_number: m.po_number,
        amount: m.amount,
        date_added: m.date_added,
      })),
      warning,
      provider: activeProvider,
    })
  } catch (err: any) {
    console.error('Scan label error:', err)
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 })
  }
}

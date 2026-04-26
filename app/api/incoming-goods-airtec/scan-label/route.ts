import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { scanLabelSchema, validateBody, isErrorResponse } from '@/lib/api/validation'
import { callOpenAIVision, type LabelProvider } from '@/lib/labels/openai-vision'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function normalizeItemNumber(raw: string): string {
  return raw.replace(/[\s\-\.]/g, '').toUpperCase()
}

interface LabelData {
  item_number: string | null
  quantity: number | null
  description: string | null
  serial_numbers: string[]
  label_type: 'airtec' | 'cooler' | 'unknown'
}

const AIRTEC_PROMPT = `Analyze this shipping/pallet label. It can be one of two types:

TYPE 1 - Atlas Copco Airtec label (has fields like PART NR, DESCR, QUANTITY (Q), NET WT, AIA serial numbers)
TYPE 2 - Foresco cooler label (simple label with "FORESCO", a part number like "1621700.301", and "AANTAL: X")

Return ONLY valid JSON:

{
  "label_type": "airtec" or "cooler" or "unknown",
  "item_number": "the part number / item number",
  "quantity": numeric quantity (from QUANTITY or AANTAL field),
  "description": "the description if visible (DESCR field for airtec, null for cooler)",
  "serial_numbers": ["array of AIA serial numbers if visible, empty array otherwise"]
}

CRITICAL rules for item_number on Atlas Copco / airtec labels:
- item_number MUST come from the field labeled "PART NR" (or "PART NO", "PARTNR"), printed with its own
  wide barcode. On Atlas Copco labels this is ALWAYS a 10-digit number shown with spaces in a 4-4-2
  grouping, e.g. "1616 7472 81", "1616 5803 81", "1616 7418 83". Return it WITHOUT spaces
  (e.g. "1616747281").
- NEVER use values from these fields — they are NOT the item number:
    * "PO NO-LINE NO" / "NO-LINE NO" / "LINE NO" — format "501965-001", "507371-001", "489260-001"
      (6 digits, hyphen, 3-digit suffix). ALWAYS has a hyphen.
    * "SUPPLIER CODE (V)" — typically "10000", 4-6 digits.
    * "PARCEL NR (S)" — 9-digit number like "058702896", "058703059".
    * "DELIVERY NOTICE" — 7-digit number like "5019651", "5073711", "4892601".
    * "SERIALNR" / "SERIAL NO" / "AIA..." — serial numbers of individual parts.
    * "DESTINATION (2L)" — alphanumeric like "PACK-PCSOF", "PACK".
- Any candidate that is not exactly 10 digits (after stripping spaces) is NOT a PART NR. If the only
  candidate you see has a hyphen, or is shorter/longer than 10 digits, return null.

CRITICAL rules for quantity on Atlas Copco / airtec labels:
- quantity MUST come from the field labeled "QUANTITY (Q)" or "QTY (Q)". Its barcode is narrow.
  Typical values: 1, 2, 3.
- NEVER use values from these fields — they are NOT quantity:
    * "NET WT (KG)" / "GROSS WT (KG)" — weight in KILOGRAM. Values like 99, 140, 240 are weight,
      not quantity.
    * "L/W/H (CM)" — dimensions. Values like "607 X 443 X 383" are dimensions.
    * Any field containing "WT", "WEIGHT", "KG", "CM" → NOT quantity.

CRITICAL rules for serial_numbers on Atlas Copco / airtec labels — READ CAREFULLY:
- The "SERIALNR" (or "SERIAL NR") field is MANDATORY to read. Do not leave it empty unless the
  field really does not exist on the label.
- The field is located in the middle-right part of the label, to the right of the DESC/QUANTITY area,
  usually printed in SMALL font (smaller than PART NR). Zoom in mentally and read every character.
- Each serial almost always has the format: "AIA" + 7 digits, optionally followed by one trailing
  letter. Concrete examples: "AIA3263118", "AIA3233780", "AIA3259530", "AIA3259522W", "AIA3272798".
- Multiple serials on the same label are space-separated on the same line, for example:
    "AIA3233780 AIA3259530 AIA3259520"
    "AIA3263118 2WAIA3263118"
    "AIA3259524 AIA3259527 AIA3259522W"
  Return EACH serial as a separate array element, do NOT glue them together.
- Some serials are printed twice on the label with a "2W" prefix (e.g. "AIA3263118" alongside
  "2WAIA3263118"). These are duplicates of the same physical part — include both in the array;
  the server will deduplicate. Do not skip one thinking it is redundant.
- The NUMBER of distinct "AIA..."-prefixed serials on the label should roughly match QUANTITY.
  If quantity = 3 but you see only 1 or 2 serials, LOOK AGAIN at the SERIALNR line — there is
  almost certainly a third one you missed due to small font or low contrast.
- Do a final OCR pass on the SERIALNR field before finalising the JSON. Prefer returning a best-guess
  serial over returning nothing; an approximate serial still helps downstream matching.
- Example correct outputs:
    qty=1, 1 serial shown: ["AIA3263118"]
    qty=1, with 2W duplicate: ["AIA3263118", "2WAIA3263118"]
    qty=3 with 3 serials: ["AIA3233780", "AIA3259530", "AIA3259520"]

Rules for cooler labels:
- item_number is the number on the label (e.g. "1621700.301"), quantity from AANTAL.

General:
- quantity must be an integer.
- If a field is not readable or rules forbid the only visible candidate, use null.
- Return ONLY the JSON object.`

function postProcessAirtec(parsed: any): LabelData {
  let itemNumber: string | null = parsed.item_number || null
  const labelType: LabelData['label_type'] =
    parsed.label_type === 'cooler' ? 'cooler' : parsed.label_type === 'airtec' ? 'airtec' : 'unknown'

  if (itemNumber && labelType === 'cooler') {
    itemNumber = itemNumber.replace(/\./g, '')
  }

  // Veiligheidscheck: Atlas Copco labels hebben vaak een "NO-LINE NO" (formaat 6 cijfers-3 cijfers,
  // bv. 393603-001) die geen echt itemnummer is. Weiger dat expliciet voor airtec-labels.
  if (itemNumber && labelType === 'airtec') {
    const trimmed = itemNumber.trim()
    const looksLikeOrderLine = /^\d{4,8}-\d{1,4}$/.test(trimmed)
    if (looksLikeOrderLine) {
      itemNumber = null
    }
  }

  // Strikte PART NR validatie: altijd exact 10 cijfers na het strippen van spaties.
  // Alles anders is waarschijnlijk PO-LINE / parcel nr / delivery notice.
  if (itemNumber && labelType === 'airtec') {
    const digits = itemNumber.replace(/\s+/g, '')
    if (!/^\d{10}$/.test(digits)) {
      itemNumber = null
    } else {
      itemNumber = digits
    }
  }

  // Serials opkuisen: "2W"-prefix strippen zodat "AIA3263118" en "2WAIA3263118" als 1 serial gelden.
  const rawSerials: string[] = Array.isArray(parsed.serial_numbers) ? parsed.serial_numbers : []
  const cleanedSerials: string[] = []
  const seen = new Set<string>()
  for (const s of rawSerials) {
    if (typeof s !== 'string') continue
    let v = s.trim()
    if (!v) continue
    v = v.replace(/^2W/i, '')
    const key = v.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    cleanedSerials.push(v)
  }

  return {
    item_number: itemNumber,
    quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
    description: parsed.description || null,
    serial_numbers: cleanedSerials,
    label_type: labelType,
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
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            { type: 'text', text: AIRTEC_PROMPT },
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

  return postProcessAirtec(JSON.parse(jsonMatch[0]))
}

async function extractLabelWithOpenAI(base64Image: string, mediaType: string): Promise<LabelData> {
  const parsed = (await callOpenAIVision(AIRTEC_PROMPT, base64Image, mediaType)) as any
  return postProcessAirtec(parsed)
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

async function lookupKistnummer(itemNumber: string): Promise<string | null> {
  const { data: incomingData } = await supabaseAdmin
    .from('incoming_goods_airtec')
    .select('kistnummer')
    .eq('item_number', itemNumber)
    .not('kistnummer', 'is', null)
    .order('datum_ontvangen', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (incomingData?.kistnummer) return incomingData.kistnummer

  const { data: packedData } = await supabaseAdmin
    .from('packed_items_airtec')
    .select('kistnummer')
    .eq('item_number', itemNumber)
    .not('kistnummer', 'is', null)
    .order('date_packed', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (packedData?.kistnummer) return packedData.kistnummer

  const { data: unlistedData } = await supabaseAdmin
    .from('airtec_unlisted_items')
    .select('kistnummer')
    .eq('item_number', itemNumber)
    .not('kistnummer', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return unlistedData?.kistnummer || null
}

export async function POST(request: Request) {
  try {
    const parsed = await validateBody(request, scanLabelSchema)
    if (isErrorResponse(parsed)) return parsed

    const { image, mediaType, provider } = parsed
    const activeProvider: LabelProvider = provider || 'haiku'

    if (activeProvider === 'haiku' && !ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }
    if (activeProvider === 'gpt5' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    const labelData = await extractLabel(activeProvider, image, mediaType)

    if (!labelData.item_number) {
      return NextResponse.json({
        label: labelData,
        matches: [],
        warning: 'Kon geen item nummer uitlezen van het label',
        kistnummer: null,
        provider: activeProvider,
      })
    }

    const normalizedScan = normalizeItemNumber(labelData.item_number)

    // For cooler labels: skip incoming_goods matching, do kistnummer lookup
    if (labelData.label_type === 'cooler') {
      const kistnummer = await lookupKistnummer(labelData.item_number)

      return NextResponse.json({
        label: labelData,
        matches: [],
        warning: null,
        kistnummer,
        provider: activeProvider,
      })
    }

    // For airtec labels: match against incoming_goods_airtec
    const { data: allItems, error } = await supabaseAdmin
      .from('incoming_goods_airtec')
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
      const totalQty = matched.reduce((sum: number, m: any) => sum + (m.quantity || 0), 0)
      if (totalQty !== labelData.quantity) {
        warning = `Let op: label toont ${labelData.quantity} stuks, maar in de lijst staan ${totalQty} stuks`
      }
    }

    // If no matches for airtec label either, try kistnummer lookup
    const kistnummer = matched.length === 0 ? await lookupKistnummer(labelData.item_number) : null

    return NextResponse.json({
      label: labelData,
      matches: matched.map((m: any) => ({
        id: m.id,
        item_number: m.item_number,
        beschrijving: m.beschrijving,
        quantity: m.quantity,
        lot_number: m.lot_number,
        kistnummer: m.kistnummer,
      })),
      warning,
      kistnummer,
      provider: activeProvider,
    })
  } catch (err) {
    console.error('Scan label error:', err)
    return NextResponse.json({ error: 'Label scan mislukt' }, { status: 500 })
  }
}

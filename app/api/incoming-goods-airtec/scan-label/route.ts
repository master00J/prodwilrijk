import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { scanLabelSchema, validateBody, isErrorResponse } from '@/lib/api/validation'

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
            {
              type: 'text',
              text: `Analyze this shipping/pallet label. It can be one of two types:

TYPE 1 - Atlas Copco Airtec label (has fields like PART NR, DESCR, QUANTITY, AIA serial numbers)
TYPE 2 - Foresco cooler label (simple label with "FORESCO", a part number like "1621700.301", and "AANTAL: X")

Return ONLY valid JSON:

{
  "label_type": "airtec" or "cooler" or "unknown",
  "item_number": "the part number / item number",
  "quantity": numeric quantity (from QUANTITY or AANTAL field),
  "description": "the description if visible (DESCR field for airtec, null for cooler)",
  "serial_numbers": ["array of AIA serial numbers if visible, empty array otherwise"]
}

Rules:
- For cooler labels: item_number is the number on the label (e.g. "1621700.301"), quantity from AANTAL
- For airtec labels: item_number from PART NR, quantity from QUANTITY, description from DESCR
- Keep original formatting of item_number as shown on label
- quantity must be an integer
- If a field is not readable, use null
- Return ONLY the JSON object`,
            },
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

  const parsed = JSON.parse(jsonMatch[0])
  return {
    item_number: parsed.item_number || null,
    quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
    description: parsed.description || null,
    serial_numbers: Array.isArray(parsed.serial_numbers) ? parsed.serial_numbers : [],
    label_type: parsed.label_type === 'cooler' ? 'cooler' : parsed.label_type === 'airtec' ? 'airtec' : 'unknown',
  }
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
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Server configuratie fout' }, { status: 500 })
  }

  try {
    const parsed = await validateBody(request, scanLabelSchema)
    if (isErrorResponse(parsed)) return parsed

    const { image, mediaType } = parsed
    const labelData = await extractLabelWithClaude(image, mediaType)

    if (!labelData.item_number) {
      return NextResponse.json({
        label: labelData,
        matches: [],
        warning: 'Kon geen item nummer uitlezen van het label',
        kistnummer: null,
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
    })
  } catch (err) {
    console.error('Scan label error:', err)
    return NextResponse.json({ error: 'Label scan mislukt' }, { status: 500 })
  }
}

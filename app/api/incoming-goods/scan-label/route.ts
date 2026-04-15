import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

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
              text: `Analyze this shipping/pallet label from Atlas Copco. Extract the following fields and return ONLY valid JSON, no other text:

{
  "item_number": "the PART NO (P) value (large bold number, e.g. 1503 9013 80)",
  "quantity": numeric quantity (the QUANTITY (Q) field),
  "description": "the DESCRIPTION field at the bottom of the label",
  "po_line": "the P.O.NO-LINE (K) value (e.g. 487527-001)",
  "supplier": "the SUPPLIER name",
  "date": "the DATE field (format YYYYMMDD)",
  "delivery_notice": "the DELIVERY NOTICE or SERIAL NUMBER (H) field (e.g. D006906, 0)"
}

Rules:
- For item_number: keep original spacing/formatting as shown on label
- For quantity: return as integer number
- For po_line: this is sometimes labeled as P.O.NO-LINE or Purchase Order
- For delivery_notice: this is labeled DELIVERY NOTICE or SERIAL NUMBER (H). Values like "0" should be returned as "0", D-numbers like "D006906" should be kept as-is
- If a field is not readable or not present, use null
- Return ONLY the JSON object, nothing else`,
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
    po_line: parsed.po_line || null,
    supplier: parsed.supplier || null,
    date: parsed.date || null,
    delivery_notice: parsed.delivery_notice || null,
  }
}

export async function POST(request: Request) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { image, mediaType } = body

    if (!image || !mediaType) {
      return NextResponse.json({ error: 'Missing image or mediaType' }, { status: 400 })
    }

    const labelData = await extractLabelWithClaude(image, mediaType)

    if (!labelData.item_number) {
      return NextResponse.json({
        label: labelData,
        matches: [],
        warning: 'Kon geen item nummer uitlezen van het label',
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
      matches: matched.map((m: any) => ({
        id: m.id,
        item_number: m.item_number,
        po_number: m.po_number,
        amount: m.amount,
        date_added: m.date_added,
      })),
      warning,
    })
  } catch (err: any) {
    console.error('Scan label error:', err)
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 })
  }
}

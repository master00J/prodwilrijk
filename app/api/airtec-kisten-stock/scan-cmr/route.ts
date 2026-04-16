import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface CmrItem {
  erp_code: string
  description: string | null
  amount: number
}

async function extractCmrWithClaude(base64Data: string, mediaType: string): Promise<CmrItem[]> {
  const isPdf = mediaType === 'application/pdf'
  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `This is a CMR Summary / delivery note from Foresco for packaging materials (stagekisten/crates).

Extract ALL line items from this document. Each line has:
- Item No (ERP code like "GP005700", "GP005701", etc.)
- A description line below with details (e.g. "9424-6001-92 STAGEKIST192 HT...")
- Amount (quantity delivered)

Return ONLY valid JSON array:

[
  {
    "erp_code": "GP005700",
    "description": "STAGEKIST192 ...",
    "amount": 180
  }
]

Rules:
- Extract EVERY line item, including non-stagekist items (AC PALLET, AC RING, etc.)
- erp_code is the "Item No" field (starts with GP or is a numeric code like 108138)
- amount must be an integer
- description should include the STAGEKIST name if present
- If amount is 0, still include the item
- Return ONLY the JSON array, no other text`,
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
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Claude returned no valid JSON array')

  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array')

  return parsed.map((item: any) => ({
    erp_code: String(item.erp_code || '').trim(),
    description: item.description || null,
    amount: Number(item.amount) || 0,
  })).filter((item: CmrItem) => item.erp_code && item.amount > 0)
}

export const POST = withAuth(async (request) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI niet geconfigureerd (ANTHROPIC_API_KEY ontbreekt)' }, { status: 500 })
    }

    const body = await request.json()
    const { image, mediaType } = body

    if (!image || !mediaType) {
      return NextResponse.json({ error: 'Afbeelding is verplicht' }, { status: 400 })
    }

    let cmrItems: CmrItem[]
    try {
      cmrItems = await extractCmrWithClaude(image, mediaType)
    } catch (err: any) {
      console.error('CMR scan error:', err)
      return NextResponse.json({ error: `Scan mislukt: ${err.message || 'onbekende fout'}` }, { status: 500 })
    }

    // Match CMR items tegen bestaande kisten stock via erp_code
    const { data: stockRows, error: stockError } = await supabaseAdmin
      .from('airtec_kisten_stock')
      .select('id, kistnummer, erp_code, huidige_voorraad')

    if (stockError) {
      console.error('Stock query error:', stockError)
      return NextResponse.json({ error: 'Fout bij ophalen stock data. Is de tabel al aangemaakt?' }, { status: 500 })
    }

    const erpToStock = new Map<string, any>()
    ;(stockRows || []).forEach((row: any) => {
      if (row.erp_code) erpToStock.set(row.erp_code.toUpperCase().trim(), row)
    })

    const matched: any[] = []
    const unmatched: any[] = []

    cmrItems.forEach((item) => {
      const stockRow = erpToStock.get(item.erp_code.toUpperCase().trim())
      if (stockRow) {
        matched.push({
          erp_code: item.erp_code,
          kistnummer: stockRow.kistnummer,
          description: item.description,
          amount: item.amount,
          current_stock: stockRow.huidige_voorraad,
          stock_id: stockRow.id,
        })
      } else {
        unmatched.push({
          erp_code: item.erp_code,
          description: item.description,
          amount: item.amount,
        })
      }
    })

    return NextResponse.json({ matched, unmatched })
  } catch (err: any) {
    console.error('CMR scan unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Onverwachte fout' }, { status: 500 })
  }
})

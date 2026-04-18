const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export interface StockCountLabel {
  item_number: string | null
  quantity: number | null
  pallet_number: string | null
  description: string | null
  po_line: string | null
  location: string | null
  shop_order: string | null
  date: string | null
  label_type: 'atlas' | 'foresco' | 'unknown'
  raw_text_hint: string | null
}

const PROMPT = `Je krijgt een foto van een pallet-label van Atlas Copco (of een interne prodwilrijk/Foresco-sticker). Analyseer het label en retourneer ALLEEN één JSON-object.

Mogelijke layouts:

LAYOUT A — Atlas Copco supplier/pallet label:
  Velden met labels: "PART NO (P)", "QUANTITY (Q)", "P.O.NO-LINE (K)" of "O.NO-LINE (K)",
  "LOCATION (2L)", "SUPPLIER", "DELIVERY NOTICE", "SERIAL NUMBER (H)", "SHOP ORDER NUMBER (2P)",
  "DATE", "DESCRIPTION", "SUPPLIER CODE", "LABEL NUMBER". Elk met eigen barcode.
  Soms is er ook een kleinere sticker met "Pallet: <nummer>" op hetzelfde pallet aangebracht.

LAYOUT B — prodwilrijk/Foresco/Alteco bestemmingslabel:
  Groot veld met itemnummer met streepjes zoals "2204-2311-78", aparte velden
  "Pallet:", "Qty", "Dest", "Prepack", "QA", "BackOrderQty". Itemnummer is het grote vetgedrukte
  nummer, niet de P.O./Prepack/Dest waarde.

Lever dit JSON-object aan, met null voor ontbrekende velden:

{
  "item_number": "<10 cijfers, zonder spaties/streepjes>",
  "quantity": <integer>,
  "pallet_number": "<palletnummer als zichtbaar, anders null>",
  "description": "<artikelomschrijving>",
  "po_line": "<P.O.NO-LINE waarde als zichtbaar>",
  "location": "<korte locatiecode zoals S5XMV, FSILS, FLSML, FL2ML>",
  "shop_order": "<SHOP ORDER NUMBER (2P) zoals Z017219486>",
  "date": "YYYYMMDD",
  "label_type": "atlas" | "foresco" | "unknown",
  "raw_text_hint": "<korte samenvatting voor debugging, max 80 tekens>"
}

REGELS voor item_number:
- Layout A: waarde van veld "PART NO (P)" / "PART NR" / "PART NO". Dit is het grote vetgedrukte nummer
  met eigen barcode (10 cijfers, vaak getoond met spaties zoals "1830 1624 96"). Geef zonder spaties
  terug: "1830162496".
- Layout B: het grote vetgedrukte nummer met streepjes (bv. "2204-2311-78"). Geef zonder streepjes
  terug: "2204231178".
- NOOIT nemen uit deze velden (dit zijn géén itemnummers):
    * P.O.NO-LINE / O.NO-LINE (bv. "487527-001", "471814-001")
    * SHOP ORDER NUMBER / 2P (bv. "Z017219486")
    * SERIAL NUMBER / H / AIA
    * DELIVERY NOTICE (bv. "0000000", "D006906")
    * SUPPLIER CODE, LABEL NUMBER, BackOrderQty, Prepack, Dest
    * PALLET nummer
  Als het enige kandidaatnummer dat je ziet in deze lijst staat, zet item_number op null.

REGELS voor pallet_number:
- Op Layout B: duidelijk het "Pallet:" veld (bv. "552908"), meestal 6 cijfers.
- Op Layout A: vaak niet aanwezig op de hoofdsticker, soms op een kleinere witte sticker met de
  tekst "Pallet" of "Pallet:" ernaast, of onderaan naast het itemnummer. Alleen extraheren als je
  duidelijk "Pallet" ziet staan, anders null.
- 6-cijferig nummer of met spatie; retourneer cijfers zonder spatie.

REGELS voor quantity:
- Layout A: waarde van "QUANTITY (Q)". Vaak 1.
- Layout B: "Qty" of "QTY".

Geef ALLEEN het JSON-object terug, geen uitleg.`

function normalizeDigits(input: string | null): string | null {
  if (!input) return null
  const compact = String(input).replace(/[\s\-.]/g, '').trim()
  return compact || null
}

export async function extractStockCountLabel(
  base64Image: string,
  mediaType: string
): Promise<StockCountLabel> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY niet geconfigureerd')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
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
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errBody.slice(0, 300)}`)
  }

  const result = await response.json()
  const text: string = result?.content?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude gaf geen geldige JSON terug')
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<StockCountLabel>

  let item = normalizeDigits(parsed.item_number ?? null)
  const pallet = normalizeDigits(parsed.pallet_number ?? null)

  // Veiligheid: PO-line ("471814-001") nooit als item accepteren
  if (item && /^\d{4,8}-\d{1,4}$/.test(String(parsed.item_number || ''))) {
    item = null
  }

  const labelType: StockCountLabel['label_type'] =
    parsed.label_type === 'atlas' || parsed.label_type === 'foresco'
      ? parsed.label_type
      : 'unknown'

  return {
    item_number: item,
    quantity:
      parsed.quantity != null && Number.isFinite(Number(parsed.quantity))
        ? Number(parsed.quantity)
        : null,
    pallet_number: pallet,
    description: parsed.description || null,
    po_line: parsed.po_line || null,
    location: parsed.location || null,
    shop_order: parsed.shop_order || null,
    date: parsed.date || null,
    label_type: labelType,
    raw_text_hint: parsed.raw_text_hint || null,
  }
}

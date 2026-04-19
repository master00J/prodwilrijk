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
  receiver: string | null
  label_type: 'atlas' | 'foresco' | 'unknown'
  raw_text_hint: string | null
}

const PROMPT = `Je krijgt een foto van een pallet-label van Atlas Copco (of een interne prodwilrijk/Foresco-sticker). Analyseer het label en retourneer ALLEEN één JSON-object.

Mogelijke layouts:

LAYOUT A — Atlas Copco supplier/pallet label:
  Velden met labels: "PART NO (P)", "QUANTITY (Q)", "P.O.NO-LINE (K)" of "O.NO-LINE (K)",
  "LOCATION (2L)", "SUPPLIER", "DELIVERY NOTICE", "SERIAL NUMBER (H)", "SHOP ORDER NUMBER (2P)",
  "DATE", "DESCRIPTION", "SUPPLIER CODE (V)", "LABEL NUMBER (S)". Elk veld heeft een eigen barcode.
  Linksboven staat de RECEIVER (ontvanger), bv. "ATLAS COPCO B2610 WILRIJK SERVICE CENTER".
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
  "receiver": "<ontvanger linksboven, bv. 'ATLAS COPCO B2610 WILRIJK SERVICE CENTER'>",
  "label_type": "atlas" | "foresco" | "unknown",
  "raw_text_hint": "<korte samenvatting voor debugging, max 80 tekens>"
}

REGELS voor item_number (zeer belangrijk — GEEN verwarring met LABEL NUMBER):
- Layout A: waarde van veld "PART NO (P)" / "PART NR" / "PART NO". Dit is:
    * Het GROOTSTE vetgedrukte nummer van het hele label (veel groter dan de andere velden).
    * ALTIJD 10 cijfers.
    * Getoond met spaties in een "4-4-2"-groepering (bv. "2204 2096 03", "1830 1624 96", "1616 6224 00").
    * Staat bovenaan in de linker kolom, met een BREED barcode eronder dat bijna de hele kolom
      beslaat.
  Geef terug zonder spaties: "2204209603".
- Layout B: het grote vetgedrukte nummer met streepjes (bv. "2204-2311-78"). 10 cijfers met
  streepjes. Geef zonder streepjes terug: "2204231178".
- NOOIT het item_number halen uit deze velden (dit zijn GEEN itemnummers):
    * LABEL NUMBER (S) — bv. "17211815", "267206103", "17211815". Meestal 7–9 cijfers en het
      veld staat linksonder, een stuk KLEINER dan PART NO, en is duidelijk gelabeld "LABEL NUMBER"
      of "(S)". Dit wordt VAAK foutief aangezien voor PART NO — doe dat niet.
    * SUPPLIER CODE (V) — bv. "73864", "72803". 4–6 cijfers, in de linker kolom onder SUPPLIER.
    * P.O.NO-LINE / O.NO-LINE (K) — bv. "494808-001", "487527-001", "471814-001".
    * SHOP ORDER NUMBER / 2P — bv. "Z017219486", "0000000".
    * SERIAL NUMBER / H / AIA — bv. "801724", "267206103", "147703057".
    * DELIVERY NOTICE — bv. "0000000", "D006906".
    * PALLET nummer, BackOrderQty, Prepack, Dest.
  VERIFICATIE: als de kandidaat NIET exact 10 cijfers is, is het zeker geen PART NO. Zet dan
  item_number op null.

REGELS voor pallet_number:
- Op Layout B (prodwilrijk/Foresco): duidelijk het "Pallet:" veld (bv. "552908"), meestal 6 cijfers.
- Op Layout A (Atlas Copco): GEBRUIK "PARCEL NR (S)" — dit is een uniek nummer dat de fysieke pallet/
  colli identificeert. Format: meestal 9 cijfers, vaak beginnend met nullen (bv. "058702896",
  "058703116", "058703117", "058703059"). Het staat linksonder het label, met een barcode eronder,
  vlak boven of naast "SUPPLIER CODE (V)". Retourneer het nummer EXACT zoals het op het label staat,
  inclusief eventuele voorloopnullen.
  * Soms is er ook een losse witte sticker met "Pallet: <nummer>"; als die duidelijk aanwezig is,
    gebruik die in plaats van PARCEL NR.
  * Als PARCEL NR helemaal niet leesbaar is, null.
- Retourneer cijfers zonder spaties/streepjes.

REGELS voor receiver:
- Layout A: de eerste regel(s) linksboven, direct boven "P.O.NO-LINE". Typisch:
  "ATLAS COPCO B2610 WILRIJK SERVICE CENTER", "Power Tools Distribution Hasselt". Geef de volledige
  tekst op 1 of 2 regels gecombineerd terug.
- Layout B: null.

REGELS voor quantity (zeer belangrijk — GEEN verwarring met GEWICHT):
- Layout A: UITSLUITEND de waarde van het veld met label "QUANTITY (Q)" of "QTY (Q)".
  * Dit veld heeft zijn eigen barcode eronder.
  * Waarde is typisch een klein geheel getal (1, 2, 4, 10, ...). Vaak 1 of 2.
- NOOIT de quantity halen uit deze velden (dit zijn GEEN aantallen):
    * "NET WT (KG)" / "NET WEIGHT" — bv. 124, 87, 340. Dit is het GEWICHT IN KILOGRAM, niet het aantal.
      Dit veld staat bovenaan in de rechter helft van het label, op dezelfde regel als
      "GROSS WT (KG)" en "BOX TYPE". Gebruik deze waarde nooit als quantity.
    * "GROSS WT (KG)" / "GROSS WEIGHT" — ook gewicht, geen aantal.
    * "BOX TYPE" — bv. 999. Verpakkingstype, geen aantal.
    * "LOCATION", "SUPPLIER CODE", "LABEL NUMBER", datums (20260413), barcodes.
  VERIFICATIE: als het veld direct gelabeld is met "WT", "WEIGHT", "KG", "GEWICHT" of "BOX TYPE",
  dan is dit GEEN quantity. Als je twijfelt tussen twee kandidaten, kies het getal dat
  EXPLICIET onder een "QUANTITY" / "QTY" label staat, niet het grootste of meest opvallende getal.
- Layout B: "Qty" of "QTY" veld.

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

  // Veiligheid 1: PO-line ("471814-001") nooit als item accepteren
  if (item && /^\d{4,8}-\d{1,4}$/.test(String(parsed.item_number || ''))) {
    item = null
  }

  // Veiligheid 2: Atlas PART NO is ALTIJD exact 10 cijfers. Alles anders is waarschijnlijk
  // LABEL NUMBER / SUPPLIER CODE / SERIAL NUMBER — weigeren.
  if (item && !/^\d{10}$/.test(item)) {
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
    receiver: parsed.receiver ? String(parsed.receiver).trim() : null,
    label_type: labelType,
    raw_text_hint: parsed.raw_text_hint || null,
  }
}

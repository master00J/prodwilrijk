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
  label_type: 'atlas' | 'foresco' | 'packed' | 'unknown'
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

LAYOUT C — interne packed-kist sticker (reeds verpakte kist bij ons in opslag):
  Velden: "Item No.:" (bv. "PVAR00014" — interne variant-code, NIET het itemnummer),
  "Variant Code" (bv. "V00029192"), "Description:" waarin het ECHTE itemnummer staat tussen haakjes
  (bv. "480X430X340 KIST ISPM15 MPXM (1830116081)" → itemnummer = 1830116081),
  "Owner Name:" (bv. "K4311 - Atlas Copco Airp.-Service Center EDI2 VC74905 AID"),
  "Gross Weight (KG):", en drie dimensie-velden "Lengte [mm]", "Breedte [mm]", "Hoogte [mm]".
  Elke kist = ALTIJD 1 stuk.

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
  "label_type": "atlas" | "foresco" | "packed" | "unknown",
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
- Layout C (packed-kist): het 10-cijferig nummer dat TUSSEN HAAKJES in het "Description:"-veld staat.
    Voorbeeld: "480X430X340 KIST ISPM15 MPXM (1830116081)" → item_number = "1830116081".
    NIET gebruiken als item_number op layout C:
      * "Item No.:" (PVAR...) — dit is een interne variant-template, GEEN itemnummer.
      * "Variant Code" (V...) — instance-ID, GEEN itemnummer.
      * De afmetingen (bv. "480X430X340") — dit is de kistgrootte, GEEN itemnummer.
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
    * PVAR-code of V-code van layout C.
  VERIFICATIE: als de kandidaat NIET exact 10 cijfers is, is het zeker geen itemnummer. Zet dan
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
- Op Layout C (packed-kist): gebruik de "Variant Code" (bv. "V00029192"). Dit is het unieke
  instance-ID van de fysieke kist en dient zo als palletnummer. Retourneer de volledige code
  (inclusief de "V"-prefix).
- Retourneer cijfers zonder spaties/streepjes (voor layout C: prefix V blijft wél behouden).

REGELS voor receiver:
- Layout A: de eerste regel(s) linksboven, direct boven "P.O.NO-LINE". Typisch:
  "ATLAS COPCO B2610 WILRIJK SERVICE CENTER", "Power Tools Distribution Hasselt". Geef de volledige
  tekst op 1 of 2 regels gecombineerd terug.
- Layout B: null.
- Layout C: het "Owner Name:"-veld, bv. "K4311 - Atlas Copco Airp.-Service Center EDI2 VC74905 AID".

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
    * "Lengte [mm]", "Breedte [mm]", "Hoogte [mm]" — dimensies op layout C, GEEN aantal.
  VERIFICATIE: als het veld direct gelabeld is met "WT", "WEIGHT", "KG", "GEWICHT", "BOX TYPE",
  "mm" of "Lengte/Breedte/Hoogte", dan is dit GEEN quantity. Als je twijfelt tussen twee kandidaten,
  kies het getal dat EXPLICIET onder een "QUANTITY" / "QTY" label staat, niet het grootste of meest
  opvallende getal.
- Layout B: "Qty" of "QTY" veld.
- Layout C (packed-kist): ALTIJD 1. Elke kist-sticker staat voor exact 1 stuk, ongeacht afmetingen
  of gewicht.

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

  const labelType: StockCountLabel['label_type'] =
    parsed.label_type === 'atlas' ||
    parsed.label_type === 'foresco' ||
    parsed.label_type === 'packed'
      ? parsed.label_type
      : 'unknown'

  let item = normalizeDigits(parsed.item_number ?? null)

  // Veiligheid 1: PO-line ("471814-001") nooit als item accepteren
  if (item && /^\d{4,8}-\d{1,4}$/.test(String(parsed.item_number || ''))) {
    item = null
  }

  // Fallback voor layout C: als de AI het itemnummer niet uit de haakjes in de description haalde,
  // probeer het zelf uit parsed.description te extraheren. Format: "... (1830116081)".
  if (!item && labelType === 'packed' && parsed.description) {
    const m = String(parsed.description).match(/\((\d{10})\)/)
    if (m) item = m[1]
  }

  // Veiligheid 2: itemnummers zijn ALTIJD exact 10 cijfers. Alles anders is waarschijnlijk
  // LABEL NUMBER / SUPPLIER CODE / SERIAL NUMBER / PVAR / V-code — weigeren.
  if (item && !/^\d{10}$/.test(item)) {
    item = null
  }

  // Pallet_number: voor layout C mag de V-prefix behouden blijven; voor andere layouts strippen.
  let pallet: string | null
  if (labelType === 'packed' && parsed.pallet_number) {
    pallet = String(parsed.pallet_number).replace(/\s+/g, '').trim() || null
  } else {
    pallet = normalizeDigits(parsed.pallet_number ?? null)
  }

  // Layout C: aantal is altijd 1 (forceer, ook als AI iets anders gaf zoals gewicht/afmeting).
  let quantity: number | null =
    parsed.quantity != null && Number.isFinite(Number(parsed.quantity))
      ? Number(parsed.quantity)
      : null
  if (labelType === 'packed') {
    quantity = 1
  }

  return {
    item_number: item,
    quantity,
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

// ————————————————————————————————————————————————————————————————————————
// PDF-variant: één PDF (vaak met meerdere gescande pallet-labels) → array van
// herkende labels. Claude krijgt het PDF-document rechtstreeks (geen lokale
// rendering nodig) en moet per zichtbaar label één JSON-object teruggeven.
// ————————————————————————————————————————————————————————————————————————

const PDF_PROMPT = `Je krijgt een PDF-document (vaak een scan van een Konica Minolta / Sbizhub multi-function
printer) waarop één of meerdere pallet-/kist-labels staan afgebeeld. Op één PDF-pagina kunnen
meerdere labels naast/onder elkaar staan. Analyseer het volledige document en geef ÉÉN JSON-object
terug met veld "labels", een array waarin elk element exact één fysiek label beschrijft.

De regels per label zijn IDENTIEK aan deze voor de foto-variant (Atlas Copco / prodwilrijk-Foresco /
packed-kist). Korte herhaling van de belangrijkste regels:

- LAYOUT A (Atlas Copco supplier/pallet label):
    * item_number = waarde van "PART NO (P)" — ALTIJD 10 cijfers, zonder spaties. Dit is het
      grootste vetgedrukte nummer, vaak getoond in 4-4-2 groepering (bv. "2204 2096 03").
    * quantity = waarde van "QUANTITY (Q)" / "QTY (Q)". NOOIT "NET WT (KG)" of "GROSS WT (KG)" of
      "BOX TYPE".
    * pallet_number = "PARCEL NR (S)" (meestal 9 cijfers met voorloopnullen, bv. "058702896"), tenzij
      er een aparte witte "Pallet: <nummer>" sticker op staat.
    * receiver = de eerste regel(s) linksboven, bv. "ATLAS COPCO B2610 WILRIJK SERVICE CENTER".
    * label_type = "atlas".
- LAYOUT B (prodwilrijk/Foresco/Alteco): grote itemnummer met streepjes (bv. "2204-2311-78"),
  "Pallet:"-veld, "Qty". label_type = "foresco". receiver = null.
- LAYOUT C (interne packed-kist): itemnummer staat TUSSEN HAAKJES in het "Description:"-veld
  (bv. "(1830116081)"). pallet_number = de "Variant Code" met V-prefix. quantity = ALTIJD 1.
  receiver = "Owner Name:". label_type = "packed".

VERBODEN als item_number: LABEL NUMBER (S), SUPPLIER CODE (V), P.O.NO-LINE, SHOP ORDER NUMBER,
SERIAL NUMBER, DELIVERY NOTICE, PVAR-code, V-code, afmetingen. Als de kandidaat niet exact 10 cijfers
is, zet item_number op null.

Retourneer EXACT dit formaat (geen uitleg, geen markdown, geen code fences):

{
  "labels": [
    {
      "item_number": "<10 cijfers of null>",
      "quantity": <integer of null>,
      "pallet_number": "<palletnummer of null>",
      "description": "<omschrijving of null>",
      "po_line": "<P.O.NO-LINE of null>",
      "location": "<locatiecode of null>",
      "shop_order": "<shop order of null>",
      "date": "YYYYMMDD of null",
      "receiver": "<ontvanger of null>",
      "label_type": "atlas" | "foresco" | "packed" | "unknown",
      "raw_text_hint": "<korte samenvatting, max 80 tekens>"
    }
  ]
}

Regels voor de lijst:
- Geef één element per fysiek label dat je ziet, in leesvolgorde (links-naar-rechts, boven-naar-onder,
  pagina voor pagina).
- Dubbele afdrukken van hetzelfde label op dezelfde pagina (bv. een kleine "Pallet:"-sticker naast het
  grote label dat bij hetzelfde pallet hoort) tellen als ÉÉN label — combineer de info.
- Als een pagina leeg is of geen leesbaar label bevat, neem je niets op voor die pagina.
- Als je geen enkel label kunt lezen, geef "labels": [].`

export async function extractStockCountLabelsFromPdf(
  base64Pdf: string
): Promise<StockCountLabel[]> {
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
      // PDF-analyse is zwaarder dan één foto: gebruik het grotere sonnet-model
      // zodat we alle labels op één pagina betrouwbaar kunnen lezen.
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            { type: 'text', text: PDF_PROMPT },
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

  const parsedRoot = JSON.parse(jsonMatch[0]) as { labels?: Array<Partial<StockCountLabel>> }
  const rawLabels = Array.isArray(parsedRoot.labels) ? parsedRoot.labels : []

  return rawLabels.map((parsed) => {
    const labelType: StockCountLabel['label_type'] =
      parsed.label_type === 'atlas' ||
      parsed.label_type === 'foresco' ||
      parsed.label_type === 'packed'
        ? parsed.label_type
        : 'unknown'

    let item = normalizeDigits(parsed.item_number ?? null)

    if (item && /^\d{4,8}-\d{1,4}$/.test(String(parsed.item_number || ''))) {
      item = null
    }

    if (!item && labelType === 'packed' && parsed.description) {
      const m = String(parsed.description).match(/\((\d{10})\)/)
      if (m) item = m[1]
    }

    if (item && !/^\d{10}$/.test(item)) {
      item = null
    }

    let pallet: string | null
    if (labelType === 'packed' && parsed.pallet_number) {
      pallet = String(parsed.pallet_number).replace(/\s+/g, '').trim() || null
    } else {
      pallet = normalizeDigits(parsed.pallet_number ?? null)
    }

    let quantity: number | null =
      parsed.quantity != null && Number.isFinite(Number(parsed.quantity))
        ? Number(parsed.quantity)
        : null
    if (labelType === 'packed') {
      quantity = 1
    }

    return {
      item_number: item,
      quantity,
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
  })
}

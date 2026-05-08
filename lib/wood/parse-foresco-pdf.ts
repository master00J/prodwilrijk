const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export interface ForescoPackage {
  /** Exact pakketnummer zoals vermeld onder "Customer Item No." of "Ordernr. klant"
   * (bv. "GS636-03684", "PL636-00440"). Identificeert één fysiek pak. */
  pakketnummer: string
  /** Houtsoort-code afgeleid uit het hoofd "Item No"-veld. Bv. "SXT019X100" → "SXT".
   * BC na migratie: o.a. CWF (voorheen NHV), PEP (voorheen MEP); plus SXT, OSB, MPX, … */
  houtsoort: string | null
  /** Nominale dikte in mm (eerste getal van Item No of AFM). */
  dikte: number | null
  /** Nominale breedte in mm (derde getal van AFM, of laatste getal van Item No). */
  breedte: number | null
  /** Feitelijke lengte in mm zoals op de PDF (middelste getal van AFM).
   * Let op: in de PDF vaak geschreven met punt als duizendtal-scheider
   * (bv. "4.800" = 4800 mm, "2.440" = 2440 mm). */
  exacte_lengte: number | null
  /** Aantal planken in dit pak, overgenomen uit de "Amount"-kolom op de sub-regel
   * (bv. 570, 100, 60). Dit is NIET het m²/m³-totaal van de hoofdregel. */
  planken_per_pak: number | null
  /** Korte debug-hint. */
  raw_hint: string | null
}

const PROMPT = `Je krijgt een PDF met een "CMR Summary" van Foresco BE NV (leverancier van hout/plaatmateriaal
naar prodwilrijk). Het document somt hout-pakketten op, gegroepeerd per klant-orderregel.
Jouw taak: extraheer ELK FYSIEK PAK als eigen object en retourneer één JSON-object.

Lay-out van het document:
- De hoofdregel toont een "Item No" (bv. "101066", "101892"), een beschrijving van het product op de
  regel eronder (bv. "SXT019X100 - HT ISPM15 SEXTA" of "PEP009X2440X1220 MULTIPLEX …" — oude code MEP kan nog in oude PDF's staan),
  een Customer Order Line No., een AFM (afmeting, bv. "19x4.800x100"), een Amount (totaal in m³/m²),
  een UoM (m3/m2) en een totaal Weight.
- Onder elke hoofdregel staan één of meer sub-regels. Elke sub-regel heeft:
    * "Customer Item No." / "Ordernr. klant" kolom — dit IS het pakketnummer, bv.
      "GS636-03684", "PL636-00440", "PL636-00441". DIT IS WAT WE WILLEN als "pakketnummer".
    * een AFM op die sub-regel (zelfde formaat "19x4.800x100") die de werkelijke dikte/lengte/breedte
      van dat specifieke pak bevat.
    * een Amount op die sub-regel die het AANTAL PLANKEN in dat pak is (integer, bv. 570, 100, 60).
      Let op: dit is GEEN m³/m², maar het stuk-aantal.
    * een Weight in kg.

Extractie-regels per pak (één sub-regel = één element in de array):

1. "pakketnummer": de volledige string uit "Customer Item No." / "Ordernr. klant" EXACT zoals
   vermeld, inclusief het prefix en streepje (bv. "GS636-03684", "PL636-00440").
   - Dit mag NOOIT het hoofd "Item No" (zoals "101066") zijn, dat is de product-code van Foresco.

2. "houtsoort": neem de beschrijving van de hoofdregel onder de Item No (bv.
   "SXT019X100 - HT ISPM15 SEXTA" of "PEP009X2440X1220 MULTIPLEX ...") en haal de 3-letter code
   aan het begin van het eerste token eruit:
     * "SXT019X100 ..." → "SXT"
     * "PEP009X2440X1220 ..." → "PEP" (oude leverancierscode "MEP..." → "MEP")
     * "CWF*" → "CWF" (oude "NHV*" → "NHV"), "OSB*" → "OSB", "MPX*" → "MPX", "PLW*", "MDF*", enz.
   Altijd in HOOFDLETTERS.

3. "dikte": nominale dikte in mm = het EERSTE getal van de Item No-code (dus "SXT019X100" → 19,
   "PEP009X2440X1220" of "MEP009X2440X1220" → 9) of gelijkwaardig het eerste getal uit de AFM-kolom. Integer.

4. "breedte": nominale breedte in mm = het LAATSTE getal van de Item No-code (dus "SXT019X100" →
   100, "PEP009X2440X1220" → 1220) of het DERDE getal uit de AFM "DxLxB" (zie hieronder). Integer.

5. "exacte_lengte": lengte in mm = het MIDDELSTE getal van de AFM op de sub-regel. AFM-formaat is
   "dikte x lengte x breedte". Let heel goed op de notatie: Foresco gebruikt vaak een punt als
   duizendtal-scheider (Europese notatie):
     * "19x4.800x100" → dikte=19, lengte=4800 mm, breedte=100.
     * "15x1.220x2.440" → dikte=15, lengte=1220, breedte=2440.
     * "9x1.220x2.440" → dikte=9, lengte=1220, breedte=2440.
   Strip ALLE punten uit getallen ≥ 1000 — het zijn duizendtal-scheiders, geen decimalen.
   Retourneer een integer in millimeter.

6. "planken_per_pak": de "Amount"-waarde die op de sub-regel staat naast dit pakketnummer.
   Dit is een geheel getal (bv. 570, 100, 60). Retourneer als integer.
   NOOIT de m³/m²-waarde van de hoofdregel gebruiken (bv. "5,1984" of "714,432").

7. "raw_hint": korte samenvatting voor debugging (max 60 tekens), bv.
   "SXT 19x4800x100 - GS636-03684 x570".

Pakketten waarbij geen Customer Item No. / Ordernr. klant aanwezig is, worden overgeslagen.

Retourneer EXACT dit JSON-formaat (geen extra uitleg, geen code fences):

{
  "packages": [
    {
      "pakketnummer": "<string>",
      "houtsoort": "<3-letter code of null>",
      "dikte": <integer mm of null>,
      "breedte": <integer mm of null>,
      "exacte_lengte": <integer mm of null>,
      "planken_per_pak": <integer of null>,
      "raw_hint": "<korte tekst>"
    }
  ]
}`

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export async function parseForescoPdf(base64Pdf: string): Promise<ForescoPackage[]> {
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

  const parsed = JSON.parse(jsonMatch[0]) as { packages?: Array<Partial<ForescoPackage>> }
  const raw = Array.isArray(parsed.packages) ? parsed.packages : []

  return raw
    .map((p): ForescoPackage => ({
      pakketnummer: String(p.pakketnummer ?? '').trim(),
      houtsoort: p.houtsoort ? String(p.houtsoort).toUpperCase().trim() : null,
      dikte: toInt(p.dikte),
      breedte: toInt(p.breedte),
      exacte_lengte: toInt(p.exacte_lengte),
      planken_per_pak: toInt(p.planken_per_pak),
      raw_hint: p.raw_hint ? String(p.raw_hint).slice(0, 80) : null,
    }))
    .filter((p) => p.pakketnummer.length > 0)
}

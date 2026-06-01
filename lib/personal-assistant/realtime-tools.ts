/** OpenAI Realtime tool-definities voor de persoonlijke assistent (read-only data). */
export const PERSONAL_ASSISTANT_REALTIME_TOOLS = [
  {
    type: 'function' as const,
    name: 'grote_inpak_summary',
    description:
      'Haal een samenvatting op van alle Grote Inpak cases: totaal, priority, achterstand, locaties en statussen.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function' as const,
    name: 'search_grote_inpak_cases',
    description: 'Zoek Grote Inpak cases op tekst, locatie, priority of achterstand.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Vrije zoekterm: caselabel, kisttype, shoporder, klantorder, comment.',
        },
        location: { type: 'string', description: 'Filter op productielocatie, bv. Wilrijk, Genk, Willebroek.' },
        priority_only: { type: 'boolean' },
        overdue_only: { type: 'boolean', description: 'Alleen cases met achterstand.' },
        limit: { type: 'number', description: 'Max aantal resultaten, standaard 25.' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'kist_production_status',
    description:
      'Zoek productieorders, einddatum en vloerstatus voor een kisttype zoals K352 of K114. Gebruik dit bij vragen over productieorder, einddatum, zagerij of vloerstatus.',
    parameters: {
      type: 'object',
      properties: {
        kistnummer: { type: 'string', description: 'Kisttype / kistnummer, bv. K352.' },
      },
      required: ['kistnummer'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'atlas_order_status',
    description: 'Zoek Atlas/Grote Inpak orderstatus voor een shopordernummer.',
    parameters: {
      type: 'object',
      properties: {
        shop_order: { type: 'string', description: 'Shopordernummer of Atlas orderreferentie.' },
      },
      required: ['shop_order'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'prepack_queue_summary',
    description:
      'Haal een kort overzicht op van de Prepack wachtrij: open items, priority, problemen en opmetingen.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export const PERSONAL_ASSISTANT_REALTIME_INSTRUCTIONS = `Je bent de live Prodwilrijk persoonlijke voice-assistent voor Jason op mobiel.

Antwoord altijd in duidelijk, gesproken Nederlands. Geen Markdown, geen sterretjes, geen koppen.
Gebruik korte zinnen alsof je via oortjes praat.

Je hebt tools voor actuele data uit prodwilrijk.be: Grote Inpak, productieorders, Atlas orderstatus en Prepack.
Gebruik altijd eerst de juiste tool voordat je aantallen, datums, orders of statussen noemt. Verzin niets.

Belangrijk:
- "achterstand", "lopen achter" en "te laat" = cases met dagen_te_laat groter dan 0.
- "uit Wilrijk", "Genk", "Willebroek" = productielocatie filteren.
- Bij productieorder-vragen voor een kisttype: gebruik kist_production_status en noem prod_order_no en ending_date.
- Spreek codes teken per teken uit. K352 is K 3 5 2.
- Je voert geen wijzigingen uit in de database; je geeft enkel informatie en advies.`

export const PERSONAL_ASSISTANT_REALTIME_TRANSCRIBE_PROMPT = [
  'Nederlandse/Vlaamse spraak voor de Prodwilrijk persoonlijke assistent.',
  'Belangrijke woorden: Grote Inpak, Prepack, kisttype, caselabel, shoporder, Wilrijk, Genk, Willebroek, priority, productieorder, K352, K114.',
  'Codes worden teken per teken uitgesproken.',
  'Voorbeelden: "hoeveel kisten lopen we achter uit Wilrijk", "welk productieorder is gelinkt aan K114", "status shoporder 123456".',
].join(' ')

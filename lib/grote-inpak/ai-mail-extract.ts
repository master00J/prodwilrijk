// AI-extractie van klantvragen uit gedropte Outlook-mails (grote inpak).
// Stuurt de mailtekst plus inline afbeeldingen (bv. screenshots van ordertabellen)
// naar een OpenAI vision-model en haalt er gestructureerde gegevens uit:
// ordernummers, shop orders, casenummers en de concrete klantvraag.

import type { MailInlineImage, ParsedDroppedMail } from './parse-dropped-mail'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MAIL_MODEL || 'gpt-5.4-mini'

export type AiMailExtraction = {
  order_numbers: string[]
  shop_orders: string[]
  case_numbers: string[]
  product_codes: string[]
  customer_name: string | null
  request_summary: string
  requested_action: string
  due_hint: string | null
  is_urgent: boolean
}

const EXTRACTION_PROMPT = `Je bent een assistent voor een verpakkingsafdeling (grote inpak van industriële units zoals compressoren/koelers).
Je krijgt een e-mail van een klant of collega, soms met afbeeldingen (bv. screenshots van ordertabellen uit een ERP-systeem,
of screenshots van een groen terminal-/AS400-scherm met velden als "Produkt S/N", "Kist", "Klantenorder").
Lees ALLES grondig, inclusief tabellen en veldlabels in de afbeeldingen, en extraheer de volgende gegevens als JSON:

{
  "order_numbers": ["..."],   // bestel-/order-/dispatch-/PO-/SO-nummers, bv. "16932757"
  "shop_orders": ["..."],     // shop order nummers (vaak 6 cijfers), bv. "300895"
  "case_numbers": ["..."],    // case labels / kistnummers, bv. "MM65F" of "IO85F"
  "product_codes": ["..."],   // productcodes/artikelnummers, bv. "T334235007" of "HD3500"
  "customer_name": "...",     // naam van de klant/afzender-organisatie, of null
  "request_summary": "...",   // korte samenvatting (1-2 zinnen, Nederlands) van wat er gevraagd wordt
  "requested_action": "...",  // concrete actie voor de verpakkingsafdeling (Nederlands), bv. "Foto's nemen van de unit vóór en na verpakking en doorsturen"
  "due_hint": "...",          // timing-indicatie uit de mail (bv. "komende weken", "voor 1 juli"), of null
  "is_urgent": true/false     // true als de mail dringend/prio/urgent/asap/spoed aangeeft
}

Regels:
- Neem nummers exact over zoals ze in de mail of afbeelding staan (geen nummers verzinnen).
- In terminal-screenshots: het veld "Kist" bevat het case label (→ case_numbers); "Kist Type" (bv. "K258") is het kisttype, GEEN case label; "Produkt S/N" en "Produkt" zijn productcodes (→ product_codes); "Klantenorder" is een ordernummer (→ order_numbers).
- Case labels zijn korte alfanumerieke codes (4-6 tekens, letters + cijfers, bv. "MM65F", "IO85F"). Let op: de letter O en het cijfer 0 zijn in zulke screenshots moeilijk te onderscheiden; neem je beste lezing over.
- Negeer handtekeningen, logo's, juridische disclaimers en links.
- Als een veld onbekend is: lege array of null.
- Antwoord ALLEEN met geldige JSON.`

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(
    value
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0 && v.length <= 64)
  )]
}

function toNullableString(value: unknown, maxLen = 500): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text.slice(0, maxLen) : null
}

export async function extractMailDataWithAi(
  parsed: ParsedDroppedMail,
  images: MailInlineImage[]
): Promise<AiMailExtraction> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server')
  }

  const mailText = [
    `Onderwerp: ${parsed.subject}`,
    `Van: ${parsed.fromName || ''} <${parsed.fromEmail || 'onbekend'}>`,
    parsed.receivedAt ? `Ontvangen: ${parsed.receivedAt}` : null,
    '',
    (parsed.bodyText || stripHtml(parsed.bodyHtml) || '(geen tekstinhoud)').slice(0, 12000),
  ]
    .filter((line) => line !== null)
    .join('\n')

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: `${EXTRACTION_PROMPT}\n\n--- E-MAIL ---\n${mailText}` },
  ]

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mediaType};base64,${image.base64}`,
        detail: 'high',
      },
    })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errBody.slice(0, 500)}`)
  }

  const result = await response.json()
  const text: string = result.choices?.[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI gaf geen geldige JSON terug')
  }

  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  return {
    order_numbers: toStringArray(raw.order_numbers),
    shop_orders: toStringArray(raw.shop_orders),
    case_numbers: toStringArray(raw.case_numbers),
    product_codes: toStringArray(raw.product_codes),
    customer_name: toNullableString(raw.customer_name, 200),
    request_summary:
      toNullableString(raw.request_summary, 1000) || parsed.subject || 'Klantvraag uit mail',
    requested_action: toNullableString(raw.requested_action, 1000) || 'Klantvraag opvolgen',
    due_hint: toNullableString(raw.due_hint, 200),
    is_urgent: raw.is_urgent === true,
  }
}

function stripHtml(html: string | null): string | null {
  if (!html) return null
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

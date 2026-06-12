// AI mail-drop voor grote inpak: sleep een Outlook-mail (.eml/.msg) in de
// Forecast-tab en AI doet de rest. De mail (inclusief inline afbeeldingen zoals
// screenshots van ordertabellen) wordt door een vision-model gelezen, waarna:
// 1. case-/shop order-/ordernummers worden geëxtraheerd,
// 2. die worden gematcht tegen forecast- en PILS-units,
// 3. per gematchte unit een klantvraag wordt aangemaakt met de mail eraan gekoppeld.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  extractMailInlineImages,
  parseDroppedMailFile,
} from '@/lib/grote-inpak/parse-dropped-mail'
import { extractMailDataWithAi, type AiMailExtraction } from '@/lib/grote-inpak/ai-mail-extract'
import { markPilsPriorityFromMail } from '@/lib/grote-inpak/mail-priority'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_MAIL_BYTES = 15 * 1024 * 1024
const MAX_MATCHED_LABELS = 12

function contentTypeForFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.eml')) return 'message/rfc822'
  if (lower.endsWith('.msg')) return 'application/vnd.ms-outlook'
  return 'application/octet-stream'
}

type MatchedUnit = {
  case_label: string
  case_type: string | null
  on_pils: boolean
  matched_on: string
}

// In terminal-/AS400-screenshots zijn O↔0 en I↔1 visueel niet te onderscheiden.
// Genereer daarom alle leesvarianten van een case label zodat bv. "I085F" ook
// de unit "IO85F" matcht. Max. 4 ambigue posities (16 varianten) om explosie te vermijden.
function caseLabelVariants(value: string): string[] {
  const chars = value.split('')
  const ambiguous: Array<[number, string, string]> = []
  chars.forEach((ch, i) => {
    if (ch === 'O' || ch === '0') ambiguous.push([i, 'O', '0'])
    else if (ch === 'I' || ch === '1') ambiguous.push([i, 'I', '1'])
  })
  if (ambiguous.length === 0 || ambiguous.length > 4) return [value]

  const variants = new Set<string>()
  for (let mask = 0; mask < 1 << ambiguous.length; mask += 1) {
    const copy = [...chars]
    ambiguous.forEach(([pos, a, b], bit) => {
      copy[pos] = (mask >> bit) & 1 ? a : b
    })
    variants.add(copy.join(''))
  }
  return [...variants]
}

async function findMatchingUnits(extraction: AiMailExtraction): Promise<MatchedUnit[]> {
  const byLabel = new Map<string, MatchedUnit>()
  const addMatch = (
    caseLabel: unknown,
    caseType: unknown,
    onPils: boolean,
    matchedOn: string
  ) => {
    const label = String(caseLabel || '').trim()
    if (!label || byLabel.has(label)) return
    byLabel.set(label, {
      case_label: label,
      case_type: String(caseType || '').trim() || null,
      on_pils: onPils,
      matched_on: matchedOn,
    })
  }

  // Alleen veilige tekens toelaten in .or()-filters (AI-output is niet vertrouwd).
  const safeFilterValue = (value: string) => /^[A-Za-z0-9_\-./]+$/.test(value)
  const caseNumbers = [...new Set(
    extraction.case_numbers.flatMap((value) => caseLabelVariants(value.toUpperCase()))
  )]
  const shopOrders = extraction.shop_orders.filter(safeFilterValue)
  const orderNumbers = extraction.order_numbers.filter(safeFilterValue)

  // 1. Direct op case label (PILS heeft voorrang voor on_pils-status).
  if (caseNumbers.length > 0) {
    const { data: pilsCases, error: pilsError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type')
      .in('case_label', caseNumbers)
    if (pilsError) throw pilsError
    for (const row of pilsCases || []) addMatch(row.case_label, row.case_type, true, 'case-nummer')

    const { data: forecastRows, error: forecastError } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .select('case_label, case_type')
      .in('case_label', caseNumbers)
    if (forecastError) throw forecastError
    for (const row of forecastRows || []) {
      addMatch(row.case_label, row.case_type, false, 'case-nummer (forecast)')
    }
  }

  // 2. Op shop order (BC shop order of PILS shop-order-key).
  if (shopOrders.length > 0) {
    const { data: byShopOrder, error: shopError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type')
      .or(
        [
          `bc_shop_order_no.in.(${shopOrders.join(',')})`,
          `pils_shop_order_key.in.(${shopOrders.join(',')})`,
        ].join(',')
      )
    if (shopError) throw shopError
    for (const row of byShopOrder || []) addMatch(row.case_label, row.case_type, true, 'shop order')
  }

  // 3. Op order-/PO-nummer uit BC.
  if (orderNumbers.length > 0) {
    const { data: byOrder, error: orderError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type')
      .or(
        [
          `bc_sales_order_no.in.(${orderNumbers.join(',')})`,
          `bc_customer_order_no.in.(${orderNumbers.join(',')})`,
        ].join(',')
      )
    if (orderError) throw orderError
    for (const row of byOrder || []) addMatch(row.case_label, row.case_type, true, 'ordernummer')
  }

  return [...byLabel.values()].slice(0, MAX_MATCHED_LABELS)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Sleep een .eml of .msg bestand vanuit Outlook in de dropzone.' },
        { status: 400 }
      )
    }

    const name = file.name || 'mail.msg'
    const lower = name.toLowerCase()
    if (!lower.endsWith('.eml') && !lower.endsWith('.msg')) {
      return NextResponse.json(
        { error: 'Alleen Outlook .eml of .msg bestanden worden ondersteund.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_MAIL_BYTES) {
      return NextResponse.json(
        { error: 'Mailbestand is te groot (max. 15 MB).' },
        { status: 400 }
      )
    }

    const parsed = await parseDroppedMailFile(buffer, name)
    const images = await extractMailInlineImages(buffer, name)
    const extraction = await extractMailDataWithAi(parsed, images)

    let matches = await findMatchingUnits(extraction)

    // Geen bestaande unit gevonden: maak de klantvragen toch aan op de
    // geëxtraheerde casenummers, zodat ze automatisch verschijnen zodra die
    // units op de forecast of PILS komen (koppeling gebeurt op case_label).
    let unmatchedCreated = false
    if (matches.length === 0) {
      const fallbackLabels = extraction.case_numbers.length > 0
        ? extraction.case_numbers.map((value) => value.toUpperCase())
        : extraction.order_numbers.length > 0
          ? [`ORDER ${extraction.order_numbers[0]}`]
          : []

      if (fallbackLabels.length === 0) {
        return NextResponse.json(
          {
            error:
              'AI kon geen case-, shop order- of ordernummers in de mail vinden. Sleep de mail op een specifieke forecast-rij om hem handmatig te koppelen.',
            extraction,
          },
          { status: 422 }
        )
      }

      unmatchedCreated = true
      matches = fallbackLabels.slice(0, MAX_MATCHED_LABELS).map((label) => ({
        case_label: label,
        case_type: null,
        on_pils: false,
        matched_on: 'nog niet op forecast/PILS',
      }))
    }

    const dueHintSuffix = extraction.due_hint ? ` (timing: ${extraction.due_hint})` : ''
    const createdRequests: Array<Record<string, unknown>> = []
    const priorityMarkedLabels: string[] = []

    for (const match of matches) {
      // Mail per unit opslaan zodat hij via de mailviewer van elke unit te openen is.
      const { data: mailRow, error: mailError } = await supabaseAdmin
        .from('grote_inpak_case_linked_mails')
        .insert({
          case_label: match.case_label,
          original_filename: name,
          content_type: parsed.contentType || contentTypeForFilename(name),
          file_bytes: buffer,
          subject: parsed.subject,
          from_email: parsed.fromEmail,
          from_name: parsed.fromName,
          received_at: parsed.receivedAt,
          body_text: parsed.bodyText,
          body_html: parsed.bodyHtml,
        })
        .select('id')
        .single()
      if (mailError) throw mailError

      const { data: customerRequest, error: requestError } = await supabaseAdmin
        .from('grote_inpak_customer_requests')
        .insert({
          case_label: match.case_label,
          case_type: match.case_type,
          customer_name:
            extraction.customer_name || parsed.fromName || parsed.fromEmail || null,
          request_text: extraction.request_summary,
          requested_action: `${extraction.requested_action}${dueHintSuffix}`,
          status: match.on_pils ? 'on_pils' : 'waiting_forecast',
          created_from: 'ai_mail_drop',
          linked_mail_id: mailRow.id,
        })
        .select()
        .single()
      if (requestError) throw requestError

      let priorityMarked = false
      if (match.on_pils) {
        priorityMarked = await markPilsPriorityFromMail(match.case_label, parsed, {
          aiSaysUrgent: extraction.is_urgent,
        })
        if (priorityMarked) priorityMarkedLabels.push(match.case_label)
      }

      createdRequests.push({
        ...customerRequest,
        on_pils: match.on_pils,
        matched_on: match.matched_on,
        priority_marked: priorityMarked,
      })
    }

    let matchedSummary = unmatchedCreated
      ? `Geen bestaande unit gevonden; ${createdRequests.length} klantvra(a)g(en) klaargezet op de geëxtraheerde nummers`
      : `${createdRequests.length} klantvra(a)g(en) aangemaakt voor gematchte units`
    if (priorityMarkedLabels.length > 0) {
      matchedSummary += ` — prio gezet op PILS: ${priorityMarkedLabels.join(', ')}`
    }

    return NextResponse.json({
      success: true,
      summary: matchedSummary,
      priority_marked_labels: priorityMarkedLabels,
      extraction,
      images_analyzed: images.length,
      unmatched: unmatchedCreated,
      requests: createdRequests,
    })
  } catch (error: unknown) {
    console.error('ai-mail-drop:', error)
    const message = error instanceof Error ? error.message : 'AI-verwerking van de mail mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

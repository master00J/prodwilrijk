import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const REALTIME_MODEL = process.env.GROTE_INPAK_REALTIME_MODEL || 'gpt-realtime'
const REALTIME_VOICE = process.env.GROTE_INPAK_REALTIME_VOICE || 'marin'

const TRANSCRIPTION_PROMPT = [
  'Nederlandse/Vlaamse spraak op de Grote Inpak pagina van prodwilrijk.',
  'Belangrijke woorden: kisten, cases, caselabel, kisttype, priority, prio, prioriteit, notitie, achterstand, Wilrijk, Genk, Willebroek, WLB, forecast, stock, transfer, productie.',
  'Codes worden vaak teken per teken uitgesproken: KB91F, K352, C24, H1HXI. K352 betekent K 3 5 2, niet K325.',
  'Voorbeelden: "hoeveel kisten lopen we achter uit Wilrijk", "zet KB91F op prio klant wacht", "welke cases hebben geen stock", "kisttype K352".',
  'Transcribeer letterlijk en verander de betekenis niet.',
].join(' ')

const REALTIME_INSTRUCTIONS = `Je bent de live Grote Inpak voice-assistent voor prodwilrijk.be.

Antwoord altijd in duidelijk, gesproken Nederlands. Gebruik geen Markdown, geen sterretjes, geen koppen en geen tabellen.
Gebruik korte zinnen alsof je met de ploegleiding praat.

Je hebt tools voor de actuele Grote Inpak tabel. Gebruik die tools voordat je aantallen, caselabels, prioriteiten of stockinformatie geeft.
Je mag ook acties uitvoeren via tools, zoals priority zetten of een notitie toevoegen. Voor muterende acties vraagt de applicatie om bevestiging.
Bij vragen zoals "welk productieorder is gelinkt aan kisttype K114", "wanneer moest K114 klaar zijn", "tegen welke datum stond K114 gepland", productieorders, einddatum, zagerij, assemblage of vloerstatus moet je de productieorder/geheugen-tools gebruiken.
Antwoord dan met het productieordernummer (prod_order_no) en de geplande einddatum (ending_date) uit de tool-output.
Als de gebruiker zegt dat een kisttype ergens staat of een status heeft, laat de applicatie dat opslaan via de beschikbare tool.

Belangrijke begrippen:
- "achterstand", "lopen achter" en "te laat" betekent normaal: cases met dagen_te_laat groter dan 0.
- "uit Wilrijk", "van Wilrijk", "Genk" en "Willebroek" verwijzen meestal naar productielocatie.
- Als de gebruiker "hoeveel kisten" vraagt, geef eerst het aantal cases en daarna de belangrijkste caselabels.
- Noem caselabels exact zoals ze in de tool-output staan.
- Spreek caselabels en kisttypes teken per teken uit. K352 is K 3 5 2, nooit K driehonderd tweeënvijftig of K driehonderd vijfentwintig.
- Verwar case_label niet met case_type. In de tabel is KB91F bijvoorbeeld een caselabel en K352 een kisttype.`

function getClientSecret(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    value?: unknown
    client_secret?: { value?: unknown }
    session?: { client_secret?: { value?: unknown } }
  }

  if (typeof data.value === 'string') return data.value
  if (typeof data.client_secret?.value === 'string') return data.client_secret.value
  if (typeof data.session?.client_secret?.value === 'string') return data.session.client_secret.value
  return null
}

function getExpiresAt(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    expires_at?: unknown
    client_secret?: { expires_at?: unknown }
    session?: { client_secret?: { expires_at?: unknown } }
  }

  if (typeof data.expires_at === 'number') return data.expires_at
  if (typeof data.client_secret?.expires_at === 'number') return data.client_secret.expires_at
  if (typeof data.session?.client_secret?.expires_at === 'number') return data.session.client_secret.expires_at
  return null
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY niet geconfigureerd op de server.' }, { status: 500 })
    }

    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': request.headers.get('x-user-id') || 'grote-inpak-voice',
      },
      body: JSON.stringify({
        expires_after: {
          anchor: 'created_at',
          seconds: 600,
        },
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          output_modalities: ['audio'],
          audio: {
            input: {
              transcription: {
                model: process.env.GROTE_INPAK_REALTIME_TRANSCRIBE_MODEL || 'gpt-4o-transcribe',
                language: 'nl',
                prompt: TRANSCRIPTION_PROMPT,
              },
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'auto',
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              voice: REALTIME_VOICE,
            },
          },
          instructions: REALTIME_INSTRUCTIONS,
          tool_choice: 'auto',
          max_output_tokens: 900,
        },
      }),
    })

    const rawBody = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI Realtime sessie fout ${response.status}: ${rawBody.slice(0, 500)}`)
    }

    const payload = JSON.parse(rawBody)
    const clientSecret = getClientSecret(payload)
    if (!clientSecret) {
      throw new Error('OpenAI Realtime gaf geen bruikbare client secret terug.')
    }

    return NextResponse.json({
      clientSecret,
      expiresAt: getExpiresAt(payload),
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
    })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/realtime-session',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Realtime sessie starten mislukt.' },
      { status: 500 }
    )
  }
}

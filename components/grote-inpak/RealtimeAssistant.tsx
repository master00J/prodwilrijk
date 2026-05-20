'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Bot, Loader2, Mic, MicOff, PhoneOff, ShieldCheck, Zap } from 'lucide-react'
import type { GroteInpakCase } from '@/types/database'

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error'
type ToolResult = Record<string, unknown>

interface RealtimeSummary {
  priority: number
  comments: number
  inWillebroek: number
  onderweg: number
  stockErgens: number
  forecastKritiek: number
}

interface RealtimeAssistantProps {
  cases: GroteInpakCase[]
  totalCases: number
  filters: Record<string, string>
  summary: RealtimeSummary
  onCaseUpdated: (caseLabel: string, updates: Partial<GroteInpakCase>) => void
}

interface SessionResponse {
  clientSecret?: string
  error?: string
  model?: string
  voice?: string
}

interface RealtimeFunctionCall {
  type?: string
  name?: string
  call_id?: string
  arguments?: string
}

interface RealtimeServerEvent {
  type?: string
  error?: { message?: string }
  transcript?: string
  response?: {
    output?: RealtimeFunctionCall[]
  }
}

const MAX_CONTEXT_CASES = 160
const MAX_BULK_UPDATES = 20

const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'get_current_overview',
    description: 'Geeft de actuele gefilterde Grote Inpak tabel, samenvatting en actieve filters terug.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum aantal cases om terug te geven. Laat leeg voor de standaardlimiet.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'find_case',
    description: 'Zoekt een case op caselabel. Werkt ook als het label met spaties wordt uitgesproken.',
    parameters: {
      type: 'object',
      properties: {
        case_label: { type: 'string', description: 'Het caselabel, bijvoorbeeld KB91F.' },
      },
      required: ['case_label'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_case_priority',
    description: 'Zet priority aan of uit voor een case. De browser vraagt bevestiging voor de wijziging.',
    parameters: {
      type: 'object',
      properties: {
        case_label: { type: 'string' },
        priority: { type: 'boolean' },
      },
      required: ['case_label', 'priority'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'append_case_note',
    description: 'Voegt een korte notitie toe aan de bestaande comment van een case. De browser vraagt bevestiging.',
    parameters: {
      type: 'object',
      properties: {
        case_label: { type: 'string' },
        note: { type: 'string', description: 'Korte notitie die moet worden toegevoegd.' },
      },
      required: ['case_label', 'note'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_case_priority_with_note',
    description: 'Zet een case op priority en voegt optioneel een Prio-notitie toe. De browser vraagt bevestiging.',
    parameters: {
      type: 'object',
      properties: {
        case_label: { type: 'string' },
        note: { type: 'string', description: 'Reden of instructie voor de priority.' },
      },
      required: ['case_label'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'bulk_set_priority',
    description: `Zet priority aan of uit voor meerdere cases tegelijk. Maximaal ${MAX_BULK_UPDATES} cases per tool-call.`,
    parameters: {
      type: 'object',
      properties: {
        case_labels: {
          type: 'array',
          items: { type: 'string' },
        },
        priority: { type: 'boolean' },
      },
      required: ['case_labels', 'priority'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_kisttype_production_status',
    description: 'Gebruik deze tool altijd bij vragen met woorden zoals productieorder, productie order, gelinkt, gekoppeld, gepland, klaar, einddatum, due date, zagerij of vloerstatus. Haalt per kisttype zoals K114/K352 de gekoppelde productieorder(s), geplande einddatum, resterend aantal, vloerstatus en AI-geheugen op uit het tabblad Productieorders.',
    parameters: {
      type: 'object',
      properties: {
        kistnummer: { type: 'string', description: 'Kisttype/kistnummer, bijvoorbeeld K352.' },
        only_open: { type: 'boolean', description: 'Gebruik false als de gebruiker vraagt welk productieorder gelinkt is of tegen wanneer het gepland was. Gebruik true alleen als expliciet naar open productie wordt gevraagd.' },
      },
      required: ['kistnummer'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'remember_kisttype_note',
    description: 'Slaat een feit of notitie op in het AI-geheugen voor een kisttype, bijvoorbeeld dat K352 bij de zagerij staat.',
    parameters: {
      type: 'object',
      properties: {
        kistnummer: { type: 'string' },
        memory_type: {
          type: 'string',
          description: 'Type geheugen, bijvoorbeeld production_status, location, planning_note of note.',
        },
        value: { type: 'string', description: 'Korte waarde die onthouden moet worden.' },
        note: { type: 'string', description: 'Extra detail of context.' },
      },
      required: ['kistnummer', 'value'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_kisttype_floor_status',
    description: 'Zet de vloerstatus voor alle open productieorderlijnen van een kisttype en bewaart dit ook in AI-geheugen. Statussen: not_started, sawmill, assembly, ready_transport, completed. Nederlandse woorden zoals zagerij en assemblage mogen ook.',
    parameters: {
      type: 'object',
      properties: {
        kistnummer: { type: 'string' },
        floor_status: {
          type: 'string',
          description: 'Bijvoorbeeld sawmill of zagerij.',
        },
        note: { type: 'string' },
        only_open: { type: 'boolean' },
      },
      required: ['kistnummer', 'floor_status'],
      additionalProperties: false,
    },
  },
]

function normalizeCaseLabel(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function toNumber(value: number | null | undefined): number {
  return value ?? 0
}

function truncate(value: string | null | undefined, max = 220): string | null {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function formatSpokenCode(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .join(' ')
}

function sanitizeCase(row: GroteInpakCase) {
  return {
    case_label: row.case_label,
    spoken_case_label: formatSpokenCode(row.case_label),
    case_type: row.case_type || null,
    spoken_case_type: formatSpokenCode(row.case_type),
    arrival_date: row.arrival_date || null,
    forecast_date: row.forecast_date || null,
    productielocatie: row.productielocatie || null,
    status: row.status || null,
    priority: row.priority === true,
    comment: truncate(row.comment),
    stock_willebroek: toNumber(row.stock_willebroek),
    stock_genk: toNumber(row.stock_genk),
    stock_wilrijk: toNumber(row.stock_wilrijk),
    in_transfer_qty: toNumber(row.in_transfer_qty),
    in_productie_qty: toNumber(row.in_productie_qty),
    in_willebroek: row.in_willebroek === true,
    dagen_te_laat: toNumber(row.dagen_te_laat),
    status_reason: truncate(row.status_reason, 160),
    bc_fp_item_no: row.bc_fp_item_no || row.item_number || null,
    bc_shop_order_no: row.bc_shop_order_no || null,
    bc_customer_order_no: row.bc_customer_order_no || null,
  }
}

function appendNote(existingComment: string | null | undefined, note: string): string {
  const cleanNote = note.trim()
  const current = (existingComment || '').trim()
  if (!cleanNote) return current
  if (!current) return cleanNote
  if (current.toLowerCase().includes(cleanNote.toLowerCase())) return current
  return `${current} | ${cleanNote}`
}

function safeJsonParse(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function getStringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

function getBooleanArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = args[key]
  return typeof value === 'boolean' ? value : fallback
}

function getStringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Aanvraag mislukt.')
  }
  return result
}

export default function RealtimeAssistant({
  cases,
  totalCases,
  filters,
  summary,
  onCaseUpdated,
}: RealtimeAssistantProps) {
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [message, setMessage] = useState('Realtime assistent is nog niet verbonden.')
  const [lastHeard, setLastHeard] = useState('')
  const [lastAnswer, setLastAnswer] = useState('')
  const [typedPrompt, setTypedPrompt] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [toolLog, setToolLog] = useState<string[]>([])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const processedCallsRef = useRef<Set<string>>(new Set())

  const context = useMemo(() => {
    const late = cases.filter(row => toNumber(row.dagen_te_laat) > 0)
    const priorityLate = late.filter(row => row.priority)
    return {
      filters,
      summary: {
        filtered: cases.length,
        total: totalCases,
        priority: summary.priority,
        comments: summary.comments,
        inWillebroek: summary.inWillebroek,
        onderweg: summary.onderweg,
        stockErgens: summary.stockErgens,
        forecastKritiek: summary.forecastKritiek,
        late: late.length,
        priorityLate: priorityLate.length,
      },
      cases: cases.slice(0, MAX_CONTEXT_CASES).map(sanitizeCase),
    }
  }, [cases, filters, summary, totalCases])

  const findCase = useCallback((caseLabel: string) => {
    const needle = normalizeCaseLabel(caseLabel)
    return cases.find(row => normalizeCaseLabel(row.case_label) === needle) ||
      cases.find(row => normalizeCaseLabel(row.case_label).includes(needle) || needle.includes(normalizeCaseLabel(row.case_label))) ||
      null
  }, [cases])

  const sendClientEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') {
      throw new Error('Realtime datachannel is niet verbonden.')
    }
    dc.send(JSON.stringify(event))
  }, [])

  const applySingleCaseUpdate = useCallback(async (caseLabel: string, updates: Partial<GroteInpakCase>) => {
    const response = await fetch('/api/grote-inpak/cases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_label: caseLabel, updates }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Case aanpassen mislukt.')
    }

    const updated = result.data as Partial<GroteInpakCase> | undefined
    onCaseUpdated(caseLabel, updated || updates)
    return updated || updates
  }, [onCaseUpdated])

  const executeToolCall = useCallback(async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    if (name === 'get_current_overview') {
      const requestedLimit = typeof args.limit === 'number' ? Math.max(1, Math.min(args.limit, MAX_CONTEXT_CASES)) : MAX_CONTEXT_CASES
      return {
        ok: true,
        ...context,
        cases: context.cases.slice(0, requestedLimit),
        truncated: context.cases.length > requestedLimit,
      }
    }

    if (name === 'find_case') {
      const match = findCase(getStringArg(args, 'case_label'))
      return match ? { ok: true, case: sanitizeCase(match) } : { ok: false, message: 'Geen case gevonden.' }
    }

    if (name === 'set_case_priority') {
      const match = findCase(getStringArg(args, 'case_label'))
      if (!match) return { ok: false, message: 'Geen case gevonden.' }

      const priority = getBooleanArg(args, 'priority')
      const confirmed = window.confirm(`${match.case_label} ${priority ? 'op priority zetten' : 'van priority halen'}?`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Actie geannuleerd door gebruiker.' }

      const updated = await applySingleCaseUpdate(match.case_label, { priority })
      return { ok: true, case_label: match.case_label, updates: updated }
    }

    if (name === 'append_case_note') {
      const match = findCase(getStringArg(args, 'case_label'))
      if (!match) return { ok: false, message: 'Geen case gevonden.' }

      const note = getStringArg(args, 'note')
      if (!note) return { ok: false, message: 'Geen notitie ontvangen.' }

      const nextComment = appendNote(match.comment, note)
      const confirmed = window.confirm(`Notitie toevoegen aan ${match.case_label}?\n\n${note}`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Actie geannuleerd door gebruiker.' }

      const updated = await applySingleCaseUpdate(match.case_label, { comment: nextComment })
      return { ok: true, case_label: match.case_label, updates: updated }
    }

    if (name === 'set_case_priority_with_note') {
      const match = findCase(getStringArg(args, 'case_label'))
      if (!match) return { ok: false, message: 'Geen case gevonden.' }

      const note = getStringArg(args, 'note')
      const prioNote = note ? `Prio: ${note}` : 'Prio'
      const nextComment = appendNote(match.comment, prioNote)
      const confirmed = window.confirm(`${match.case_label} op priority zetten${note ? ` met notitie "${note}"` : ''}?`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Actie geannuleerd door gebruiker.' }

      const updated = await applySingleCaseUpdate(match.case_label, { priority: true, comment: nextComment })
      return { ok: true, case_label: match.case_label, updates: updated }
    }

    if (name === 'bulk_set_priority') {
      const labels = getStringArrayArg(args, 'case_labels').slice(0, MAX_BULK_UPDATES)
      const priority = getBooleanArg(args, 'priority')
      const matches = labels.map(label => findCase(label)).filter((row): row is GroteInpakCase => Boolean(row))
      if (matches.length === 0) return { ok: false, message: 'Geen cases gevonden.' }

      const confirmed = window.confirm(`${matches.length} cases ${priority ? 'op priority zetten' : 'van priority halen'}?`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Actie geannuleerd door gebruiker.' }

      const updates = matches.map(row => ({ case_label: row.case_label, priority }))
      const response = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Bulk priority aanpassen mislukt.')
      }

      matches.forEach(row => onCaseUpdated(row.case_label, { priority }))
      return { ok: true, updated: matches.length, case_labels: matches.map(row => row.case_label) }
    }

    if (name === 'get_kisttype_production_status') {
      const kistnummer = getStringArg(args, 'kistnummer')
      if (!kistnummer) return { ok: false, message: 'Geen kisttype ontvangen.' }

      const onlyOpen = getBooleanArg(args, 'only_open', false)
      const params = new URLSearchParams({
        kistnummer,
        only_open: onlyOpen ? '1' : '0',
      })
      const response = await fetch(`/api/grote-inpak/production-orders/kist-status?${params.toString()}`, {
        cache: 'no-store',
      })
      return parseJsonResponse(response)
    }

    if (name === 'remember_kisttype_note') {
      const kistnummer = getStringArg(args, 'kistnummer')
      const value = getStringArg(args, 'value')
      const memoryType = getStringArg(args, 'memory_type') || 'note'
      const note = getStringArg(args, 'note') || null

      if (!kistnummer || !value) return { ok: false, message: 'Kisttype en waarde zijn verplicht.' }

      const confirmed = window.confirm(`Onthouden voor ${kistnummer}?\n\n${value}${note ? `\n${note}` : ''}`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Onthouden geannuleerd door gebruiker.' }

      const response = await fetch('/api/grote-inpak/ai-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_type: 'case_type',
          subject_key: kistnummer,
          memory_type: memoryType,
          value,
          note,
          source: 'realtime_voice',
        }),
      })
      return parseJsonResponse(response)
    }

    if (name === 'set_kisttype_floor_status') {
      const kistnummer = getStringArg(args, 'kistnummer')
      const floorStatus = getStringArg(args, 'floor_status')
      const note = getStringArg(args, 'note') || null
      const onlyOpen = getBooleanArg(args, 'only_open', true)

      if (!kistnummer || !floorStatus) return { ok: false, message: 'Kisttype en vloerstatus zijn verplicht.' }

      const confirmed = window.confirm(`${kistnummer} op vloerstatus "${floorStatus}" zetten${note ? ` met notitie "${note}"` : ''}?`)
      if (!confirmed) return { ok: false, cancelled: true, message: 'Vloerstatus geannuleerd door gebruiker.' }

      const response = await fetch('/api/grote-inpak/production-orders/kist-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kistnummer,
          floor_status: floorStatus,
          note,
          only_open: onlyOpen,
          remember: true,
        }),
      })
      return parseJsonResponse(response)
    }

    return { ok: false, message: `Onbekende tool: ${name}` }
  }, [applySingleCaseUpdate, context, findCase, onCaseUpdated])

  const handleFunctionCalls = useCallback(async (event: RealtimeServerEvent) => {
    const output = event.response?.output || []
    for (const item of output) {
      if (item.type !== 'function_call' || !item.name || !item.call_id) continue
      if (processedCallsRef.current.has(item.call_id)) continue

      processedCallsRef.current.add(item.call_id)
      setToolLog(prev => [`Tool: ${item.name}`, ...prev].slice(0, 5))

      let result: ToolResult
      try {
        result = await executeToolCall(item.name, safeJsonParse(item.arguments))
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : 'Tool-call mislukt.',
        }
      }

      sendClientEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(result),
        },
      })
      sendClientEvent({ type: 'response.create' })
    }
  }, [executeToolCall, sendClientEvent])

  const handleServerEvent = useCallback((event: RealtimeServerEvent) => {
    if (event.type === 'error') {
      setStatus('error')
      setMessage(event.error?.message || 'Realtime API gaf een fout terug.')
      return
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      setLastHeard(event.transcript)
      return
    }

    if ((event.type === 'response.audio_transcript.done' || event.type === 'response.output_text.done') && event.transcript) {
      setLastAnswer(event.transcript)
      return
    }

    if (event.type === 'response.done') {
      void handleFunctionCalls(event)
    }
  }, [handleFunctionCalls])

  const updateSession = useCallback(() => {
    sendClientEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: {
              model: 'gpt-4o-transcribe',
              language: 'nl',
              prompt: 'Grote Inpak, caselabels, kisten, priority, prio, achterstand, Wilrijk, Genk, Willebroek, stock, transfer, productie.',
            },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'auto',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: 'marin',
          },
        },
        instructions: [
          'Je bent de live Grote Inpak voice-assistent voor prodwilrijk.be.',
          'Praat natuurlijk in Nederlands/Vlaams, zonder Markdown.',
          'Gebruik tools voor actuele aantallen, cases, stock, achterstand en acties.',
          'Bij vragen zoals "welk productieorder is gelinkt aan kisttype K114", "wanneer moest K114 klaar zijn", "tegen welke datum stond K114 gepland", productieorders, einddatum, zagerij, assemblage of vloerstatus gebruik je altijd get_kisttype_production_status.',
          'Voor zo een vraag antwoord je met prod_order_no en ending_date uit de tool-output. Als er meerdere productieorders zijn, noem de eerst geplande open order en vermeld kort dat er meerdere regels zijn.',
          'Als de gebruiker zegt dat een kisttype ergens staat of een status heeft, gebruik set_kisttype_floor_status wanneer het om zagerij/assemblage/transport/klaar gaat. Gebruik anders remember_kisttype_note.',
          'Spreek caselabels en kisttypes teken per teken uit. K352 is K 3 5 2, nooit K driehonderd tweeënvijftig of K driehonderd vijfentwintig.',
          'Verwar case_label niet met case_type. In de tabel is KB91F bijvoorbeeld een caselabel en K352 een kisttype.',
          'Voor muterende acties vraagt de browser bevestiging. Meld daarna kort wat gelukt of geannuleerd is.',
          'Als je iets niet zeker weet, zoek eerst met get_current_overview of find_case.',
        ].join(' '),
        tools: REALTIME_TOOLS,
        tool_choice: 'auto',
        max_output_tokens: 900,
      },
    })
  }, [sendClientEvent])

  const disconnect = useCallback(() => {
    dcRef.current?.close()
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(track => track.stop())
    dcRef.current = null
    pcRef.current = null
    streamRef.current = null
    processedCallsRef.current.clear()
    setStatus('idle')
    setMessage('Realtime assistent is gestopt.')
  }, [])

  const connect = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setMessage('Microfoon is niet beschikbaar in deze browser.')
      return
    }

    setStatus('connecting')
    setMessage('Realtime assistent verbinden...')
    setLastHeard('')
    setLastAnswer('')
    setToolLog([])

    try {
      const tokenResponse = await fetch('/api/grote-inpak/realtime-session', { method: 'POST' })
      const tokenData: SessionResponse = await tokenResponse.json().catch(() => ({}))
      if (!tokenResponse.ok || !tokenData.clientSecret) {
        throw new Error(tokenData.error || 'Realtime sessie kon niet gestart worden.')
      }

      const pc = new RTCPeerConnection()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getAudioTracks().forEach(track => {
        track.enabled = true
        pc.addTrack(track, stream)
      })

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0]
        }
      }

      const dc = pc.createDataChannel('oai-events')
      dc.onopen = () => {
        updateSession()
        setStatus('connected')
        setMessage(`Verbonden met ${tokenData.model || 'OpenAI Realtime'}. Je kunt nu gewoon praten.`)
      }
      dc.onmessage = (event) => {
        try {
          handleServerEvent(JSON.parse(event.data) as RealtimeServerEvent)
        } catch {
          // Niet alle datachannel-events zijn nuttig voor de UI.
        }
      }
      dc.onerror = () => {
        setStatus('error')
        setMessage('Realtime datachannel gaf een fout.')
      }

      pcRef.current = pc
      dcRef.current = dc
      streamRef.current = stream
      setMicEnabled(true)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenData.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      })

      const answerSdp = await sdpResponse.text()
      if (!sdpResponse.ok) {
        throw new Error(`OpenAI Realtime connectie fout ${sdpResponse.status}: ${answerSdp.slice(0, 300)}`)
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (error) {
      disconnect()
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Realtime assistent starten mislukt.')
    }
  }, [disconnect, handleServerEvent, updateSession])

  const toggleMic = useCallback(() => {
    const nextEnabled = !micEnabled
    streamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = nextEnabled
    })
    setMicEnabled(nextEnabled)
  }, [micEnabled])

  const sendTypedPrompt = useCallback(() => {
    const text = typedPrompt.trim()
    if (!text) return

    try {
      sendClientEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
      sendClientEvent({ type: 'response.create' })
      setTypedPrompt('')
      setLastHeard(text)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Vraag sturen mislukt.')
    }
  }, [sendClientEvent, typedPrompt])

  const statusClass =
    status === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : status === 'error'
        ? 'border-red-200 bg-red-50 text-red-950'
        : 'border-sky-200 bg-sky-50 text-sky-950'

  return (
    <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm" aria-label="OpenAI Realtime voice assistent">
      <audio ref={audioRef} autoPlay />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-700" />
            <h3 className="text-base font-semibold text-slate-900">OpenAI Realtime voice assistent</h3>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Live spraak met context van de huidige tabel. De assistent kan cases tellen, zoeken, priority zetten,
            notities toevoegen, productieorder-datums opzoeken en kisttype-statussen onthouden na bevestiging.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'connected' ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {micEnabled ? 'Microfoon aan' : 'Microfoon uit'}
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <PhoneOff className="h-4 w-4" />
                Stop live assistent
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={status === 'connecting'}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {status === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {status === 'connecting' ? 'Verbinden...' : 'Start live voice'}
            </button>
          )}
        </div>
      </div>

      <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${statusClass}`}>
        {message}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Case-acties vragen bevestiging
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{cases.length} cases in huidige context</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{summary.priority} priority</span>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          sendTypedPrompt()
        }}
      >
        <input
          value={typedPrompt}
          onChange={event => setTypedPrompt(event.target.value)}
          placeholder="Of typ een opdracht, bv. zet KB91F op prio klant wacht..."
          disabled={status !== 'connected'}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={status !== 'connected' || !typedPrompt.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          Stuur
        </button>
      </form>

      {(lastHeard || lastAnswer || toolLog.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {lastHeard && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gehoord</div>
              <p className="mt-1 text-slate-800">{lastHeard}</p>
            </div>
          )}
          {lastAnswer && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm lg:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Antwoord</div>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{lastAnswer}</p>
            </div>
          )}
          {toolLog.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Laatste tools</div>
              <p className="mt-1 text-slate-800">{toolLog.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

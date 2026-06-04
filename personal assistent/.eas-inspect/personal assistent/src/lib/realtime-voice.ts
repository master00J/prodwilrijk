import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc'
import { API_BASE } from '@/config'
import { getAccessToken } from '@/lib/auth'

export type RealtimeVoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type RealtimeVoiceEvents = {
  onStatus?: (status: RealtimeVoiceStatus, message: string) => void
  onUserTranscript?: (text: string) => void
  onAssistantTranscript?: (text: string) => void
  onToolUsed?: (name: string) => void
}

type RealtimeFunctionCall = {
  type?: string
  name?: string
  call_id?: string
  arguments?: string
}

type RealtimeServerEvent = {
  type?: string
  error?: { message?: string }
  transcript?: string
  response?: {
    output?: RealtimeFunctionCall[]
  }
}

type SessionResponse = {
  clientSecret?: string
  model?: string
  voice?: string
  error?: string
}

const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'grote_inpak_summary',
    description: 'Samenvatting Grote Inpak cases.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'search_grote_inpak_cases',
    description: 'Zoek Grote Inpak cases.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        location: { type: 'string' },
        priority_only: { type: 'boolean' },
        overdue_only: { type: 'boolean' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'kist_production_status',
    description: 'Productieorders en einddatum voor een kisttype.',
    parameters: {
      type: 'object',
      properties: { kistnummer: { type: 'string' } },
      required: ['kistnummer'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'atlas_order_status',
    description: 'Atlas orderstatus voor shopordernummer.',
    parameters: {
      type: 'object',
      properties: { shop_order: { type: 'string' } },
      required: ['shop_order'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepack_queue_summary',
    description: 'Prepack wachtrij overzicht.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
]

function safeJsonParse(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export class PersonalRealtimeVoice {
  private pc: RTCPeerConnection | null = null
  private dc: ReturnType<RTCPeerConnection['createDataChannel']> | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private processedCalls = new Set<string>()
  private events: RealtimeVoiceEvents

  constructor(events: RealtimeVoiceEvents = {}) {
    this.events = events
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  getStatus(): RealtimeVoiceStatus {
    if (this.dc?.readyState === 'open') return 'connected'
    if (this.pc) return 'connecting'
    return 'idle'
  }

  private setStatus(status: RealtimeVoiceStatus, message: string) {
    this.events.onStatus?.(status, message)
  }

  private sendClientEvent(event: Record<string, unknown>) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Realtime datachannel is niet verbonden.')
    }
    this.dc.send(JSON.stringify(event))
  }

  private updateSession() {
    this.sendClientEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: {
              model: 'gpt-4o-transcribe',
              language: 'nl',
              prompt: 'Prodwilrijk, Grote Inpak, Prepack, kisttype, shoporder, Wilrijk, Genk.',
            },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'auto',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { voice: 'marin' },
        },
        instructions:
          'Je bent de live Prodwilrijk assistent. Praat in Nederlands. Gebruik tools voor actuele data. Geen Markdown.',
        tools: REALTIME_TOOLS,
        tool_choice: 'auto',
        max_output_tokens: 900,
      },
    })
  }

  private async executeTool(name: string, args: Record<string, unknown>) {
    const token = await getAccessToken()
    if (!token) throw new Error('Niet ingelogd')

    const response = await fetch(`${API_BASE}/api/personal-assistant/tools`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, arguments: args }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Tool mislukt')
    }
    return payload
  }

  private async handleFunctionCalls(event: RealtimeServerEvent) {
    const output = event.response?.output || []
    for (const item of output) {
      if (item.type !== 'function_call' || !item.name || !item.call_id) continue
      if (this.processedCalls.has(item.call_id)) continue

      this.processedCalls.add(item.call_id)
      this.events.onToolUsed?.(item.name)

      let result: unknown
      try {
        result = await this.executeTool(item.name, safeJsonParse(item.arguments))
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : 'Tool-call mislukt',
        }
      }

      this.sendClientEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(result),
        },
      })
      this.sendClientEvent({ type: 'response.create' })
    }
  }

  private handleServerEvent(event: RealtimeServerEvent) {
    if (event.type === 'error') {
      this.setStatus('error', event.error?.message || 'Realtime API fout')
      return
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      this.events.onUserTranscript?.(event.transcript)
      return
    }

    if (
      (event.type === 'response.audio_transcript.done' || event.type === 'response.output_text.done') &&
      event.transcript
    ) {
      this.events.onAssistantTranscript?.(event.transcript)
      return
    }

    if (event.type === 'response.done') {
      void this.handleFunctionCalls(event)
    }
  }

  async connect(): Promise<MediaStream | null> {
    if (this.pc) {
      return this.remoteStream
    }

    this.setStatus('connecting', 'Live spraak verbinden…')
    this.processedCalls.clear()

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Niet ingelogd')

      const sessionResponse = await fetch(`${API_BASE}/api/personal-assistant/realtime-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const sessionData = (await sessionResponse.json().catch(() => ({}))) as SessionResponse
      if (!sessionResponse.ok || !sessionData.clientSecret) {
        throw new Error(sessionData.error || 'Realtime sessie kon niet starten')
      }

      const stream = (await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })) as MediaStream

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      pc.ontrack = (event: { streams?: MediaStream[] }) => {
        const remote = event.streams?.[0]
        if (remote) {
          this.remoteStream = remote
        }
      }

      const dc = pc.createDataChannel('oai-events')
      dc.onopen = () => {
        this.updateSession()
        this.setStatus(
          'connected',
          `Live verbonden (${sessionData.model || 'OpenAI Realtime'}). Praat gewoon verder.`
        )
      }
      dc.onmessage = (event: { data?: string }) => {
        try {
          if (typeof event.data === 'string') {
            this.handleServerEvent(JSON.parse(event.data) as RealtimeServerEvent)
          }
        } catch {
          // ignore parse errors
        }
      }
      dc.onerror = () => {
        this.setStatus('error', 'Realtime datachannel fout')
      }

      this.pc = pc
      this.dc = dc
      this.localStream = stream

      const offer = await pc.createOffer({})
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp ?? '',
        headers: {
          Authorization: `Bearer ${sessionData.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      })

      const answerSdp = await sdpResponse.text()
      if (!sdpResponse.ok) {
        throw new Error(`OpenAI Realtime connectie fout ${sdpResponse.status}`)
      }

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }))
      return this.remoteStream
    } catch (error) {
      this.disconnect()
      const message = error instanceof Error ? error.message : 'Live spraak starten mislukt'
      this.setStatus('error', message)
      throw error
    }
  }

  setMicEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled
    })
  }

  disconnect() {
    this.dc?.close()
    this.pc?.close()
    this.localStream?.getTracks().forEach(track => track.stop())
    this.dc = null
    this.pc = null
    this.localStream = null
    this.remoteStream = null
    this.processedCalls.clear()
    this.setStatus('idle', 'Live spraak gestopt.')
  }
}

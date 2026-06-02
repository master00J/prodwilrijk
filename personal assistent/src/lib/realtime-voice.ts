import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av'
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
  onRemoteStream?: (stream: MediaStream) => void
  onToolUsed?: (name: string) => void
}

/** react-native-webrtc typings missen legacy event handlers */
type RTCPeerConnectionHandlers = RTCPeerConnection & {
  ontrack: ((event: { streams?: MediaStream[] }) => void) | null
  onconnectionstatechange: (() => void) | null
}

type RTCDataChannelHandlers = ReturnType<RTCPeerConnection['createDataChannel']> & {
  onopen: (() => void) | null
  onmessage: ((event: { data?: string }) => void) | null
  onerror: (() => void) | null
}

type RealtimeOutputItem = {
  type?: string
  name?: string
  call_id?: string
  arguments?: string
  content?: Array<{ type?: string; text?: string; transcript?: string }>
}

type RealtimeServerEvent = {
  type?: string
  error?: { message?: string }
  transcript?: string
  item?: RealtimeOutputItem
  response?: {
    output?: RealtimeOutputItem[]
  }
}

type SessionResponse = {
  clientSecret?: string
  model?: string
  voice?: string
  error?: string
}

function safeJsonParse(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function extractAssistantText(item: RealtimeOutputItem): string {
  const parts = item.content || []
  return parts
    .map(part => part.transcript || part.text || '')
    .filter(Boolean)
    .join(' ')
    .trim()
}

function isMeaningfulAssistantText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed === '{}' || trimmed === '[]' || trimmed === 'null' || trimmed === 'undefined') {
    return false
  }
  return /[a-zA-ZÀ-ÿ]{2,}/.test(trimmed)
}

function getFunctionCallId(item: RealtimeOutputItem): string | null {
  const id = item.call_id || (item as { id?: string }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

function stringifyToolOutput(result: unknown): string {
  const raw = JSON.stringify(result ?? {})
  const maxLen = 14_000
  if (raw.length <= maxLen) return raw
  return JSON.stringify({
    ok: true,
    truncated: true,
    preview: raw.slice(0, maxLen),
  })
}

export class PersonalRealtimeVoice {
  private pc: RTCPeerConnection | null = null
  private dc: ReturnType<RTCPeerConnection['createDataChannel']> | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private processedCalls = new Set<string>()
  private assistantTranscriptBuffer = ''
  private awaitingToolFollowUp = false
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
    if (payload && typeof payload === 'object' && 'result' in payload) {
      return (payload as { result: unknown }).result
    }
    return payload
  }

  private emitAssistantTranscript(text: string) {
    if (!isMeaningfulAssistantText(text)) return
    this.awaitingToolFollowUp = false
    this.events.onAssistantTranscript?.(text)
  }

  private async handleFunctionCalls(event: RealtimeServerEvent) {
    const output = event.response?.output || []
    const calls = output.filter(
      item => item.type === 'function_call' && item.name && getFunctionCallId(item)
    )
    if (calls.length === 0) return

    this.awaitingToolFollowUp = true
    this.assistantTranscriptBuffer = ''

    for (const item of calls) {
      const callId = getFunctionCallId(item)
      if (!callId || !item.name) continue
      if (this.processedCalls.has(callId)) continue

      this.processedCalls.add(callId)
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
          call_id: callId,
          output: stringifyToolOutput(result),
        },
      })
    }

    this.sendClientEvent({ type: 'response.create' })
  }

  private flushAssistantTranscript() {
    const text = this.assistantTranscriptBuffer.trim()
    this.assistantTranscriptBuffer = ''
    if (text) {
      this.emitAssistantTranscript(text)
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
      event.type === 'response.audio_transcript.delta' ||
      event.type === 'response.output_audio_transcript.delta'
    ) {
      if (this.awaitingToolFollowUp) return
      if (event.transcript) {
        this.assistantTranscriptBuffer += event.transcript
      }
      return
    }

    if (
      (event.type === 'response.audio_transcript.done' ||
        event.type === 'response.output_audio_transcript.done') &&
      event.transcript
    ) {
      this.emitAssistantTranscript(event.transcript)
      return
    }

    if (event.type === 'response.output_item.done' && event.item?.type === 'message') {
      const text = extractAssistantText(event.item)
      if (text) {
        this.emitAssistantTranscript(text)
      }
      return
    }

    if (event.type === 'response.done') {
      const output = event.response?.output || []
      const hasFunctionCall = output.some(item => item.type === 'function_call')

      if (hasFunctionCall) {
        this.assistantTranscriptBuffer = ''
        void this.handleFunctionCalls(event)
        return
      }

      for (const item of output) {
        if (item.type === 'message') {
          const text = extractAssistantText(item)
          if (text) {
            this.emitAssistantTranscript(text)
          }
        }
      }
      this.flushAssistantTranscript()
    }
  }

  async connect(): Promise<MediaStream | null> {
    if (this.pc) {
      return this.remoteStream
    }

    this.setStatus('connecting', 'Live spraak verbinden…')
    this.processedCalls.clear()
    this.awaitingToolFollowUp = false

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      })

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
      }) as RTCPeerConnectionHandlers

      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      pc.ontrack = (event: { streams?: MediaStream[] }) => {
        const remote = event.streams?.[0]
        if (remote) {
          remote.getAudioTracks().forEach(track => {
            track.enabled = true
          })
          this.remoteStream = remote
          this.events.onRemoteStream?.(remote)
        }
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        if (state === 'failed' || state === 'closed') {
          this.setStatus('error', `Verbinding verbroken (${state}).`)
          this.disconnect('connection')
        }
      }

      const dc = pc.createDataChannel('oai-events') as RTCDataChannelHandlers
      dc.onopen = () => {
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
      this.disconnect('error')
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

  disconnect(reason: 'user' | 'error' | 'connection' | 'cleanup' = 'user') {
    this.dc?.close()
    this.pc?.close()
    this.localStream?.getTracks().forEach(track => track.stop())
    this.dc = null
    this.pc = null
    this.localStream = null
    this.remoteStream = null
    this.processedCalls.clear()
    this.assistantTranscriptBuffer = ''
    this.awaitingToolFollowUp = false

    if (reason === 'user') {
      this.setStatus('idle', 'Live spraak gestopt.')
    } else if (reason === 'cleanup') {
      // Geen statusmelding bij unmount
    } else if (reason === 'connection') {
      // status al gezet
    } else {
      this.setStatus('idle', 'Live spraak beëindigd.')
    }
  }
}

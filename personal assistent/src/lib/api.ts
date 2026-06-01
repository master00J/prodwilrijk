import { API_BASE } from '@/config'
import type { ChatMessage, ChatResponse, VoiceResponse } from '@/types'
import { getAccessToken } from '@/lib/auth'

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Niet ingelogd')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
}

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await authorizedFetch('/api/personal-assistant/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Assistent antwoord mislukt')
  }

  return payload as ChatResponse
}

export async function sendVoice(
  uri: string,
  history: ChatMessage[]
): Promise<VoiceResponse> {
  const formData = new FormData()
  formData.append('audio', {
    uri,
    name: 'voice.m4a',
    type: 'audio/m4a',
  } as unknown as Blob)
  formData.append(
    'history',
    JSON.stringify(
      history.map(message => ({
        role: message.role,
        content: message.content,
      }))
    )
  )

  const response = await authorizedFetch('/api/personal-assistant/voice', {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Spraakverwerking mislukt')
  }

  return payload as VoiceResponse
}

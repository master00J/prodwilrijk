export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type VoiceResponse = {
  transcript: string
  answer: string
  toolsUsed?: string[]
}

export type ChatResponse = {
  answer: string
  toolsUsed?: string[]
}

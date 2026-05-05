'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X, MessageCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type GuidedWorkflow = {
  type: 'wood-receive'
  step: 1 | 2 | 3 | 4
}

const HIDDEN_PATHS = ['/login', '/signup', '/pending-verification', '/tv-display']

const STARTERS = [
  'Ik wil hout ontvangen',
  'Hoe verwerk ik een prepack?',
  'Hoe upload ik Grote Inpak stock?',
  'Hoe registreer ik tijd op een productieorder?',
  'Wat moet ik doen als hout niet op voorraad is?',
]

function shouldHide(pathname: string | null) {
  if (!pathname) return true
  return HIDDEN_PATHS.some(path => pathname.startsWith(path))
}

function isWoodReceiveQuestion(question: string) {
  const normalized = question.toLowerCase()
  return (
    normalized.includes('hout') &&
    (
      normalized.includes('ontvang') ||
      normalized.includes('ontvangen') ||
      normalized.includes('levering') ||
      normalized.includes('pdf') ||
      normalized.includes('inscannen') ||
      normalized.includes('scan') ||
      normalized.includes('rek') ||
      normalized.includes('locatie') ||
      normalized.includes('stock')
    )
  )
}

function woodReceiveStepMessage(step: GuidedWorkflow['step']) {
  if (step === 1) {
    return [
      'We begeleiden het ontvangen van hout stap voor stap.',
      '',
      'Stap 1: open [Open houtorders](https://prodwilrijk.be/wood/open-orders).',
      'Registreer daar de pakketten op de open order, of gebruik "Import PDF" voor de Foresco CMR Summary.',
      '',
      'Klik daarna hier op "Pakketten geregistreerd".',
    ].join('\n')
  }

  if (step === 2) {
    return [
      'Stap 2: controleer de ingelezen pakketten.',
      '',
      'Let vooral op:',
      '- pakketnummers',
      '- houtsoort',
      '- dikte, breedte en lengte',
      '- aantal planken per pak',
      '',
      'Klik pas verder als deze gegevens overeenkomen met de levering. De locatie/rekpositie volgt in de volgende stap.',
    ].join('\n')
  }

  if (step === 3) {
    return [
      'Stap 3: zet het pakket in het rek via [Hout receive](https://prodwilrijk.be/wood/receive).',
      '',
      'Zoek of selecteer het pakket bij "Packages Ready for Location".',
      'Vul de juiste fysieke locatie of rekpositie in.',
      'Klik daarna op "Add to Stock".',
    ].join('\n')
  }

  return [
    'Stap 4: controleer de stock.',
    '',
    'Na "Add to Stock" is het pakket ontvangen, staat de locatie op het pakket en is er een wood stock-lijn aangemaakt.',
    'Controleer bij twijfel of de juiste lengte, aantallen en locatie zijn toegevoegd.',
  ].join('\n')
}

function renderMessageContent(content: string) {
  const parts = content.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g)
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (!match) return <span key={index}>{part}</span>

    const [, label, href] = match
    return (
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2"
      >
        {label}
      </a>
    )
  })
}

export default function AiChatWidget() {
  const pathname = usePathname()
  const { user, loading, isVerified } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hallo, ik ben de Prodwilrijk proceshulp. Vraag gerust hoe een workflow werkt, bijvoorbeeld prepack verwerken of productieorder-tijd registreren.',
    },
  ])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guidedWorkflow, setGuidedWorkflow] = useState<GuidedWorkflow | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  if (loading || !user || !isVerified || shouldHide(pathname)) return null

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || isSending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setError(null)

    if (isWoodReceiveQuestion(question)) {
      setGuidedWorkflow({ type: 'wood-receive', step: 1 })
      setMessages([...nextMessages, { role: 'assistant', content: woodReceiveStepMessage(1) }])
      return
    }

    setIsSending(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter(message => message.role === 'user' || message.role === 'assistant'),
          pagePath: pathname,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI-hulp is tijdelijk niet beschikbaar')
      setMessages([...nextMessages, { role: 'assistant', content: data.answer }])
    } catch (err: any) {
      setError(err.message || 'AI-hulp is tijdelijk niet beschikbaar')
      setMessages(nextMessages)
    } finally {
      setIsSending(false)
    }
  }

  const advanceWoodWorkflow = (step: GuidedWorkflow['step']) => {
    setGuidedWorkflow({ type: 'wood-receive', step })
    setMessages(previous => [...previous, { role: 'assistant', content: woodReceiveStepMessage(step) }])
  }

  const finishWoodWorkflow = () => {
    setGuidedWorkflow(null)
    setMessages(previous => [
      ...previous,
      {
        role: 'assistant',
        content: 'Klaar. Het hout is correct verwerkt als het pakket geregistreerd is, via /wood/receive een locatie heeft gekregen en de voorraad klopt in wood stock. Controleer bij twijfel met je verantwoordelijke.',
      },
    ])
  }

  return (
    <div className="print:hidden">
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Bot className="h-5 w-5" />
                Prodwilrijk proceshulp
              </div>
              <p className="mt-0.5 text-xs text-slate-300">Voor uitleg over workflows. Voert zelf geen acties uit.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-200 hover:bg-white/10 hover:text-white"
              aria-label="Sluit AI chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[55vh] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-8 bg-blue-600 text-white'
                    : 'mr-8 bg-slate-100 text-slate-800'
                }`}
              >
                {renderMessageContent(message.content)}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">Voorbeelden</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map(starter => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => sendMessage(starter)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSending && (
              <div className="mr-8 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Antwoord wordt gemaakt...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {guidedWorkflow?.type === 'wood-receive' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <div className="mb-2 font-semibold">Begeleide workflow: hout ontvangen</div>
                <div className="mb-3 text-xs text-emerald-800">Stap {guidedWorkflow.step} van 4</div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={guidedWorkflow.step >= 3 ? 'https://prodwilrijk.be/wood/receive' : 'https://prodwilrijk.be/wood/open-orders'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800"
                  >
                    {guidedWorkflow.step >= 3 ? 'Open Hout receive' : 'Open houtorders'}
                  </a>
                  {guidedWorkflow.step === 1 && (
                    <button
                      type="button"
                      onClick={() => advanceWoodWorkflow(2)}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      Pakketten geregistreerd
                    </button>
                  )}
                  {guidedWorkflow.step === 2 && (
                    <button
                      type="button"
                      onClick={() => advanceWoodWorkflow(3)}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      Pakketten gecontroleerd
                    </button>
                  )}
                  {guidedWorkflow.step === 3 && (
                    <button
                      type="button"
                      onClick={() => advanceWoodWorkflow(4)}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      Locatie ingevuld en toegevoegd
                    </button>
                  )}
                  {guidedWorkflow.step === 4 && (
                    <button
                      type="button"
                      onClick={finishWoodWorkflow}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      Stock gecontroleerd
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <form
            className="border-t border-slate-200 p-3"
            onSubmit={event => {
              event.preventDefault()
              void sendMessage()
            }}
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Vraag hoe je iets moet doen..."
                className="min-h-[42px] flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-50"
                aria-label="Verstuur vraag"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Controleer kritieke stappen altijd met je verantwoordelijke.
            </p>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800"
        aria-label="Open AI proceshulp"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  )
}

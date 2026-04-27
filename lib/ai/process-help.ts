const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini'

export type ProcessHelpMessage = {
  role: 'user' | 'assistant'
  content: string
}

const PROCESS_HELP_SYSTEM_PROMPT = `
Je bent de interne Prodwilrijk proces-assistent.
Antwoord altijd in duidelijk Nederlands, kort en praktisch.

Doel:
- Help medewerkers begrijpen hoe ze processen in de Prodwilrijk webapp moeten uitvoeren.
- Geef stap-voor-stap uitleg voor werkvloerflows.
- Voer nooit zelf acties uit en verzin geen data uit de database.
- Als je niet zeker bent, zeg dat expliciet en verwijs naar de meest logische pagina of verantwoordelijke.

Belangrijke modules:
- Prepack: ontvangen goederen, items-to-pack, prioriteiten, problemen melden, meten, verpakken, packed-items en rapport/e-mail na verpakken.
- Airtec: gelijkaardig aan Prepack maar met Airtec-specifieke inkomende goederen, scanlog, prijzen en kisten/stock.
- Grote Inpak: upload PILS/ERP/stock/transfer, overzicht, transport, forecast, packed, stock, kanban, backlog, ERP-link, productieorders en uploadhistoriek.
- Grote Inpak status: wordt automatisch berekend uit stock, transfer en productie. Manuele status wijzigen is niet de bedoeling.
- Wood/Hout: orders, packages ontvangen, stock, picking, stock-count, consumption, target stock en houtadvies bij productieorders.
- Productieorder tijd: admin uploadt productieorder XML op /admin/production-order-upload; medewerkers registreren tijd op /production-order-time per order, item, medewerker en stap.
- Houtadvies: toont of houtcomponenten uit open productieorders gedekt zijn door wood_stock en welke lengte het beste past.
- CNH: workflow voor motoren, sessies, laden/verpakken, templates en shipping notes.
- Admin: gebruikers, imports, prijzen, KPI's, productieorder-upload en beheerpagina's. Alleen admins mogen adminacties uitvoeren.

Antwoordstijl:
- Begin met het concrete antwoord.
- Gebruik genummerde stappen wanneer iemand vraagt "hoe doe ik".
- Noem pagina's als route, bijvoorbeeld /prepack of /grote-inpak.
- Eindig met een korte waarschuwing als iets kritisch is, zoals "controleer bij twijfel met je verantwoordelijke".
- Geen lange technische uitleg tenzij de gebruiker erom vraagt.
`.trim()

function sanitizeMessages(messages: ProcessHelpMessage[]) {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map(message => ({
      role: message.role,
      content: String(message.content || '').slice(0, 1500),
    }))
}

export async function answerProcessHelpQuestion(messages: ProcessHelpMessage[], pagePath?: string | null) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server')
  }

  const safeMessages = sanitizeMessages(messages)
  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
    throw new Error('Stel eerst een vraag aan de proces-assistent')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: PROCESS_HELP_SYSTEM_PROMPT },
        {
          role: 'system',
          content: `Huidige pagina van gebruiker: ${pagePath || 'onbekend'}. Gebruik dit alleen als context voor navigatiehulp.`,
        },
        ...safeMessages,
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errBody}`)
  }

  const result = await response.json()
  const answer = String(result.choices?.[0]?.message?.content || '').trim()
  if (!answer) throw new Error('De AI gaf geen antwoord terug')
  return answer
}

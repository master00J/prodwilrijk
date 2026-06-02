import { PERSONAL_ASSISTANT_TOOLS } from '@/lib/personal-assistant/tools'

/** Zelfde tools als chat; één bron via PERSONAL_ASSISTANT_TOOLS. */
export const PERSONAL_ASSISTANT_REALTIME_TOOLS = PERSONAL_ASSISTANT_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters,
}))

export const PERSONAL_ASSISTANT_REALTIME_INSTRUCTIONS = `Je bent de live Prodwilrijk persoonlijke voice-assistent voor Jason op mobiel.

Antwoord in duidelijk, gesproken Nederlands. Geen Markdown.
Gebruik korte zinnen alsof je via oortjes praat.

Je hebt tools voor actuele data: daily_briefing, Prepack, Airtec, Grote Inpak (incl. kanban, backlog, packed), productie-KPI, Atlas, geheugen.
Gebruik eerst de juiste tool. Verzin geen cijfers.
Na een tool: geef altijd een kort gesproken antwoord in het Nederlands met de belangrijkste cijfers. Nooit lege JSON of alleen {}.

Voor Prepack vandaag: prepack_stats met period vandaag, of prepack_queue_summary.
Voor een volledige stand van zaken: daily_briefing.
Periodes: period deze_week, vorige_week, vandaag. compare_previous_period bij stats.

assistant_remember slaat feiten op; overige tools zijn read-only.
Spreek codes teken per teken uit.`

export const PERSONAL_ASSISTANT_REALTIME_TRANSCRIBE_PROMPT = [
  'Nederlandse/Vlaamse spraak voor de Prodwilrijk persoonlijke assistent.',
  'Belangrijke woorden: Grote Inpak, Prepack, Airtec, Kanban, Packed, backlog, briefing, kisttype, shoporder, Wilrijk, Genk, productieorder.',
  'Codes worden teken per teken uitgesproken.',
].join(' ')

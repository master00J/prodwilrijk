export type InstructieStepId =
  | 'intro'
  | 'packed-xml'
  | 'stock-upload'
  | 'stock-verwerken'
  | 'forecast-upload'
  | 'transport-excel'
  | 'forecast-dates'
  | 'forecast-export'
  | 'done'

export type InstructieTabId = 1 | 2 | 3 | 'upload'

export interface InstructieStep {
  id: InstructieStepId
  tab: InstructieTabId
  title: string
  narration: string
  tip?: string
  durationMs: number
  highlight?: string
}

export const INSTRUCTIE_STEPS: InstructieStep[] = [
  {
    id: 'intro',
    tab: 3,
    title: 'Welkom',
    narration:
      'Deze handleiding loopt de dagelijkse Grote Inpak-flow door met voorbeelddata. Volg de stappen in volgorde. Zo kan je morgen de orders doorboeken.',
    durationMs: 6000,
  },
  {
    id: 'packed-xml',
    tab: 3,
    title: 'Stap 1 — Packed → XML',
    narration:
      'Open tab Packed. Onder Concept imports uit mailbox staan de PACKED-bestanden. Controleer de regels en vink Gebruik uit wat niet mee mag. Klik daarna op XML genereren. De XML-bestanden worden gedownload voor Business Central.',
    tip: 'Vink INDUS Y aan waar het KC-suffix op het itemnummer hoort.',
    durationMs: 12000,
    highlight: 'packed-xml-btn',
  },
  {
    id: 'stock-upload',
    tab: 'upload',
    title: 'Stap 2 — Stock uit Business Central',
    narration:
      'Ga naar Data uploaden bovenaan. Exporteer in Business Central per locatie een Excel en noem de bestanden exact: Stock Wilrijk, Stock Willebroek en Stock Genk. Filter steeds op de juiste locatie vóór export.',
    tip: 'Zet Nieuwe BC36 aan, tenzij je bewust een oude GP-export uploadt.',
    durationMs: 14000,
    highlight: 'stock-upload-zone',
  },
  {
    id: 'stock-verwerken',
    tab: 'upload',
    title: 'Stap 2b — Stock verwerken',
    narration:
      'Selecteer alle drie stock-bestanden tegelijk en klik op Verwerken. Wacht tot de groene bevestiging verschijnt. Daarna zijn de voorraadcijfers beschikbaar in Transport en Forecast.',
    durationMs: 9000,
    highlight: 'verwerken-btn',
  },
  {
    id: 'forecast-upload',
    tab: 2,
    title: 'Stap 3 — Forecast CSV uploaden',
    narration:
      'Open tab Forecast. In Forecast uploaden sleep je de Atlas-forecast CSV-bestanden. Klik Upload. Het systeem vergelijkt met de vorige upload en toont wijzigingen.',
    durationMs: 11000,
    highlight: 'forecast-upload-btn',
  },
  {
    id: 'transport-excel',
    tab: 1,
    title: 'Stap 4 — Transport planning',
    narration:
      'Open tab Transport. Controleer het planningsoverzicht van Genk naar Willebroek en klik op Genereer Transport Planning Excel. Het Excel-bestand wordt gedownload voor de transportplanning.',
    durationMs: 10000,
    highlight: 'transport-excel-btn',
  },
  {
    id: 'forecast-dates',
    tab: 2,
    title: 'Stap 5a — Datumfilters instellen',
    narration:
      'Ga terug naar tab Forecast. Stel bij Huidige forecast de datumfilters in. Van is vandaag of de start van de periode. Tot is het einde van de gewenste forecastperiode, bijvoorbeeld vier weken verder. Zonder correcte datums exporteert de matrix te veel of te weinig.',
    durationMs: 12000,
    highlight: 'forecast-dates',
  },
  {
    id: 'forecast-export',
    tab: 2,
    title: 'Stap 5b — Forecast trekken',
    narration:
      'Klik op Matrix Alle locaties, de blauwe knop rechtsboven. Het Excel-bestand wordt gedownload met alle forecast-labels binnen je datumbereik. Dit is de forecast die je doorboekt.',
    tip: 'Gebruik Matrix Genk of Matrix Wilrijk alleen als je één locatie apart wilt controleren.',
    durationMs: 11000,
    highlight: 'matrix-alle-btn',
  },
  {
    id: 'done',
    tab: 2,
    title: 'Klaar',
    narration:
      'De flow is afgerond. XML uit Packed, stock verwerkt, forecast geüpload, transport-Excel gegenereerd en de forecast-matrix Alle locaties gedownload. Bij twijfel, vraag een collega of bekijk Uploadhistoriek.',
    durationMs: 8000,
  },
]

export function getInstructieStep(stepId: InstructieStepId): InstructieStep | undefined {
  return INSTRUCTIE_STEPS.find((s) => s.id === stepId)
}

export function instructieSpeechText(step: InstructieStep): string {
  const parts = [step.narration]
  if (step.tip) parts.push(`Tip: ${step.tip}`)
  return parts.join(' ')
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileSpreadsheet,
  Mail,
  Package,
  Pause,
  Play,
  SkipForward,
  Upload,
} from 'lucide-react'
import Link from 'next/link'

type StepId =
  | 'intro'
  | 'packed-xml'
  | 'stock-upload'
  | 'stock-verwerken'
  | 'forecast-upload'
  | 'transport-excel'
  | 'forecast-dates'
  | 'forecast-export'
  | 'done'

type TabId = 1 | 2 | 3 | 'upload'

interface WalkStep {
  id: StepId
  tab: TabId
  title: string
  narration: string
  tip?: string
  durationMs: number
  highlight?: string
}

const TABS = [
  { id: 10, label: '📊 Dashboard' },
  { id: 0, label: 'Overzicht' },
  { id: 1, label: 'Transport' },
  { id: 2, label: 'Forecast' },
  { id: 3, label: 'Packed' },
  { id: 4, label: 'Stock' },
  { id: 5, label: 'Kanban' },
  { id: 6, label: 'Backlog' },
  { id: 7, label: 'ERP-koppeling' },
  { id: 9, label: 'Productieorders' },
  { id: 8, label: 'Uploadhistoriek' },
]

const STEPS: WalkStep[] = [
  {
    id: 'intro',
    tab: 3,
    title: 'Welkom',
    narration:
      'Deze handleiding loopt de dagelijkse Grote Inpak-flow door met voorbeelddata. Volg de stappen in volgorde — morgen kan je zo de orders doorboeken.',
    durationMs: 6000,
  },
  {
    id: 'packed-xml',
    tab: 3,
    title: 'Stap 1 — Packed → XML',
    narration:
      'Open tab Packed. Onder «Concept imports uit mailbox» staan de PACKED-bestanden. Controleer de regels (vink «Gebruik» uit wat niet mee mag). Klik daarna op «XML genereren» — de XML-bestanden worden gedownload voor BC.',
    tip: 'INDUS Y aanvinken waar het KC-suffix op het itemnummer hoort.',
    durationMs: 12000,
    highlight: 'packed-xml-btn',
  },
  {
    id: 'stock-upload',
    tab: 'upload',
    title: 'Stap 2 — Stock uit Business Central',
    narration:
      'Ga naar «Data uploaden» bovenaan. Exporteer in Business Central per locatie een Excel en noem de bestanden exact: Stock Wilrijk.xlsx, Stock Willebroek.xlsx en Stock Genk.xlsx. Filter steeds op de juiste locatie vóór export.',
    tip: 'Zet «Nieuwe BC36» aan tenzij je bewust een oude GP-export uploadt.',
    durationMs: 14000,
    highlight: 'stock-upload-zone',
  },
  {
    id: 'stock-verwerken',
    tab: 'upload',
    title: 'Stap 2b — Stock verwerken',
    narration:
      'Selecteer alle drie stock-bestanden tegelijk en klik op «Verwerken». Wacht tot de groene bevestiging verschijnt — daarna zijn de voorraadcijfers beschikbaar in Transport en Forecast.',
    durationMs: 9000,
    highlight: 'verwerken-btn',
  },
  {
    id: 'forecast-upload',
    tab: 2,
    title: 'Stap 3 — Forecast CSV uploaden',
    narration:
      'Open tab Forecast. In «Forecast uploaden» sleep je de Atlas-forecast CSV-bestanden (FOR#### of FORESCO). Klik «Upload» — het systeem vergelijkt met de vorige upload en toont wijzigingen.',
    durationMs: 11000,
    highlight: 'forecast-upload-btn',
  },
  {
    id: 'transport-excel',
    tab: 1,
    title: 'Stap 4 — Transport planning',
    narration:
      'Open tab Transport. Controleer het planningsoverzicht (Genk → Willebroek) en klik op «Genereer Transport Planning Excel». Het Excel-bestand wordt gedownload voor de transportplanning.',
    durationMs: 10000,
    highlight: 'transport-excel-btn',
  },
  {
    id: 'forecast-dates',
    tab: 2,
    title: 'Stap 5a — Datumfilters instellen',
    narration:
      'Terug naar tab Forecast. Stel bij «Huidige forecast» de datumfilters in: «Van» = vandaag of start van de periode, «Tot» = einde van de gewenste forecastperiode (bv. +4 weken). Zonder correcte datums exporteert BC te veel of te weinig.',
    durationMs: 12000,
    highlight: 'forecast-dates',
  },
  {
    id: 'forecast-export',
    tab: 2,
    title: 'Stap 5b — Forecast trekken (BC import)',
    narration:
      'Klik op «BC forecast import» (groene knop). Dit genereert het zip-bestand voor Business Central Demand Forecast Entry — per locatie Wilrijk en Genk, enkel nog te starten FP-codes binnen je datumbereik.',
    tip: 'Alternatief: «Matrix Genk» / «Matrix Wilrijk» voor handmatige Excel-controle.',
    durationMs: 11000,
    highlight: 'bc-forecast-btn',
  },
  {
    id: 'done',
    tab: 2,
    title: 'Klaar',
    narration:
      'Flow afgerond: XML uit Packed, stock verwerkt, forecast geüpload, transport-Excel gegenereerd en BC-forecast geëxporteerd. Bij twijfel: vraag collega\'s of bekijk Uploadhistoriek.',
    durationMs: 8000,
  },
]

const MOCK_PACKED_BATCH = {
  source_file: 'PACKED_20250622.xls',
  source_type: 'PACKED',
  imported_at: '22/06/2025 08:15',
  rows: [
    { case_label: 'FOR1234567', series: 'S4', case_type: 'C142', packed_date: '21/06/2025', excluded: false },
    { case_label: 'FOR1234568', series: 'APF', case_type: 'C167', packed_date: '21/06/2025', excluded: false },
    { case_label: 'FOR1234569', series: 'S5', case_type: 'K361', packed_date: '21/06/2025', excluded: true },
  ],
}

const MOCK_FORECAST = [
  { case_label: 'FOR1234570', case_type: 'C142', arrival: '25/06/2025', source: 'FOR0625.csv', on_pils: false },
  { case_label: 'FOR1234571', case_type: 'C201', arrival: '27/06/2025', source: 'FOR0625.csv', on_pils: true },
  { case_label: 'FOR1234572', case_type: 'C548', arrival: '02/07/2025', source: 'FORESCO0625.csv', on_pils: false },
]

const MOCK_TRANSPORT_GROUPS = [
  { case_type: 'C142', erp: 'FP-00142', total: 12, inWb: 4, teSturen: 8, teLaat: 1 },
  { case_type: 'C167', erp: 'FP-00167', total: 6, inWb: 2, teSturen: 4, teLaat: 0 },
  { case_type: 'C201', erp: 'FP-00201', total: 9, inWb: 1, teSturen: 8, teLaat: 2 },
]

function fmtToday(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function HighlightRing({ active, children, id }: { active: boolean; children: React.ReactNode; id?: string }) {
  return (
    <div
      data-highlight={id}
      className={`relative rounded-lg transition-all duration-500 ${
        active ? 'ring-4 ring-amber-400 ring-offset-2 shadow-lg shadow-amber-200/60 z-10' : ''
      }`}
    >
      {active && (
        <span className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold animate-pulse z-20">
          ▶
        </span>
      )}
      {children}
    </div>
  )
}

export default function InstructieVideo() {
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [uploadExpanded, setUploadExpanded] = useState(true)
  const [simState, setSimState] = useState({
    xmlExported: false,
    stockSelected: false,
    stockProcessed: false,
    forecastSelected: false,
    forecastUploaded: false,
    transportGenerated: false,
    dateFrom: '',
    dateTo: '',
    bcExported: false,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const step = STEPS[stepIndex]
  const activeTab = step.tab === 'upload' ? null : step.tab

  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const applyStepEffects = useCallback((s: WalkStep) => {
    setSimState((prev) => {
      const next = { ...prev }
      if (s.id === 'packed-xml') next.xmlExported = true
      if (s.id === 'stock-upload') next.stockSelected = true
      if (s.id === 'stock-verwerken') next.stockProcessed = true
      if (s.id === 'forecast-upload') {
        next.forecastSelected = true
        next.forecastUploaded = true
      }
      if (s.id === 'transport-excel') next.transportGenerated = true
      if (s.id === 'forecast-dates') {
        next.dateFrom = fmtToday(0)
        next.dateTo = fmtToday(28)
      }
      if (s.id === 'forecast-export') next.bcExported = true
      return next
    })
  }, [])

  const goToStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, STEPS.length - 1))
      setStepIndex(clamped)
      for (let i = 0; i <= clamped; i++) applyStepEffects(STEPS[i])
    },
    [applyStepEffects],
  )

  useEffect(() => {
    applyStepEffects(step)
  }, [step, applyStepEffects])

  useEffect(() => {
    if (!playing) return
    timerRef.current = setTimeout(() => {
      if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1)
      else setPlaying(false)
    }, step.durationMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, stepIndex, step.durationMs, goToStep])

  const isHighlight = (id: string) => step.highlight === id

  const nowStr = useMemo(
    () =>
      new Date().toLocaleString('nl-BE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )

  return (
    <div className="min-h-screen w-full max-w-none bg-[#e6eef8] text-slate-900 antialiased">
      {/* Instructie banner */}
      <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 shadow-md">
        <div className="mx-auto flex max-w-none flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="shrink-0 rounded bg-amber-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Instructievideo
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-amber-950">{step.title}</p>
              <p className="line-clamp-2 text-xs text-amber-900/80">{step.narration}</p>
              {step.tip && <p className="mt-0.5 text-xs text-amber-700">💡 {step.tip}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a4b8c] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#153d75]"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? 'Pauze' : 'Afspelen'}
            </button>
            <button
              type="button"
              onClick={() => goToStep(stepIndex + 1)}
              disabled={stepIndex >= STEPS.length - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" /> Volgende
            </button>
            <Link
              href="/grote-inpak"
              className="hidden rounded-lg border border-[#1a4b8c] px-3 py-1.5 text-sm font-medium text-[#1a4b8c] hover:bg-blue-50 sm:inline-block"
            >
              Naar live app →
            </Link>
          </div>
        </div>
        <div className="h-1 bg-amber-200">
          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 pt-1 sm:px-6">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPlaying(false)
                goToStep(i)
              }}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                i === stepIndex
                  ? 'bg-amber-600 text-white'
                  : i < stepIndex
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {i + 1}. {s.title.replace(/^Stap \d+[a-z]? — /, '').replace(/^Stap \d+[a-z]? — /, '')}
            </button>
          ))}
        </div>
      </div>

      {/* Site header — exact copy */}
      <header className="border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#153d75] text-white shadow-md">
        <div className="flex w-full max-w-none flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-white/20 bg-white/10 text-sm font-bold">
              GI
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">Atlas Copco</p>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Grote inpak</h1>
              <p className="mt-0.5 max-w-xl text-xs text-sky-100/90">
                PILS, stock, transfer en forecast. Tab <span className="font-medium text-white">Overzicht</span> is het
                hoofdscherm.
              </p>
            </div>
          </div>
          <div className="text-xs text-sky-100/95 tabular-nums">{nowStr}</div>
        </div>
      </header>

      <div className="w-full max-w-none px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Upload section */}
        <div
          className={`mb-6 rounded-lg border border-slate-300/80 bg-white p-5 shadow-sm sm:p-6 transition-all ${
            step.tab === 'upload' ? 'ring-2 ring-amber-300' : ''
          }`}
        >
          <div
            className="-m-2 mb-4 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50"
            onClick={() => setUploadExpanded(!uploadExpanded)}
          >
            <h2 className="text-lg font-semibold text-slate-900">Data uploaden</h2>
            {uploadExpanded ? (
              <ChevronUp className="h-6 w-6 text-gray-500" />
            ) : (
              <ChevronDown className="h-6 w-6 text-gray-500" />
            )}
          </div>

          {uploadExpanded && (
            <div>
              {simState.stockProcessed && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300/80 bg-emerald-50 p-4 text-emerald-950">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>✅ Stock bestanden succesvol geüpload (BC36)! 3 bestand(en), 847 items verwerkt.</span>
                </div>
              )}

              {/* PILS placeholder — collapsed visually */}
              <div className="mb-4 opacity-40 pointer-events-none">
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
                  <p className="text-sm font-medium">PILS CSV</p>
                  <p className="text-xs text-gray-500">(niet in deze demo — upload indien nodig apart)</p>
                </div>
              </div>

              {/* Stock upload */}
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  📦 Stock Bestanden (Optioneel - Meerdere bestanden mogelijk)
                </label>
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-medium text-amber-900">🔄 BC-omgeving van deze upload</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 rounded-lg border-2 border-amber-500 bg-white px-3 py-2 shadow-sm">
                      <input type="radio" checked readOnly className="accent-amber-600" />
                      <span className="text-sm text-gray-800">
                        <span className="font-semibold">Nieuwe BC36</span>
                        <span className="text-gray-500"> (FP-codes)</span>
                      </span>
                    </label>
                  </div>
                </div>

                <HighlightRing active={isHighlight('stock-upload-zone')} id="stock-upload-zone">
                  <div
                    className={`rounded-lg border-2 border-dashed p-6 text-center transition-all ${
                      simState.stockSelected ? 'border-green-400 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <Upload className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                    <p className="mb-1 font-medium">Stock Excel Bestanden</p>
                    {simState.stockSelected ? (
                      <ul className="mx-auto mt-3 max-w-xs list-inside list-disc text-left text-sm">
                        <li className="font-semibold text-green-700">Stock Wilrijk.xlsx</li>
                        <li className="font-semibold text-green-700">Stock Willebroek.xlsx</li>
                        <li className="font-semibold text-green-700">Stock Genk.xlsx</li>
                      </ul>
                    ) : (
                      <p className="mb-3 text-sm text-gray-500">
                        Sleep meerdere bestanden hierheen of
                        <br />
                        klik om meerdere bestanden te selecteren
                      </p>
                    )}
                    <span className="inline-block cursor-default rounded-lg bg-[#1a4b8c] px-4 py-2 text-white">
                      {simState.stockSelected ? 'Wijzig Bestanden' : 'Selecteer Bestanden'}
                    </span>
                    <p className="mt-2 text-xs text-gray-500">
                      Upload meerdere Excel bestanden (bijv. Stock Genk.xlsx, Stock Willebroek.xlsx, Stock Wilrijk.xlsx)
                    </p>
                  </div>
                </HighlightRing>

                {isHighlight('stock-upload-zone') && (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                    <strong>In Business Central:</strong> open voorraadrapport → filter op locatie (Wilrijk / Willebroek /
                    Genk) → exporteer als Excel → hernoem exact zoals hierboven.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <HighlightRing active={isHighlight('verwerken-btn')} id="verwerken-btn">
                  <button
                    type="button"
                    className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-all ${
                      simState.stockSelected
                        ? 'bg-[#1a4b8c] hover:bg-[#153d75]'
                        : 'cursor-not-allowed bg-[#1a4b8c] opacity-50'
                    }`}
                  >
                    <Database className="h-5 w-5" />
                    {simState.stockProcessed ? 'Verwerken ✓' : 'Verwerken'}
                  </button>
                </HighlightRing>
              </div>
            </div>
          )}
        </div>

        {simState.stockProcessed && (
          <div className="mb-6 rounded-lg border border-emerald-300/80 bg-emerald-50/90 p-4 shadow-sm">
            <p className="text-sm text-emerald-950">
              <strong>Data geladen</strong> — laatste refresh: {nowStr}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="overflow-hidden rounded-lg border border-slate-400/90 shadow-md">
          <nav
            className="flex gap-0.5 overflow-x-auto border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#153d75] px-1 pt-1"
            aria-label="Grote inpak"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`whitespace-nowrap rounded-t-md px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
                  activeTab === tab.id
                    ? 'bg-white text-[#1a4b8c] shadow-sm'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="bg-white p-5 sm:p-6">
            {/* PACKED TAB */}
            {activeTab === 3 && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">Packed Items</h2>
                      <p className="text-sm text-slate-500">Beheer packed bestanden en XML-export</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Concept imports uit mailbox</h3>
                      <p className="text-sm text-slate-500">
                        Uitgevinkt bij <strong>Gebruik</strong> komt niet in de XML.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-white"
                      >
                        <Mail className="h-4 w-4" /> Haal mails op
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="flex flex-col justify-between gap-2 bg-slate-50 px-4 py-3 md:flex-row md:items-center">
                      <div>
                        <div className="font-semibold text-slate-800">{MOCK_PACKED_BATCH.source_file}</div>
                        <div className="text-xs text-slate-500">
                          Type: {MOCK_PACKED_BATCH.source_type} · {MOCK_PACKED_BATCH.rows.length} regel(s) · geïmporteerd{' '}
                          {MOCK_PACKED_BATCH.imported_at}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white">
                          Opslaan
                        </button>
                        <HighlightRing active={isHighlight('packed-xml-btn')} id="packed-xml-btn">
                          <button
                            type="button"
                            className={`rounded-lg px-3 py-2 text-sm text-white ${
                              simState.xmlExported ? 'bg-emerald-700' : 'bg-emerald-600'
                            }`}
                          >
                            {simState.xmlExported ? 'XML gemaakt ✓' : 'XML genereren'}
                          </button>
                        </HighlightRing>
                      </div>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-700">Gebruik</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-700">Case Label</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-700">Serie</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-700">Case Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-700">Packed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {MOCK_PACKED_BATCH.rows.map((row) => (
                          <tr key={row.case_label} className={row.excluded ? 'bg-slate-50 opacity-60' : ''}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={!row.excluded} readOnly />
                            </td>
                            <td className="px-3 py-2">{row.case_label}</td>
                            <td className="px-3 py-2">{row.series}</td>
                            <td className="px-3 py-2">{row.case_type}</td>
                            <td className="px-3 py-2">{row.packed_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {simState.xmlExported && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      <Download className="h-4 w-4" /> 2 XML-bestand(en) gedownload (apf_s4_s5.xml, indus.xml)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FORECAST TAB */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">📈 Forecast</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700">
                      <Download className="h-4 w-4" /> Matrix Genk
                    </button>
                    <button type="button" className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700">
                      <Download className="h-4 w-4" /> Matrix Wilrijk
                    </button>
                    <HighlightRing active={isHighlight('bc-forecast-btn')} id="bc-forecast-btn">
                      <button
                        type="button"
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${
                          simState.bcExported ? 'bg-emerald-700' : 'bg-emerald-600'
                        }`}
                      >
                        <Download className="h-4 w-4" /> {simState.bcExported ? 'BC import gedownload ✓' : 'BC forecast import'}
                      </button>
                    </HighlightRing>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                    <span className="flex items-center gap-2 font-semibold text-gray-800">
                      <Upload className="h-5 w-5 text-blue-500" /> Forecast uploaden
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
                    <HighlightRing active={isHighlight('forecast-upload-btn')} id="forecast-upload-btn">
                      <div
                        className={`rounded-xl border-2 border-dashed p-6 text-center ${
                          simState.forecastSelected ? 'border-green-400 bg-green-50' : 'border-gray-300'
                        }`}
                      >
                        <Upload className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                        <p className="mb-1 font-medium">Forecast CSV</p>
                        {simState.forecastSelected ? (
                          <p className="mb-3 text-sm font-semibold text-green-700">2 bestand(en) geselecteerd</p>
                        ) : (
                          <p className="mb-3 text-sm text-gray-500">Sleep bestanden hierheen</p>
                        )}
                        <div className="flex justify-center gap-2">
                          <span className="cursor-default rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Selecteer bestanden</span>
                          {simState.forecastSelected && (
                            <span className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white">
                              {simState.forecastUploaded ? 'Upload ✓' : 'Upload'}
                            </span>
                          )}
                        </div>
                        {simState.forecastSelected && (
                          <p className="mt-2 text-xs text-green-700">FOR0625.csv, FORESCO0625.csv</p>
                        )}
                      </div>
                    </HighlightRing>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-5 py-4">
                    <span className="flex items-center gap-2 font-semibold text-gray-800">Huidige forecast</span>
                  </div>
                  <HighlightRing active={isHighlight('forecast-dates')} id="forecast-dates">
                    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
                      <input
                        type="date"
                        readOnly
                        value={simState.dateFrom || fmtToday(0)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                      <span className="text-sm text-gray-400">—</span>
                      <input
                        type="date"
                        readOnly
                        value={simState.dateTo || fmtToday(28)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-slate-500">← stel dit bereik in vóór BC forecast import</span>
                    </div>
                  </HighlightRing>
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="px-5 py-3 text-left">Status</th>
                        <th className="px-5 py-3 text-left">Case Label</th>
                        <th className="px-5 py-3 text-left">Case Type</th>
                        <th className="px-4 py-3 text-left">Aankomstdatum</th>
                        <th className="px-4 py-3 text-left">Bronbestand</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MOCK_FORECAST.map((row) => (
                        <tr key={row.case_label}>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                row.on_pils ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.on_pils ? 'Op PILS' : 'Forecast'}
                            </span>
                          </td>
                          <td className="px-5 py-3">{row.case_label}</td>
                          <td className="px-5 py-3">{row.case_type}</td>
                          <td className="px-4 py-3">{row.arrival}</td>
                          <td className="px-4 py-3 text-gray-500">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TRANSPORT TAB */}
            {activeTab === 1 && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold">🚚 Transport Planning — Genk → Willebroek</h2>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="mb-1 text-xs font-medium uppercase text-gray-500">Totaal Genk</p>
                    <p className="text-3xl font-bold text-gray-900">27</p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase text-green-700">Al in Willebroek</p>
                    <p className="text-3xl font-bold text-green-700">7</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase text-blue-700">Nog te transporteren</p>
                    <p className="text-3xl font-bold text-blue-700">20</p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase text-red-700">Te laat</p>
                    <p className="text-3xl font-bold text-red-700">3</p>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap gap-2">
                  <HighlightRing active={isHighlight('transport-excel-btn')} id="transport-excel-btn">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white ${
                        simState.transportGenerated ? 'bg-green-700' : 'bg-green-600'
                      }`}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {simState.transportGenerated ? 'Excel gedownload ✓' : 'Genereer Transport Planning Excel'}
                    </button>
                  </HighlightRing>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-5 py-3">
                    <h3 className="font-semibold text-gray-800">Nog te transporteren — per case type</h3>
                  </div>
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="px-5 py-3 text-left">Case Type</th>
                        <th className="px-5 py-3 text-left">ERP Code</th>
                        <th className="px-4 py-3 text-center">Totaal</th>
                        <th className="px-4 py-3 text-center">In WB</th>
                        <th className="px-4 py-3 text-center">Te sturen</th>
                        <th className="px-4 py-3 text-center">Te laat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MOCK_TRANSPORT_GROUPS.map((g) => (
                        <tr key={g.case_type}>
                          <td className="px-5 py-3 font-medium">{g.case_type}</td>
                          <td className="px-5 py-3 text-gray-600">{g.erp}</td>
                          <td className="px-4 py-3 text-center">{g.total}</td>
                          <td className="px-4 py-3 text-center">{g.inWb}</td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-700">{g.teSturen}</td>
                          <td className="px-4 py-3 text-center text-red-600">{g.teLaat || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Intro / andere tabs */}
            {activeTab === null && step.tab === 'upload' && (
              <div className="py-8 text-center text-gray-500">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                <p>Focus op het uploadblok hierboven.</p>
              </div>
            )}

            {activeTab === 3 && step.id === 'intro' && (
              <p className="text-center text-gray-500 py-4">De walkthrough start op tab Packed…</p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Demo met mockdata — geen echte uploads.{' '}
          <Link href="/grote-inpak" className="font-medium text-[#1a4b8c] underline">
            Open de live Grote Inpak-app
          </Link>
        </p>
      </div>
    </div>
  )
}

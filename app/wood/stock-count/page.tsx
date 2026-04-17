'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WoodStock } from '@/types/database'
import { useWoodOfflineSync } from '@/lib/offline/useWoodOfflineSync'
import { enqueueOutbox } from '@/lib/offline/woodOfflineDb'
import OfflineStatusBanner from '@/components/offline/OfflineStatusBanner'

async function fetchStockFromServer(): Promise<WoodStock[]> {
  const response = await fetch('/api/wood/stock', { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to fetch stock')
  return response.json()
}

type ScopeKind = 'alles' | 'niet_geteld_30d' | 'niet_geteld_7d' | 'houtsoort' | 'locatie'

interface CountEntry {
  value: string
  reden: string
  opmerking: string
  revealed: boolean // voor blinde telling: pas na invoer tonen we het verwachte aantal
  done: boolean
}

const REDENEN = [
  { value: '', label: '— kies reden —' },
  { value: 'vergeten_picking', label: 'Vergeten picking te registreren' },
  { value: 'telfout', label: 'Telfout (vorige telling)' },
  { value: 'breuk', label: 'Breuk / afgekeurd' },
  { value: 'misgeplaatst', label: 'Hout op verkeerde locatie' },
  { value: 'correctie_ontvangst', label: 'Correctie op ontvangst' },
  { value: 'andere', label: 'Andere (zie opmerking)' },
]

export default function WoodStockCountPage() {
  const {
    state,
    stock,
    loading,
    fullSync,
  } = useWoodOfflineSync({ fetchStock: fetchStockFromServer })

  const [scope, setScope] = useState<ScopeKind>('alles')
  const [scopeHoutsoort, setScopeHoutsoort] = useState('')
  const [scopeLocatie, setScopeLocatie] = useState('')
  const [blind, setBlind] = useState(true)
  const [entries, setEntries] = useState<Record<number, CountEntry>>({})
  const [search, setSearch] = useState('')

  const houtsoorten = useMemo(() => {
    const set = new Set<string>()
    stock.forEach((s) => s.houtsoort && set.add(s.houtsoort))
    return Array.from(set).sort()
  }, [stock])

  const locaties = useMemo(() => {
    const set = new Set<string>()
    stock.forEach((s) => s.locatie && set.add(s.locatie))
    return Array.from(set).sort()
  }, [stock])

  const nowMs = Date.now()

  const scopedStock = useMemo(() => {
    const daysAgo = (days: number) => nowMs - days * 24 * 60 * 60 * 1000
    return stock.filter((s) => {
      if (scope === 'houtsoort' && scopeHoutsoort && s.houtsoort !== scopeHoutsoort) return false
      if (scope === 'locatie' && scopeLocatie && s.locatie !== scopeLocatie) return false
      if (scope === 'niet_geteld_7d') {
        const ts = s.laatst_geteld_op ? new Date(s.laatst_geteld_op).getTime() : 0
        if (ts >= daysAgo(7)) return false
      }
      if (scope === 'niet_geteld_30d') {
        const ts = s.laatst_geteld_op ? new Date(s.laatst_geteld_op).getTime() : 0
        if (ts >= daysAgo(30)) return false
      }
      if (search.trim()) {
        const term = search.toLowerCase()
        const haystack = [
          s.houtsoort,
          s.pakketnummer,
          s.locatie,
          `${s.dikte}x${s.breedte}x${s.lengte}`,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [stock, scope, scopeHoutsoort, scopeLocatie, search, nowMs])

  const totals = useMemo(() => {
    const vals = Object.values(entries)
    const ingevuld = vals.filter((e) => e.value.trim() !== '').length
    const done = vals.filter((e) => e.done).length
    return { ingevuld, done, totaal: scopedStock.length }
  }, [entries, scopedStock.length])

  const setEntry = (id: number, patch: Partial<CountEntry>) => {
    setEntries((prev) => {
      const cur = prev[id] || { value: '', reden: '', opmerking: '', revealed: false, done: false }
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }

  const submitEntry = async (item: WoodStock) => {
    const entry = entries[item.id]
    if (!entry || entry.value.trim() === '') {
      alert('Vul eerst het getelde aantal in')
      return
    }
    const nieuw = Number(entry.value)
    if (!Number.isInteger(nieuw) || nieuw < 0) {
      alert('Aantal moet een geheel getal zijn (0 of hoger)')
      return
    }
    const verschil = nieuw - item.aantal
    if (verschil !== 0 && !entry.reden) {
      alert('Kies een reden voor dit verschil')
      return
    }

    await enqueueOutbox({
      kind: 'count',
      stock_id: item.id,
      nieuw_aantal: nieuw,
      oud_aantal: item.aantal,
      reden: entry.reden || null,
      opmerking: entry.opmerking || null,
      snapshot: {
        houtsoort: item.houtsoort,
        pakketnummer: item.pakketnummer ?? null,
        locatie: item.locatie,
        dikte: item.dikte,
        breedte: item.breedte,
        lengte: item.lengte,
      },
      client_created_at: new Date().toISOString(),
    })

    // Lokale cache bijwerken (aantal + laatst_geteld_op)
    // Doen we via een eigen patch — we roepen applyLocalCount niet aan want we willen
    // de verwijder-drempel niet automatisch toepassen zolang outbox nog moet syncen.
    setEntry(item.id, { done: true, revealed: true })

    // Zet in stock-cache ook
    // (we updaten gewoon het aantal voor directe UI; de echte laatst_geteld_op komt
    // uit de DB bij volgende refetch)
    void fullSync()
  }

  const confirmSame = async (item: WoodStock) => {
    // "Klopt" — zet de waarde gewoon gelijk aan het verwachte aantal
    setEntry(item.id, { value: String(item.aantal), revealed: true })
    await enqueueOutbox({
      kind: 'count',
      stock_id: item.id,
      nieuw_aantal: item.aantal,
      oud_aantal: item.aantal,
      reden: null,
      opmerking: null,
      snapshot: {
        houtsoort: item.houtsoort,
        pakketnummer: item.pakketnummer ?? null,
        locatie: item.locatie,
        dikte: item.dikte,
        breedte: item.breedte,
        lengte: item.lengte,
      },
      client_created_at: new Date().toISOString(),
    })
    setEntry(item.id, { done: true })
    void fullSync()
  }

  if (loading && stock.length === 0) {
    return <div className="container mx-auto px-4 py-6 text-center">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Count (telronde)</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Tel periodiek een stapel na en corrigeer verschillen. Werkt ook zonder internet — alles wordt lokaal
              bewaard en automatisch gesynchroniseerd zodra je terug verbinding hebt. Gebruik een tablet buiten.
            </p>
          </div>
          <Link
            href="/wood/picking"
            className="shrink-0 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium"
          >
            → Wood Picking
          </Link>
        </div>
      </div>

      <OfflineStatusBanner
        online={state.online}
        pending={state.pending}
        syncing={state.syncing}
        lastSync={state.lastSync}
        errors={state.errors}
        onManualSync={fullSync}
      />

      {/* Scope & instellingen */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telronde</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeKind)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
            >
              <option value="alles">Volledige voorraad</option>
              <option value="niet_geteld_30d">Niet geteld in laatste 30 dagen</option>
              <option value="niet_geteld_7d">Niet geteld in laatste 7 dagen</option>
              <option value="houtsoort">Per houtsoort</option>
              <option value="locatie">Per locatie</option>
            </select>
          </div>
          {scope === 'houtsoort' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Houtsoort</label>
              <select
                value={scopeHoutsoort}
                onChange={(e) => setScopeHoutsoort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              >
                <option value="">Alle</option>
                {houtsoorten.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          )}
          {scope === 'locatie' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
              <select
                value={scopeLocatie}
                onChange={(e) => setScopeLocatie(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              >
                <option value="">Alle</option>
                {locaties.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modus</label>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={blind}
                  onChange={() => setBlind(true)}
                />
                Blind tellen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!blind}
                  onChange={() => setBlind(false)}
                />
                Open (verwacht zichtbaar)
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter binnen selectie (houtsoort, locatie, pakketnummer)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-500"
          />
          <div className="flex items-center justify-end text-sm text-gray-600 gap-4">
            <span>Voortgang: {totals.done}/{totals.totaal} geteld</span>
          </div>
        </div>
      </div>

      {/* Telkaarten */}
      <div className="space-y-3">
        {scopedStock.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            Geen posities in deze selectie.
          </div>
        )}
        {scopedStock.map((item) => {
          const entry = entries[item.id] || { value: '', reden: '', opmerking: '', revealed: false, done: false }
          const showExpected = !blind || entry.revealed || entry.done
          const parsed = entry.value.trim() === '' ? null : Number(entry.value)
          const verschil = parsed !== null ? parsed - item.aantal : null
          const oud = item.laatst_geteld_op
            ? new Date(item.laatst_geteld_op).toLocaleDateString()
            : 'nog nooit'

          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                entry.done
                  ? verschil === 0
                    ? 'border-green-500'
                    : 'border-amber-500'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900">
                    {item.houtsoort} · {item.dikte}×{item.breedte}×{item.lengte} mm
                  </div>
                  <div className="text-sm text-gray-600">
                    Locatie <span className="font-medium">{item.locatie}</span>
                    {item.pakketnummer && (
                      <>
                        {' '}
                        · pakket <span className="font-mono">{item.pakketnummer}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Laatst geteld: {oud}
                  </div>
                </div>
                <div className="text-right">
                  {showExpected ? (
                    <div className="text-sm text-gray-600">
                      Verwacht:{' '}
                      <span className="font-bold text-gray-900">{item.aantal}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">Verwacht verborgen</div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Geteld aantal *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    value={entry.value}
                    onChange={(e) => setEntry(item.id, { value: e.target.value })}
                    disabled={entry.done}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-lg font-mono disabled:bg-gray-50"
                  />
                </div>
                {verschil !== null && verschil !== 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reden *</label>
                    <select
                      value={entry.reden}
                      onChange={(e) => setEntry(item.id, { reden: e.target.value })}
                      disabled={entry.done}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black disabled:bg-gray-50"
                    >
                      {REDENEN.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {verschil !== null && verschil !== 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Opmerking</label>
                    <input
                      type="text"
                      value={entry.opmerking}
                      onChange={(e) => setEntry(item.id, { opmerking: e.target.value })}
                      disabled={entry.done}
                      placeholder="Optioneel..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-400 disabled:bg-gray-50"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  {verschil !== null && (
                    <span
                      className={
                        verschil === 0
                          ? 'text-green-700 font-medium'
                          : verschil > 0
                          ? 'text-blue-700 font-medium'
                          : 'text-red-700 font-medium'
                      }
                    >
                      Verschil: {verschil > 0 ? `+${verschil}` : verschil}
                    </span>
                  )}
                  {entry.done && (
                    <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      gelogd
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!entry.done && (
                    <button
                      type="button"
                      onClick={() => confirmSame(item)}
                      className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      Klopt ({item.aantal})
                    </button>
                  )}
                  {!entry.done && (
                    <button
                      type="button"
                      onClick={() => submitEntry(item)}
                      className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                    >
                      Tel vast
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

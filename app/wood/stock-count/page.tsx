'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WoodStock } from '@/types/database'
import { useWoodOfflineSync } from '@/lib/offline/useWoodOfflineSync'
import { enqueueOutbox } from '@/lib/offline/woodOfflineDb'
import OfflineStatusBanner from '@/components/offline/OfflineStatusBanner'

async function fetchStockFromServer(): Promise<WoodStock[]> {
  const response = await fetch('/api/wood/stock', { cache: 'no-store', credentials: 'include' })
  if (!response.ok) throw new Error('Failed to fetch stock')
  return response.json()
}

type ScopeKind = 'alles' | 'niet_geteld_30d' | 'niet_geteld_7d' | 'houtsoort' | 'locatie'
type SortKey = 'locatie' | 'houtsoort' | 'pakketnummer' | 'laatst_geteld'
type SortDir = 'asc' | 'desc'

interface CountEntry {
  value: string
  reden: string
  opmerking: string
  revealed: boolean
  done: boolean
}

interface EditDraft {
  houtsoort: string
  pakketnummer: string
  dikte: string
  breedte: string
  lengte: string
  locatie: string
  aantal: string
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

function naturalCompare(a: string, b: string): number {
  // "A1", "A2", "A10" natuurlijk sorteren
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function draftFromItem(item: WoodStock): EditDraft {
  return {
    houtsoort: item.houtsoort ?? '',
    pakketnummer: item.pakketnummer ?? '',
    dikte: String(item.dikte ?? ''),
    breedte: String(item.breedte ?? ''),
    lengte: String(item.lengte ?? ''),
    locatie: item.locatie ?? '',
    aantal: String(item.aantal ?? ''),
  }
}

function parseNum(value: string): number | null {
  if (value === null || value === undefined) return null
  const v = String(value).replace(',', '.').trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function WoodStockCountPage() {
  const {
    state,
    stock,
    loading,
    fullSync,
    retryAuthErrors,
    applyLocalEdit,
  } = useWoodOfflineSync({ fetchStock: fetchStockFromServer })

  const [scope, setScope] = useState<ScopeKind>('alles')
  const [scopeHoutsoort, setScopeHoutsoort] = useState('')
  const [scopeLocatie, setScopeLocatie] = useState('')
  const [blind, setBlind] = useState(true)
  const [entries, setEntries] = useState<Record<number, CountEntry>>({})
  const [search, setSearch] = useState('')

  const [sortKey, setSortKey] = useState<SortKey>('locatie')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Bewerkingen per item. Enkel gesetd wanneer de gebruiker op "Bewerk" klikt.
  const [drafts, setDrafts] = useState<Record<number, EditDraft>>({})
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())

  const houtsoorten = useMemo(() => {
    const set = new Set<string>()
    stock.forEach((s) => s.houtsoort && set.add(s.houtsoort))
    return Array.from(set).sort()
  }, [stock])

  const locaties = useMemo(() => {
    const set = new Set<string>()
    stock.forEach((s) => s.locatie && set.add(s.locatie))
    return Array.from(set).sort(naturalCompare)
  }, [stock])

  const nowMs = Date.now()

  const scopedStock = useMemo(() => {
    const daysAgo = (days: number) => nowMs - days * 24 * 60 * 60 * 1000
    const filtered = stock.filter((s) => {
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

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'locatie':
          cmp = naturalCompare(a.locatie ?? '', b.locatie ?? '')
          if (cmp === 0) cmp = naturalCompare(a.houtsoort ?? '', b.houtsoort ?? '')
          break
        case 'houtsoort':
          cmp = naturalCompare(a.houtsoort ?? '', b.houtsoort ?? '')
          if (cmp === 0) cmp = naturalCompare(a.locatie ?? '', b.locatie ?? '')
          break
        case 'pakketnummer':
          cmp = naturalCompare(a.pakketnummer ?? '', b.pakketnummer ?? '')
          break
        case 'laatst_geteld': {
          const av = a.laatst_geteld_op ? new Date(a.laatst_geteld_op).getTime() : 0
          const bv = b.laatst_geteld_op ? new Date(b.laatst_geteld_op).getTime() : 0
          cmp = av - bv
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [stock, scope, scopeHoutsoort, scopeLocatie, search, nowMs, sortKey, sortDir])

  const totals = useMemo(() => {
    const vals = Object.values(entries)
    const done = vals.filter((e) => e.done).length
    return { done, totaal: scopedStock.length }
  }, [entries, scopedStock.length])

  const setEntry = (id: number, patch: Partial<CountEntry>) => {
    setEntries((prev) => {
      const cur = prev[id] || { value: '', reden: '', opmerking: '', revealed: false, done: false }
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }

  const startEdit = (item: WoodStock) => {
    setDrafts((prev) => ({ ...prev, [item.id]: draftFromItem(item) }))
  }

  const cancelEdit = (id: number) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const setDraft = (id: number, patch: Partial<EditDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] as EditDraft), ...patch } }))
  }

  const submitEdit = async (item: WoodStock) => {
    const draft = drafts[item.id]
    if (!draft) return

    const dikte = parseNum(draft.dikte)
    const breedte = parseNum(draft.breedte)
    const lengte = parseNum(draft.lengte)
    const aantal = parseNum(draft.aantal)

    if (!draft.houtsoort.trim()) return alert('Houtsoort is verplicht')
    if (!draft.locatie.trim()) return alert('Locatie is verplicht')
    if (dikte === null || dikte <= 0) return alert('Dikte moet > 0 zijn')
    if (breedte === null || breedte <= 0) return alert('Breedte moet > 0 zijn')
    if (lengte === null || lengte <= 0) return alert('Lengte moet > 0 zijn')
    if (aantal === null || !Number.isInteger(aantal) || aantal < 0) {
      return alert('Aantal moet een geheel getal ≥ 0 zijn')
    }

    const patch: Record<string, unknown> = {}
    if (draft.houtsoort.trim() !== (item.houtsoort ?? '')) patch.houtsoort = draft.houtsoort.trim().toUpperCase()
    if ((draft.pakketnummer.trim() || null) !== (item.pakketnummer ?? null))
      patch.pakketnummer = draft.pakketnummer.trim() || null
    if (dikte !== item.dikte) patch.dikte = dikte
    if (breedte !== item.breedte) patch.breedte = breedte
    if (lengte !== item.lengte) patch.lengte = lengte
    if (draft.locatie.trim() !== (item.locatie ?? '')) patch.locatie = draft.locatie.trim()
    if (aantal !== item.aantal) patch.aantal = aantal

    if (Object.keys(patch).length === 0) {
      cancelEdit(item.id)
      return
    }

    setSavingIds((prev) => new Set(prev).add(item.id))
    try {
      await enqueueOutbox({
        kind: 'edit',
        stock_id: item.id,
        patch: patch as any,
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
      await applyLocalEdit(item.id, patch as Partial<WoodStock>)
      cancelEdit(item.id)
      void fullSync()
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
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

    setEntry(item.id, { done: true, revealed: true })
    void fullSync()
  }

  const confirmSame = async (item: WoodStock) => {
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
              Tel periodiek een stapel na en corrigeer verschillen. Je kan hier ook rechtstreeks locatie,
              pakketnummer, afmetingen of houtsoort aanpassen — werkt ook zonder internet en synchroniseert
              automatisch zodra je terug verbinding hebt.
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
        onRetryAuthErrors={retryAuthErrors}
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
                <input type="radio" checked={blind} onChange={() => setBlind(true)} />
                Blind tellen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!blind} onChange={() => setBlind(false)} />
                Open (verwacht zichtbaar)
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter binnen selectie (houtsoort, locatie, pakketnummer)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sorteer op</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
            >
              <option value="locatie">Locatie (A → Z)</option>
              <option value="houtsoort">Houtsoort</option>
              <option value="pakketnummer">Pakketnummer</option>
              <option value="laatst_geteld">Laatst geteld</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Richting</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortDir('asc')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                  sortDir === 'asc'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ↑ Oplopend
              </button>
              <button
                type="button"
                onClick={() => setSortDir('desc')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                  sortDir === 'desc'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ↓ Aflopend
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Voortgang: <span className="font-medium text-gray-800">{totals.done}</span> / {totals.totaal} geteld
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
          const isEditing = !!drafts[item.id]
          const saving = savingIds.has(item.id)

          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                isEditing
                  ? 'border-blue-500'
                  : entry.done
                  ? verschil === 0
                    ? 'border-green-500'
                    : 'border-amber-500'
                  : 'border-gray-200'
              }`}
            >
              {/* Header / leesmodus */}
              {!isEditing && (
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
                    <div className="text-xs text-gray-500 mt-0.5">Laatst geteld: {oud}</div>
                  </div>
                  <div className="text-right">
                    {showExpected ? (
                      <div className="text-sm text-gray-600">
                        Verwacht: <span className="font-bold text-gray-900">{item.aantal}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">Verwacht verborgen</div>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="mt-1 text-xs text-blue-700 hover:text-blue-900 underline"
                    >
                      Bewerk gegevens
                    </button>
                  </div>
                </div>
              )}

              {/* Edit modus: alle velden bewerkbaar */}
              {isEditing && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Houtsoort *</label>
                    <input
                      list={`houtsoorten-${item.id}`}
                      value={drafts[item.id].houtsoort}
                      onChange={(e) => setDraft(item.id, { houtsoort: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm"
                    />
                    <datalist id={`houtsoorten-${item.id}`}>
                      {houtsoorten.map((h) => (
                        <option key={h} value={h} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pakketnummer</label>
                    <input
                      value={drafts[item.id].pakketnummer}
                      onChange={(e) => setDraft(item.id, { pakketnummer: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Locatie *</label>
                    <input
                      list={`locaties-${item.id}`}
                      value={drafts[item.id].locatie}
                      onChange={(e) => setDraft(item.id, { locatie: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm"
                    />
                    <datalist id={`locaties-${item.id}`}>
                      {locaties.map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Aantal</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={drafts[item.id].aantal}
                      onChange={(e) => setDraft(item.id, { aantal: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dikte (mm) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={drafts[item.id].dikte}
                      onChange={(e) => setDraft(item.id, { dikte: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Breedte (mm) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={drafts[item.id].breedte}
                      onChange={(e) => setDraft(item.id, { breedte: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lengte (mm) *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={drafts[item.id].lengte}
                      onChange={(e) => setDraft(item.id, { lengte: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-black text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => submitEdit(item)}
                      disabled={saving}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? '...' : 'Opslaan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelEdit(item.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              )}

              {/* Tel-sectie — enkel tonen wanneer niet in edit-modus */}
              {!isEditing && (
                <>
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
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

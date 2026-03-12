'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Calculator, ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PieceRow {
  id: string
  name: string
  w: number    // breedte mm
  l: number    // lengte mm
  qty: number
}

interface SheetDims {
  w: number    // breedte mm (bijv. 1220)
  l: number    // lengte mm  (bijv. 2440)
  kerf: number // zaagbreedte mm
}

interface PlacedPiece {
  pieceId: string
  name: string
  w: number
  l: number
  x: number    // mm langs lengte-as
  y: number    // mm langs breedte-as (strip offset)
}

interface Strip {
  w: number
  yOffset: number
  pieces: PlacedPiece[]
  usedL: number
}

interface ResultSheet {
  id: number
  strips: Strip[]
  efficiency: number
  totalPieces: number
  wasteM2: number
  usedW: number
}

// ── Kleurpalet ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a',
  '#ff9800', '#795548', '#607d8b', '#673ab7', '#009688',
  '#ff5722', '#cddc39', '#03a9f4', '#f06292', '#aed581',
]

function pieceColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// ── Optimizer algoritme ───────────────────────────────────────────────────────

function runOptimizer(pieces: PieceRow[], sheet: SheetDims, allowRotation: boolean): ResultSheet[] {
  const { w: SW, l: SL, kerf } = sheet

  type FlatPiece = { pieceId: string; name: string; w: number; l: number }
  const flat: FlatPiece[] = []

  pieces.forEach(p => {
    if (!p.w || !p.l || !p.qty || p.w <= 0 || p.l <= 0 || p.qty <= 0) return
    for (let i = 0; i < p.qty; i++) {
      let w = p.w, l = p.l
      // Roteer als piece niet past maar geroteerd wel
      if (allowRotation && w > SW && l <= SW) { [w, l] = [l, w] }
      if (w > SW || l > SL) return // oversized — overslaan
      flat.push({ pieceId: p.id, name: p.name || `${w}×${l}`, w, l })
    }
  })

  if (flat.length === 0) return []

  // Groepeer op breedte
  const byWidth = new Map<number, FlatPiece[]>()
  flat.forEach(p => {
    if (!byWidth.has(p.w)) byWidth.set(p.w, [])
    byWidth.get(p.w)!.push(p)
  })

  // Bouw strips per breedte
  type StripTpl = { w: number; pieces: FlatPiece[]; totalL: number }
  const allStrips: StripTpl[] = []

  byWidth.forEach((fps, w) => {
    // Sorteer op lengte descending voor best-fit
    fps.sort((a, b) => b.l - a.l)

    let strip: StripTpl = { w, pieces: [], totalL: 0 }

    fps.forEach(fp => {
      const gap = strip.pieces.length > 0 ? kerf : 0
      if (strip.totalL + gap + fp.l <= SL) {
        strip.pieces.push(fp)
        strip.totalL += gap + fp.l
      } else {
        if (strip.pieces.length > 0) allStrips.push({ ...strip, pieces: [...strip.pieces] })
        strip = { w, pieces: [fp], totalL: fp.l }
      }
    })
    if (strip.pieces.length > 0) allStrips.push({ ...strip, pieces: [...strip.pieces] })
  })

  // Sorteer strips: grootste breedte eerst, dan meeste stuks
  allStrips.sort((a, b) => b.w !== a.w ? b.w - a.w : b.pieces.length - a.pieces.length)

  // Pak strips op platen (greedy bin packing)
  const resultSheets: ResultSheet[] = []
  let remaining = [...allStrips]
  let safety = 0

  while (remaining.length > 0 && safety < 500) {
    safety++
    let usedW = 0
    const sheetStrips: Strip[] = []
    const notFit: StripTpl[] = []

    for (const st of remaining) {
      const gap = usedW > 0 ? kerf : 0
      if (usedW + gap + st.w <= SW) {
        const yOffset = usedW + gap
        let x = 0
        const placed: PlacedPiece[] = st.pieces.map(fp => {
          const pp: PlacedPiece = { ...fp, x, y: yOffset }
          x += fp.l + kerf
          return pp
        })
        sheetStrips.push({ w: st.w, yOffset, pieces: placed, usedL: x > 0 ? x - kerf : 0 })
        usedW = yOffset + st.w
      } else {
        notFit.push(st)
      }
    }

    if (sheetStrips.length === 0) break

    let totalPieces = 0, usedArea = 0
    sheetStrips.forEach(s => s.pieces.forEach(p => { usedArea += p.w * p.l; totalPieces++ }))
    const sheetArea = SW * SL

    resultSheets.push({
      id: resultSheets.length + 1,
      strips: sheetStrips,
      efficiency: Math.round((usedArea / sheetArea) * 1000) / 10,
      totalPieces,
      wasteM2: Math.round(((sheetArea - usedArea) / 1e6) * 100) / 100,
      usedW,
    })

    remaining = notFit
  }

  return resultSheets
}

// ── Sheet Visual component ────────────────────────────────────────────────────

const VISUAL_MAX_PX = 720

function SheetVisual({
  sheet, dims, expanded, onToggle,
}: {
  sheet: ResultSheet
  dims: SheetDims
  expanded: boolean
  onToggle: () => void
}) {
  const scale = Math.min(VISUAL_MAX_PX / dims.l, 380 / dims.w)
  const vw = Math.round(dims.l * scale)
  const vh = Math.round(dims.w * scale)

  const effCls = sheet.efficiency >= 85
    ? 'bg-green-900/60 text-green-400'
    : sheet.efficiency >= 70 ? 'bg-yellow-900/60 text-yellow-400'
    : 'bg-red-900/60 text-red-400'

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header — altijd zichtbaar */}
      <button
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-750 transition"
        onClick={onToggle}
      >
        <span className="font-semibold text-white">Plaat {sheet.id}</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{sheet.totalPieces} stukken · {sheet.wasteM2} m² afval</span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${effCls}`}>
            {sheet.efficiency}% benut
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Uitklapbare inhoud */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Afmetingen label */}
          <p className="text-center text-xs text-gray-500">← {dims.l} mm →</p>

          {/* Visueel */}
          <div className="overflow-x-auto">
            <div
              className="relative mx-auto select-none"
              style={{
                width: vw,
                height: vh,
                background: '#f5e6c8',
                border: '2px solid #555',
                flexShrink: 0,
              }}
            >
              {sheet.strips.map((strip, si) =>
                strip.pieces.map((p, pi) => {
                  const px = Math.round(p.x * scale)
                  const py = Math.round(p.y * scale)
                  const pw = Math.round(p.l * scale)
                  const ph = Math.round(p.w * scale)
                  const color = pieceColor(p.pieceId)
                  const showLabel = pw > 36 && ph > 13

                  return (
                    <div
                      key={`${si}-${pi}`}
                      className="absolute flex items-center justify-center text-center overflow-hidden"
                      style={{
                        left: px, top: py, width: pw, height: ph,
                        background: color,
                        border: '1px solid rgba(0,0,0,0.25)',
                        fontSize: 8, fontWeight: 600, color: '#111',
                        lineHeight: 1.1,
                      }}
                      title={`${p.name} — ${p.w}×${p.l} mm`}
                    >
                      {showLabel && <span>{p.w}×{p.l}</span>}
                    </div>
                  )
                })
              )}

              {/* Afval-overlay */}
              {(() => {
                if (sheet.usedW < dims.w) {
                  const topPx = Math.round(sheet.usedW * scale)
                  const hPx = Math.round((dims.w - sheet.usedW) * scale)
                  return (
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: topPx, height: hPx,
                        background: 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,0,0,0.1) 4px,rgba(255,0,0,0.1) 8px)',
                      }}
                    />
                  )
                }
                return null
              })()}
            </div>
          </div>

          {/* Snijlijst tabel */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="text-red-400 border-b border-gray-700">
                    <th className="text-left py-1.5 px-3">Strip</th>
                    <th className="text-left py-1.5 px-3">Breedte</th>
                    <th className="text-left py-1.5 px-3">Positie</th>
                    <th className="text-left py-1.5 px-3">Stukken</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  {sheet.strips.map((s, i) => {
                    const counts: Record<string, number> = {}
                    s.pieces.forEach(p => {
                      const k = p.name || `${p.w}×${p.l}`
                      counts[k] = (counts[k] || 0) + 1
                    })
                    return (
                      <tr key={i} className="border-t border-gray-800">
                        <td className="py-1 px-3">{i + 1}</td>
                        <td className="py-1 px-3">{s.w} mm</td>
                        <td className="py-1 px-3">{s.yOffset} mm</td>
                        <td className="py-1 px-3">
                          {Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(', ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Standaard voorbeeldstukken ────────────────────────────────────────────────

const DEFAULT_PIECES: PieceRow[] = [
  { id: 'p1', name: 'Zijwand',    w: 200, l: 1090, qty: 8  },
  { id: 'p2', name: 'Plank 100',  w: 100, l: 600,  qty: 20 },
  { id: 'p3', name: 'Plank 85',   w: 85,  l: 600,  qty: 12 },
  { id: 'p4', name: 'Plank 70',   w: 70,  l: 600,  qty: 8  },
  { id: 'p5', name: 'Strip kort', w: 100, l: 320,  qty: 40 },
]

// ── Hoofdpagina ───────────────────────────────────────────────────────────────

export default function ZaagplanPage() {
  const [dims, setDims]               = useState<SheetDims>({ w: 1220, l: 2440, kerf: 5 })
  const [pieces, setPieces]           = useState<PieceRow[]>(DEFAULT_PIECES)
  const [results, setResults]         = useState<ResultSheet[] | null>(null)
  const [allowRotation, setAllowRotation] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1]))
  const [nextId, setNextId]           = useState(100)
  const [calculated, setCalculated]   = useState(false)

  const addPiece = () => {
    setPieces(prev => [...prev, { id: String(nextId), name: '', w: 100, l: 200, qty: 1 }])
    setNextId(n => n + 1)
    setCalculated(false)
  }

  const removePiece = (id: string) => {
    setPieces(prev => prev.filter(p => p.id !== id))
    setCalculated(false)
  }

  const updatePiece = (id: string, field: keyof PieceRow, val: string | number) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
    setCalculated(false)
  }

  const duplicatePiece = (id: string) => {
    const src = pieces.find(p => p.id === id)
    if (!src) return
    setPieces(prev => [...prev, { ...src, id: String(nextId), name: src.name + ' (kopie)' }])
    setNextId(n => n + 1)
    setCalculated(false)
  }

  const calculate = () => {
    const res = runOptimizer(pieces, dims, allowRotation)
    setResults(res)
    setCalculated(true)
    setExpandedIds(new Set(res.slice(0, 2).map(s => s.id)))
  }

  const resetAll = () => {
    setPieces(DEFAULT_PIECES)
    setResults(null)
    setCalculated(false)
    setDims({ w: 1220, l: 2440, kerf: 5 })
  }

  const toggleSheet = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalQty     = pieces.reduce((s, p) => s + (Number(p.qty) || 0), 0)
  const totalPlaten  = results?.length ?? 0
  const avgEff       = results && results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.efficiency, 0) / results.length * 10) / 10
    : null
  const totalWaste   = results?.reduce((s, r) => s + r.wasteM2, 0) ?? null
  const totalPieces  = results?.reduce((s, r) => s + r.totalPieces, 0) ?? 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>Zaagplan Optimizer</span>
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Guillotine-methode · optimale plaatindeling berekenen
            </p>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">

          {/* ══ LINKS: configuratie ══ */}
          <div className="space-y-5">

            {/* Plaatmaten */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <h2 className="font-semibold text-white mb-4">Plaatmaten</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Breedte (mm)</span>
                  <input
                    type="number" min={1} value={dims.w}
                    onChange={e => { setDims(d => ({ ...d, w: Number(e.target.value) })); setCalculated(false) }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Lengte (mm)</span>
                  <input
                    type="number" min={1} value={dims.l}
                    onChange={e => { setDims(d => ({ ...d, l: Number(e.target.value) })); setCalculated(false) }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>
                <label className="col-span-2 space-y-1">
                  <span className="text-xs text-gray-400">Zaagbreedte / kerf (mm)</span>
                  <input
                    type="number" min={0} value={dims.kerf}
                    onChange={e => { setDims(d => ({ ...d, kerf: Number(e.target.value) })); setCalculated(false) }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox" checked={allowRotation}
                  onChange={e => { setAllowRotation(e.target.checked); setCalculated(false) }}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-gray-300">Stukken mogen 90° gedraaid worden</span>
              </label>
            </div>

            {/* Stukkenlijst */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">
                  Stukken
                  <span className="ml-2 text-sm font-normal text-gray-400">({totalQty}×)</span>
                </h2>
                <button
                  onClick={addPiece}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Toevoegen
                </button>
              </div>

              {/* Kolomkoppen */}
              <div className="grid grid-cols-[16px_1fr_52px_10px_52px_10px_42px_36px] gap-1.5 items-center mb-1.5 px-0.5">
                <div />
                <span className="text-xs text-gray-500">Naam</span>
                <span className="text-xs text-gray-500 text-center">B (mm)</span>
                <div />
                <span className="text-xs text-gray-500 text-center">L (mm)</span>
                <div />
                <span className="text-xs text-gray-500 text-center">Aantal</span>
                <div />
              </div>

              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
                {pieces.map(p => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[16px_1fr_52px_10px_52px_10px_42px_36px] gap-1.5 items-center"
                  >
                    {/* Kleur-dot */}
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: pieceColor(p.id) }} />

                    {/* Naam */}
                    <input
                      value={p.name}
                      onChange={e => updatePiece(p.id, 'name', e.target.value)}
                      placeholder="Naam"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                    />

                    {/* Breedte */}
                    <input
                      type="number" min={1} value={p.w}
                      onChange={e => updatePiece(p.id, 'w', Number(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                    <span className="text-gray-500 text-xs text-center">×</span>

                    {/* Lengte */}
                    <input
                      type="number" min={1} value={p.l}
                      onChange={e => updatePiece(p.id, 'l', Number(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                    <span className="text-gray-500 text-xs text-center">×</span>

                    {/* Aantal */}
                    <input
                      type="number" min={1} value={p.qty}
                      onChange={e => updatePiece(p.id, 'qty', Number(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />

                    {/* Acties */}
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => duplicatePiece(p.id)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition"
                        title="Dupliceren"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removePiece(p.id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition"
                        title="Verwijderen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {pieces.length === 0 && (
                <p className="text-center text-gray-600 text-sm py-6">
                  Geen stukken — klik op &ldquo;Toevoegen&rdquo;
                </p>
              )}
            </div>

            {/* Bereken-knop */}
            <button
              onClick={calculate}
              disabled={pieces.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
            >
              <Calculator className="w-5 h-5" />
              Bereken zaagplan
            </button>

            {calculated && !results?.length && (
              <p className="text-center text-red-400 text-sm">
                Geen stukken passen op de platen. Controleer de afmetingen.
              </p>
            )}
          </div>

          {/* ══ RECHTS: resultaat ══ */}
          <div className="space-y-5">
            {results === null ? (
              <div className="flex flex-col items-center justify-center h-80 bg-gray-800 border border-gray-700 rounded-xl text-gray-500">
                <Calculator className="w-14 h-14 mb-4 opacity-30" />
                <p className="font-medium">Vul je stukken in en klik op</p>
                <p className="font-semibold text-gray-400 mt-1">&ldquo;Bereken zaagplan&rdquo;</p>
              </div>
            ) : results.length > 0 ? (
              <>
                {/* KPI-kaarten */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { v: totalPlaten,                         l: 'Platen nodig'   },
                    { v: totalPieces,                         l: 'Stukken totaal' },
                    { v: avgEff != null ? `${avgEff}%` : '—', l: 'Gem. benutting' },
                    { v: totalWaste != null ? `${totalWaste.toFixed(2)} m²` : '—', l: 'Afval totaal' },
                  ].map(({ v, l }) => (
                    <div key={l} className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">{v}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{l}</div>
                    </div>
                  ))}
                </div>

                {/* Plaatkaarten */}
                <div className="space-y-3">
                  {results.map(sheet => (
                    <SheetVisual
                      key={sheet.id}
                      sheet={sheet}
                      dims={dims}
                      expanded={expandedIds.has(sheet.id)}
                      onToggle={() => toggleSheet(sheet.id)}
                    />
                  ))}
                </div>

                {/* Legenda */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Legenda</h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {pieces.filter(p => p.w > 0 && p.l > 0).map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs text-gray-300">
                        <div
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                          style={{ background: pieceColor(p.id), border: '1px solid rgba(0,0,0,0.3)' }}
                        />
                        <span>
                          <span className="font-medium">{p.name || `${p.w}×${p.l}`}</span>
                          {' '}<span className="text-gray-500">{p.w}×{p.l} mm · {p.qty}×</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}

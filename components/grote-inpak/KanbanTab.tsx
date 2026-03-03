'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Download, RefreshCw, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, Package, ShoppingCart, LayoutGrid } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────
interface KanbanConfig {
  id: number
  case_type: string
  rek_sectie: string | null
  rek_niveau: number | null
  rek_kolom: number | null
  productielocatie: string | null
  stapel: number
  posities: number
  stapels_per_pos: number
  verbruik_per_dag: number | null
  prioriteit: string | null
  notitie: string | null
}

interface BestelRij extends KanbanConfig {
  max_voorraad: number
  bestelpunt: number
  stock_genk: number
  stock_willebroek: number
  stock_wilrijk: number
  stock_totaal: number
  stock_in_rek: number
  tekort: number
  bestel_aantal: number
  status: 'Leeg' | 'Bestellen' | 'Laag' | 'Vol'
}

const PRIORITEIT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'critical': { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Kritiek' },
  'high':     { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Hoog' },
  'medium':   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
  'low':      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Laag' },
  'very-low': { bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Zeer laag' },
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  'Leeg':      { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
  'Bestellen': { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  'Laag':      { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  'Vol':       { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
}

const EMPTY_FORM: Partial<KanbanConfig> = {
  case_type: '', rek_sectie: 'Links', rek_niveau: 1, rek_kolom: 1,
  productielocatie: 'Wilrijk', stapel: 1, posities: 1, stapels_per_pos: 2,
  verbruik_per_dag: null, prioriteit: 'low', notitie: '',
}

interface KanbanTabProps {
  stockUploadTrigger?: number
}

export default function KanbanTab({ stockUploadTrigger = 0 }: KanbanTabProps) {
  const [activeView, setActiveView] = useState<'besteladvies' | 'rekindeling'>('besteladvies')

  // Besteladvies state
  const [bestelData, setBestelData] = useState<BestelRij[]>([])
  const [bestelLoading, setBestelLoading] = useState(false)
  const [bestelError, setBestelError] = useState<string | null>(null)
  const [alleenBestellen, setAlleenBestellen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [zoekterm, setZoekterm] = useState('')

  // Rekindeling (config) state
  const [config, setConfig] = useState<KanbanConfig[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<KanbanConfig>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadBesteladvies = useCallback(async () => {
    setBestelLoading(true)
    setBestelError(null)
    try {
      const res = await fetch('/api/grote-inpak/kanban-besteladvies')
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const result = await res.json()
      setBestelData(result.data || [])
    } catch (e: any) {
      setBestelError(e.message)
    } finally {
      setBestelLoading(false)
    }
  }, [])

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await fetch('/api/grote-inpak/kanban-config')
      if (!res.ok) return
      const result = await res.json()
      setConfig(result.data || [])
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => { loadBesteladvies() }, [loadBesteladvies])
  useEffect(() => { loadBesteladvies() }, [loadBesteladvies, stockUploadTrigger])
  useEffect(() => { if (activeView === 'rekindeling') loadConfig() }, [activeView, loadConfig])

  const filteredBestel = useMemo(() => {
    let rows = bestelData
    if (alleenBestellen) rows = rows.filter(r => r.bestel_aantal > 0)
    if (zoekterm) {
      const q = zoekterm.toLowerCase()
      rows = rows.filter(r => r.case_type.toLowerCase().includes(q) || (r.productielocatie || '').toLowerCase().includes(q))
    }
    return rows
  }, [bestelData, alleenBestellen, zoekterm])

  // KPI's
  const kpis = useMemo(() => ({
    totaal: bestelData.length,
    leeg: bestelData.filter(r => r.status === 'Leeg').length,
    bestellen: bestelData.filter(r => r.status === 'Bestellen').length,
    laag: bestelData.filter(r => r.status === 'Laag').length,
    vol: bestelData.filter(r => r.status === 'Vol').length,
    totalBestelAantal: bestelData.reduce((s, r) => s + r.bestel_aantal, 0),
  }), [bestelData])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/grote-inpak/kanban-besteladvies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: filteredBestel, alleenBestellen }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Besteladvies_Ckisten_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Export mislukt: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!form.case_type) return
    setSaving(true)
    try {
      const body = editingId ? { id: editingId, ...form } : form
      const method = editingId ? 'PATCH' : 'POST'
      const url = editingId ? '/api/grote-inpak/kanban-config' : '/api/grote-inpak/kanban-config'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await loadConfig()
      await loadBesteladvies()
    } catch (e: any) {
      alert(`Opslaan mislukt: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Kist verwijderen uit rekindeling?')) return
    await fetch(`/api/grote-inpak/kanban-config?id=${id}`, { method: 'DELETE' })
    await loadConfig()
    await loadBesteladvies()
  }

  const startEdit = (row: KanbanConfig) => {
    setEditingId(row.id)
    setForm({ ...row })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📦 Kanban Rekken — C-kisten Willebroek</h2>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('besteladvies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'besteladvies' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <ShoppingCart className="w-4 h-4" /> Besteladvies
          </button>
          <button
            onClick={() => setActiveView('rekindeling')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'rekindeling' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Rekindeling beheren
          </button>
        </div>
      </div>

      {/* ── BESTELADVIES ── */}
      {activeView === 'besteladvies' && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Totaal kisten</p>
              <p className="text-3xl font-bold text-gray-900">{kpis.totaal}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Leeg</p>
              <p className="text-3xl font-bold text-red-700">{kpis.leeg}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-xs text-orange-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>Bestellen</p>
              <p className="text-3xl font-bold text-orange-700">{kpis.bestellen}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs text-yellow-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>Laag</p>
              <p className="text-3xl font-bold text-yellow-700">{kpis.laag}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Vol</p>
              <p className="text-3xl font-bold text-green-700">{kpis.vol}</p>
            </div>
          </div>

          {/* Actiebalk */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={alleenBestellen}
                onChange={e => setAlleenBestellen(e.target.checked)}
                className="w-4 h-4"
              />
              Alleen te bestellen kisten tonen
              {alleenBestellen && kpis.leeg + kpis.bestellen > 0 && (
                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {kpis.leeg + kpis.bestellen} kisten · {kpis.totalBestelAantal} stuks
                </span>
              )}
            </label>
            <input
              type="text"
              value={zoekterm}
              onChange={e => setZoekterm(e.target.value)}
              placeholder="Zoek kisttype..."
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
            />
            <div className="flex-1" />
            <button
              onClick={loadBesteladvies}
              disabled={bestelLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${bestelLoading ? 'animate-spin' : ''}`} /> Vernieuwen
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || bestelData.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporteren...' : 'Exporteer besteladvies Excel'}
            </button>
          </div>

          {bestelError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {bestelError}
            </div>
          )}

          {/* Uitleg formule */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Max voorraad</strong> = posities × stapelhoogte × {2} stapels per positie &nbsp;·&nbsp;
            <strong>Bestelpunt</strong> = 50% van max voorraad &nbsp;·&nbsp;
            <strong>Bestellen</strong> = afgerond op stapelhoogte
          </div>

          {bestelLoading ? (
            <div className="py-12 text-center text-gray-400">Laden...</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-left">Kisttype</th>
                      <th className="px-4 py-3 text-left">Locatie</th>
                      <th className="px-4 py-3 text-left">Sectie / Niveau</th>
                      <th className="px-4 py-3 text-center">Stapel</th>
                      <th className="px-4 py-3 text-center">Posities</th>
                      <th className="px-4 py-3 text-center">Max voorraad</th>
                      <th className="px-4 py-3 text-center">Stock in rek</th>
                      <th className="px-4 py-3 text-center">Tekort</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">Bestellen (st)</th>
                      <th className="px-4 py-3 text-center">Verbruik/dag</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBestel.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-gray-400">
                          {bestelData.length === 0
                            ? 'Geen rekindeling geconfigureerd. Ga naar "Rekindeling beheren" om kisten toe te voegen.'
                            : 'Geen kisten gevonden met de huidige filters.'}
                        </td>
                      </tr>
                    )}
                    {filteredBestel.map((row, i) => {
                      const statusStyle = STATUS_STYLE[row.status] || STATUS_STYLE['Vol']
                      const prio = row.prioriteit ? PRIORITEIT_COLORS[row.prioriteit] : null
                      return (
                        <tr key={row.case_type} className={`hover:bg-gray-50 ${row.status === 'Leeg' ? 'bg-red-50/40' : row.status === 'Bestellen' ? 'bg-orange-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{row.case_type}</span>
                              {prio && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${prio.bg} ${prio.text}`}>{prio.label}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.productielocatie === 'Genk' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                              {row.productielocatie || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {row.rek_sectie || '—'}{row.rek_niveau ? ` · Niv ${row.rek_niveau}` : ''}{row.rek_kolom ? ` · Kol ${row.rek_kolom}` : ''}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{row.stapel}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{row.posities}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.max_voorraad}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${row.stock_in_rek === 0 ? 'bg-red-500' : row.stock_in_rek < row.bestelpunt ? 'bg-orange-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(100, (row.stock_in_rek / row.max_voorraad) * 100)}%` }}
                                />
                              </div>
                              <span className="text-gray-700 font-medium">{row.stock_in_rek}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={row.tekort > 0 ? 'text-red-700 font-medium' : 'text-gray-400'}>{row.tekort > 0 ? row.tekort : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.bestel_aantal > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold text-sm px-3 py-1 rounded-full">
                                <ShoppingCart className="w-3.5 h-3.5" /> {row.bestel_aantal} st
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500 text-xs">
                            {row.verbruik_per_dag ? Number(row.verbruik_per_dag).toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REKINDELING BEHEREN ── */}
      {activeView === 'rekindeling' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Beheer de vaste rekindeling van C-kisten in Willebroek. Stapel × posities × 2 = max voorraad per kist.</p>
            <button
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Kist toevoegen
            </button>
          </div>

          {/* Formulier */}
          {showForm && (
            <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">{editingId ? 'Kist bewerken' : 'Nieuwe kist toevoegen'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kisttype *</label>
                  <input value={form.case_type || ''} onChange={e => setForm(f => ({ ...f, case_type: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="bijv. C592" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Productielocatie</label>
                  <select value={form.productielocatie || ''} onChange={e => setForm(f => ({ ...f, productielocatie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="Wilrijk">Wilrijk</option>
                    <option value="Genk">Genk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rek sectie</label>
                  <select value={form.rek_sectie || ''} onChange={e => setForm(f => ({ ...f, rek_sectie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="Links">Links</option>
                    <option value="Rechts">Rechts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Niveau (1=grond)</label>
                  <input type="number" min={1} max={4} value={form.rek_niveau || ''} onChange={e => setForm(f => ({ ...f, rek_niveau: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kolom (1-8)</label>
                  <input type="number" min={1} max={8} value={form.rek_kolom || ''} onChange={e => setForm(f => ({ ...f, rek_kolom: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stapelhoogte</label>
                  <input type="number" min={1} value={form.stapel || 1} onChange={e => setForm(f => ({ ...f, stapel: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Posities</label>
                  <input type="number" min={1} value={form.posities || 1} onChange={e => setForm(f => ({ ...f, posities: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stapels/positie</label>
                  <input type="number" min={1} max={4} value={form.stapels_per_pos || 2} onChange={e => setForm(f => ({ ...f, stapels_per_pos: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Verbruik/dag</label>
                  <input type="number" step={0.01} value={form.verbruik_per_dag || ''} onChange={e => setForm(f => ({ ...f, verbruik_per_dag: Number(e.target.value) || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="bijv. 1.42" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prioriteit</label>
                  <select value={form.prioriteit || ''} onChange={e => setForm(f => ({ ...f, prioriteit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="critical">Kritiek (&gt;1.5/dag)</option>
                    <option value="high">Hoog (0.7-1.5/dag)</option>
                    <option value="medium">Medium (0.3-0.7/dag)</option>
                    <option value="low">Laag (0.1-0.3/dag)</option>
                    <option value="very-low">Zeer laag (&lt;0.1/dag)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notitie</label>
                  <input value={form.notitie || ''} onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optionele opmerking" />
                </div>
              </div>
              {/* Max voorraad preview */}
              {form.stapel && form.posities && (
                <div className="mt-3 bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-800">
                  <strong>Max voorraad preview:</strong> {form.posities} × {form.stapel} × {form.stapels_per_pos || 2} = <strong>{(form.posities || 0) * (form.stapel || 0) * (form.stapels_per_pos || 2)} stuks</strong>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveConfig} disabled={saving || !form.case_type}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {configLoading ? (
            <div className="py-10 text-center text-gray-400">Laden...</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-800">{config.length} kisten geconfigureerd</span>
                <button onClick={loadConfig} className="text-gray-400 hover:text-gray-700">
                  <RefreshCw className={`w-4 h-4 ${configLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-left">Kisttype</th>
                      <th className="px-4 py-3 text-left">Locatie</th>
                      <th className="px-4 py-3 text-left">Sectie / Niv / Kol</th>
                      <th className="px-4 py-3 text-center">Stapel</th>
                      <th className="px-4 py-3 text-center">Posities</th>
                      <th className="px-4 py-3 text-center">Stapels/pos</th>
                      <th className="px-4 py-3 text-center">Max voorraad</th>
                      <th className="px-4 py-3 text-center">Verbruik/dag</th>
                      <th className="px-4 py-3 text-center">Prioriteit</th>
                      <th className="px-4 py-3 text-center">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {config.length === 0 && (
                      <tr><td colSpan={10} className="py-10 text-center text-gray-400">Geen kisten geconfigureerd.</td></tr>
                    )}
                    {config.map((row, i) => {
                      const maxV = row.posities * row.stapel * row.stapels_per_pos
                      const prio = row.prioriteit ? PRIORITEIT_COLORS[row.prioriteit] : null
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-bold text-gray-900">{row.case_type}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.productielocatie === 'Genk' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                              {row.productielocatie || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">
                            {row.rek_sectie || '—'} · Niv {row.rek_niveau || '?'} · Kol {row.rek_kolom || '?'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-700">{row.stapel}</td>
                          <td className="px-4 py-2.5 text-center text-gray-700">{row.posities}</td>
                          <td className="px-4 py-2.5 text-center text-gray-700">{row.stapels_per_pos}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-gray-900">{maxV}</td>
                          <td className="px-4 py-2.5 text-center text-gray-500 text-xs">
                            {row.verbruik_per_dag ? Number(row.verbruik_per_dag).toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {prio ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${prio.bg} ${prio.text}`}>{prio.label}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => startEdit(row)} className="text-blue-600 hover:text-blue-800">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Download, RefreshCw, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, Package, ShoppingCart, LayoutGrid, Mail, Search, ChevronDown, ChevronUp, TrendingUp, Zap, Upload, FileSpreadsheet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
  stock_elders: number
  in_productie: number
  in_transfer: number
  op_pils: number
  tekort: number
  bestel_aantal: number
  status: 'Leeg' | 'Productie aanmaken' | 'Gedekt' | 'Vol'
  priority_rank?: number
}

const PRIORITEIT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'critical': { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Kritiek' },
  'high':     { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Hoog' },
  'medium':   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
  'low':      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Laag' },
  'very-low': { bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Zeer laag' },
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  'Leeg':               { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
  'Productie aanmaken': { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  'Gedekt':             { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-400' },
  'Vol':                { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
}

const EMPTY_FORM: Partial<KanbanConfig> = {
  case_type: '', rek_sectie: 'Links', rek_niveau: 1, rek_kolom: 1,
  productielocatie: 'Wilrijk', stapel: 1, posities: 1, stapels_per_pos: 2,
  verbruik_per_dag: null, prioriteit: 'low', notitie: '',
}

// ── Verbruiksanalyse types ─────────────────────────────────────────────────
interface ConsumptionStat {
  case_type: string
  total: number
  active_days: number
  avg_per_day: number
  monthly: { month: string; count: number }[]
  in_config: boolean
  config_id: number | null
  productielocatie: string | null
  current_verbruik_per_dag: number | null
  current_max: number | null
  suggested_verbruik_per_dag: number
  suggested_min: number
  suggested_max: number
  suggested_posities: number | null
}

interface ConsumptionMeta {
  since: string
  days: number
  lead_time: number
  safety_days: number
  total_kisten_verbruikt: number
  unieke_typen: number
  in_kanban_config: number
  niet_in_config: number
  meest_gebruikt: string | null
}

interface KanbanTabProps {
  stockUploadTrigger?: number
}

export default function KanbanTab({ stockUploadTrigger = 0 }: KanbanTabProps) {
  const [activeView, setActiveView] = useState<'besteladvies' | 'rekindeling' | 'verbruiksanalyse'>('besteladvies')

  // Besteladvies state
  const [bestelData, setBestelData] = useState<BestelRij[]>([])
  const [bestelLoading, setBestelLoading] = useState(false)
  const [bestelError, setBestelError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [alleenBestellen, setAlleenBestellen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [inlineEditId, setInlineEditId] = useState<number | null>(null)
  const [inlineEditValues, setInlineEditValues] = useState<{ stapel: number; posities: number; stapels_per_pos: number }>({ stapel: 1, posities: 1, stapels_per_pos: 2 })
  const [inlineSaving, setInlineSaving] = useState(false)
  const [zoekterm, setZoekterm] = useState('')
  const [filterLocatie, setFilterLocatie] = useState<'Alle' | 'Genk' | 'Wilrijk'>('Alle')
  const [diagnostiekOpen, setDiagnostiekOpen] = useState(false)
  const [diagnostiekKist, setDiagnostiekKist] = useState('C830')
  const [diagnostiekResult, setDiagnostiekResult] = useState<any>(null)
  const [diagnostiekLoading, setDiagnostiekLoading] = useState(false)

  // Verbruiksanalyse state
  const [consumptionData, setConsumptionData]   = useState<ConsumptionStat[]>([])
  const [consumptionMeta, setConsumptionMeta]   = useState<ConsumptionMeta | null>(null)
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [consumptionError, setConsumptionError] = useState<string | null>(null)
  const [leadTime, setLeadTime]     = useState(5)
  const [safetyDays, setSafetyDays] = useState(3)
  const [onlyInConfig, setOnlyInConfig] = useState(false)
  const [selectedKist, setSelectedKist] = useState<string | null>(null)
  const [applyingAll, setApplyingAll]   = useState(false)
  const [applyStatus, setApplyStatus]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [updatingId, setUpdatingId]     = useState<number | null>(null)

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
      setDebugInfo(result._debug || null)
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

  const loadConsumption = useCallback(async (lt = leadTime, sd = safetyDays) => {
    setConsumptionLoading(true)
    setConsumptionError(null)
    try {
      const res = await fetch(`/api/grote-inpak/packed-consumption?days=365&lead_time=${lt}&safety_days=${sd}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const json = await res.json()
      setConsumptionData(json.data || [])
      setConsumptionMeta(json.meta || null)
    } catch (e: any) {
      setConsumptionError(e.message)
    } finally {
      setConsumptionLoading(false)
    }
  }, [leadTime, safetyDays])

  const handleApplySingle = async (stat: ConsumptionStat) => {
    if (!stat.config_id) return
    setUpdatingId(stat.config_id)
    try {
      const res = await fetch('/api/grote-inpak/packed-consumption', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: stat.config_id, verbruik_per_dag: stat.suggested_verbruik_per_dag }] }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      await loadConsumption()
      await loadBesteladvies()
    } catch (e: any) {
      alert(`Bijwerken mislukt: ${e.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleApplyAll = async () => {
    const toUpdate = consumptionData.filter(r => r.in_config && r.config_id && r.avg_per_day > 0)
    if (toUpdate.length === 0) return
    if (!confirm(`Verbruik/dag bijwerken voor ${toUpdate.length} kisten op basis van historische data?`)) return
    setApplyingAll(true)
    setApplyStatus(null)
    try {
      const res = await fetch('/api/grote-inpak/packed-consumption', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: toUpdate.map(r => ({ id: r.config_id!, verbruik_per_dag: r.suggested_verbruik_per_dag })) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setApplyStatus({ ok: true, msg: `${json.updated} kisten bijgewerkt met historisch verbruik` })
      await loadConsumption()
      await loadBesteladvies()
    } catch (e: any) {
      setApplyStatus({ ok: false, msg: `Fout: ${e.message}` })
    } finally {
      setApplyingAll(false)
    }
  }

  useEffect(() => { loadBesteladvies() }, [loadBesteladvies])
  useEffect(() => { loadBesteladvies() }, [loadBesteladvies, stockUploadTrigger])
  useEffect(() => { if (activeView === 'rekindeling') loadConfig() }, [activeView, loadConfig])
  useEffect(() => { if (activeView === 'verbruiksanalyse') loadConsumption() }, [activeView, loadConsumption])

  const filteredBestel = useMemo(() => {
    let rows = bestelData
    if (filterLocatie !== 'Alle') {
      rows = rows.filter(r => String(r.productielocatie || '').toLowerCase().includes(filterLocatie.toLowerCase()))
    }
    if (alleenBestellen) rows = rows.filter(r => r.bestel_aantal > 0)
    if (zoekterm) {
      const q = zoekterm.toLowerCase()
      rows = rows.filter(r => r.case_type.toLowerCase().includes(q) || (r.productielocatie || '').toLowerCase().includes(q))
    }
    return rows
  }, [bestelData, filterLocatie, alleenBestellen, zoekterm])

  const filteredConfig = useMemo(() => {
    if (filterLocatie === 'Alle') return config
    return config.filter(r => String(r.productielocatie || '').toLowerCase().includes(filterLocatie.toLowerCase()))
  }, [config, filterLocatie])

  // KPI's (op basis van gefilterde data)
  const kpis = useMemo(() => ({
    totaal: filteredBestel.length,
    leeg: filteredBestel.filter(r => r.status === 'Leeg').length,
    bestellen: filteredBestel.filter(r => r.status === 'Productie aanmaken').length,
    gedekt: filteredBestel.filter(r => r.status === 'Gedekt').length,
    vol: filteredBestel.filter(r => r.status === 'Vol').length,
    totalBestelAantal: filteredBestel.reduce((s, r) => s + r.bestel_aantal, 0),
  }), [filteredBestel])

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
      a.download = `C_kisten_daily_order_Genk_Wilrijk_${new Date().toISOString().split('T')[0]}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Export mislukt: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleSendEmail = async (location: 'Genk' | 'Wilrijk') => {
    setIsSendingEmail(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/grote-inpak/send-daily-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: filteredBestel, alleenBestellen, location }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEmailStatus({ ok: true, msg: json.message || `E-mail verstuurd naar prodwilrijk@foresco.eu (${location})` })
    } catch (e: any) {
      setEmailStatus({ ok: false, msg: `Versturen mislukt: ${e.message}` })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const startInlineEdit = (row: BestelRij) => {
    setInlineEditId(row.id)
    setInlineEditValues({ stapel: row.stapel, posities: row.posities, stapels_per_pos: row.stapels_per_pos })
  }

  const handleInlineSave = async () => {
    if (!inlineEditId) return
    setInlineSaving(true)
    try {
      const res = await fetch('/api/grote-inpak/kanban-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inlineEditId, ...inlineEditValues }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setInlineEditId(null)
      await loadBesteladvies()
    } catch (e: any) {
      alert(`Opslaan mislukt: ${e.message}`)
    } finally {
      setInlineSaving(false)
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

  const runStockDiagnostiek = async () => {
    const kist = diagnostiekKist.trim()
    if (!kist) return
    setDiagnostiekLoading(true)
    setDiagnostiekResult(null)
    try {
      const res = await fetch(`/api/grote-inpak/stock-diagnostic?kist=${encodeURIComponent(kist)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout bij ophalen')
      setDiagnostiekResult(data)
    } catch (e: any) {
      setDiagnostiekResult({ error: e.message })
    } finally {
      setDiagnostiekLoading(false)
    }
  }

  const filteredConsumption = useMemo(() => {
    let rows = consumptionData
    if (onlyInConfig) rows = rows.filter(r => r.in_config)
    return rows
  }, [consumptionData, onlyInConfig])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📦 Kanban Rekken — C-kisten Willebroek</h2>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('besteladvies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'besteladvies' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <ShoppingCart className="w-4 h-4" /> C kisten daily order
          </button>
          <button
            onClick={() => setActiveView('rekindeling')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'rekindeling' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Rekindeling beheren
          </button>
          <button
            onClick={() => setActiveView('verbruiksanalyse')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'verbruiksanalyse' ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <TrendingUp className="w-4 h-4" /> Verbruiksanalyse
          </button>
        </div>
      </div>

      {/* ── C KISTEN DAILY ORDER ── */}
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
              <p className="text-xs text-orange-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>Productie aanmaken</p>
              <p className="text-3xl font-bold text-orange-700">{kpis.bestellen}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-700 uppercase font-medium mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>Gedekt</p>
              <p className="text-3xl font-bold text-blue-700">{kpis.gedekt}</p>
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
            <select
              value={filterLocatie}
              onChange={e => setFilterLocatie(e.target.value as 'Alle' | 'Genk' | 'Wilrijk')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="Alle">Alle locaties</option>
              <option value="Genk">Genk</option>
              <option value="Wilrijk">Wilrijk</option>
            </select>
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
              {isExporting ? 'Exporteren...' : 'Exporteer C kisten daily order (ZIP: Genk + Wilrijk)'}
            </button>
            <button
              onClick={() => handleSendEmail('Genk')}
              disabled={isSendingEmail || bestelData.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              {isSendingEmail ? 'Versturen...' : 'Mail Genk order'}
            </button>
            <button
              onClick={() => handleSendEmail('Wilrijk')}
              disabled={isSendingEmail || bestelData.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              {isSendingEmail ? 'Versturen...' : 'Mail Wilrijk order'}
            </button>
          </div>

          {emailStatus && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${emailStatus.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {emailStatus.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {emailStatus.msg}
            </div>
          )}

          {bestelError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {bestelError}
            </div>
          )}

          {/* Uitleg formule */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Max voorraad</strong> = posities × stapelhoogte × {2} stapels per positie &nbsp;·&nbsp;
            <strong>Bestelpunt</strong> = 50% van max voorraad &nbsp;·&nbsp;
            <strong>Productie aanmaken</strong> = afgerond op stapelhoogte
          </div>
          {debugInfo?.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>⚠️ Stock in rek = 0?</strong> {debugInfo.warning}
            </div>
          )}
          {debugInfo && debugInfo.stock_rows_total > 0 && debugInfo.stock_rows_met_productie_in_db === 0 && debugInfo.kisten_met_productie?.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>💡 Geen &quot;in productie&quot; in database:</strong> Er staan {debugInfo.stock_rows_total} stock-rijen in de database, maar geen enkele heeft productie &gt; 0.
              Controleer of je Stock Excel de kolom &quot;Qty. on Prod. Order&quot; heeft en of de header herkend wordt (zie upload-log of probeer de kolomnaam aan te passen).
            </div>
          )}
          {debugInfo?.stock_productie_niet_gematched?.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <strong>🔍 Productie niet gekoppeld:</strong> In de stock staan {debugInfo.stock_rows_met_productie_in_db ?? 0} rijen met &quot;in productie&quot; &gt; 0.
              De volgende ERP-codes konden <em>niet</em> aan een kist gekoppeld worden (controleer ERP LINK):
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {debugInfo.stock_productie_niet_gematched.slice(0, 10).map((r: any, i: number) => (
                  <li key={i}>{r.erp_code} (loc: {r.location}) → {r.productie} stuks</li>
                ))}
                {debugInfo.stock_productie_niet_gematched.length > 10 && (
                  <li className="text-orange-600">+ nog {debugInfo.stock_productie_niet_gematched.length - 10} anderen</li>
                )}
              </ul>
            </div>
          )}

          {/* Stock diagnostiek */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDiagnostiekOpen(!diagnostiekOpen)}
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" /> Stock diagnostiek — bekijk wat er in de DB staat voor een kist
              </span>
              {diagnostiekOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {diagnostiekOpen && (
              <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={diagnostiekKist}
                    onChange={e => setDiagnostiekKist(e.target.value)}
                    placeholder="C830 of GP006064"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40 font-mono"
                  />
                  <button
                    onClick={runStockDiagnostiek}
                    disabled={diagnostiekLoading || !diagnostiekKist.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                    {diagnostiekLoading ? 'Ophalen...' : 'Diagnostiek'}
                  </button>
                </div>
                {diagnostiekResult && (
                  <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                    {diagnostiekResult.error
                      ? JSON.stringify({ error: diagnostiekResult.error }, null, 2)
                      : JSON.stringify(
                          {
                            kist_gezocht: diagnostiekResult.kist_gezocht,
                            erp_link: diagnostiekResult.erp_link,
                            erp_norm: diagnostiekResult.erp_norm,
                            alle_locaties_in_stock: diagnostiekResult.alle_locaties_in_stock,
                            stock_rijen: diagnostiekResult.stock_rijen,
                            stock_totaal_in_db: diagnostiekResult.stock_totaal_in_db,
                          },
                          null,
                          2
                        )}
                  </pre>
                )}
              </div>
            )}
          </div>

          {bestelLoading ? (
            <div className="py-12 text-center text-gray-400">Laden...</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center">Prioriteit</th>
                      <th className="px-4 py-3 text-left">Kisttype</th>
                      <th className="px-4 py-3 text-left">Locatie</th>
                      <th className="px-4 py-3 text-left">Sectie / Niveau</th>
                      <th className="px-4 py-3 text-center cursor-help" title="Klik op de waarde in de rij om te bewerken">Stapel ✎</th>
                      <th className="px-4 py-3 text-center cursor-help" title="Klik op de waarde in de rij om te bewerken">Posities ✎</th>
                      <th className="px-4 py-3 text-center">Max voorraad</th>
                      <th className="px-4 py-3 text-center">Stock in rek</th>
                      <th className="px-4 py-3 text-center">Stock Genk</th>
                      <th className="px-4 py-3 text-center">Stock Wilrijk</th>
                      <th className="px-4 py-3 text-center">In productie</th>
                      <th className="px-4 py-3 text-center">In transfer</th>
                      <th className="px-4 py-3 text-center">Op PILS</th>
                      <th className="px-4 py-3 text-center">Tekort</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">Effectief te produceren</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBestel.length === 0 && (
                      <tr>
                        <td colSpan={16} className="py-10 text-center text-gray-400">
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
                        <tr key={row.case_type} className={`hover:bg-gray-50 ${row.status === 'Leeg' ? 'bg-red-50/40' : row.status === 'Productie aanmaken' ? 'bg-orange-50/30' : row.status === 'Gedekt' ? 'bg-blue-50/20' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-sm">{row.priority_rank ?? i + 1}</span>
                          </td>
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
                          {inlineEditId === row.id ? (
                            <>
                              <td className="px-2 py-2 text-center">
                                <input type="number" min={1} value={inlineEditValues.stapel} onChange={e => setInlineEditValues(v => ({ ...v, stapel: Number(e.target.value) }))} className="w-14 border border-blue-300 rounded px-1 py-0.5 text-sm text-center" />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input type="number" min={1} value={inlineEditValues.posities} onChange={e => setInlineEditValues(v => ({ ...v, posities: Number(e.target.value) }))} className="w-14 border border-blue-300 rounded px-1 py-0.5 text-sm text-center" />
                              </td>
                              <td className="px-2 py-2 text-center text-gray-400 text-xs">
                                {inlineEditValues.posities * inlineEditValues.stapel * inlineEditValues.stapels_per_pos}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => startInlineEdit(row)} className="text-gray-700 hover:text-blue-600 hover:underline font-medium">{row.stapel}</button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => startInlineEdit(row)} className="text-gray-700 hover:text-blue-600 hover:underline font-medium">{row.posities}</button>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.max_voorraad}</td>
                            </>
                          )}
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
                          <td className="px-4 py-3 text-center text-blue-800 font-medium">
                            {(row.stock_genk ?? 0) > 0 ? row.stock_genk : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-800 font-medium">
                            {(row.stock_wilrijk ?? 0) > 0 ? row.stock_wilrijk : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {(row.in_productie ?? 0) > 0 ? row.in_productie : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-orange-700 font-medium">
                            {(row.in_transfer ?? 0) > 0 ? row.in_transfer : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-700 font-medium">
                            {(row.op_pils ?? 0) > 0 ? row.op_pils : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={row.tekort > 0 ? 'text-red-700 font-medium' : 'text-gray-400'}>{row.tekort > 0 ? row.tekort : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={(row.bestel_aantal ?? 0) > 0 ? 'text-red-700 font-medium' : 'text-gray-400'}>
                              {(row.bestel_aantal ?? 0) > 0 ? row.bestel_aantal : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {inlineEditId === row.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={handleInlineSave} disabled={inlineSaving} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
                                  {inlineSaving ? '...' : 'Opslaan'}
                                </button>
                                <button onClick={() => setInlineEditId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
                                  Annuleer
                                </button>
                              </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                                {row.status}
                              </span>
                            )}
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

      {/* ── VERBRUIKSANALYSE ── */}
      {activeView === 'verbruiksanalyse' && (
        <VerbruiksanalyseView
          data={consumptionData}
          meta={consumptionMeta}
          loading={consumptionLoading}
          error={consumptionError}
          leadTime={leadTime}
          safetyDays={safetyDays}
          onlyInConfig={onlyInConfig}
          selectedKist={selectedKist}
          applyingAll={applyingAll}
          applyStatus={applyStatus}
          updatingId={updatingId}
          onReload={() => loadConsumption(leadTime, safetyDays)}
          onLeadTimeChange={(v) => { setLeadTime(v); loadConsumption(v, safetyDays) }}
          onSafetyDaysChange={(v) => { setSafetyDays(v); loadConsumption(leadTime, v) }}
          onOnlyInConfigChange={setOnlyInConfig}
          onSelectKist={setSelectedKist}
          onApplySingle={handleApplySingle}
          onApplyAll={handleApplyAll}
          filteredData={filteredConsumption}
        />
      )}

      {/* ── REKINDELING BEHEREN ── */}
      {activeView === 'rekindeling' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">Beheer de vaste rekindeling van C-kisten in Willebroek. Stapel × posities × 2 = max voorraad per kist.</p>
              <select
                value={filterLocatie}
                onChange={e => setFilterLocatie(e.target.value as 'Alle' | 'Genk' | 'Wilrijk')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="Alle">Alle locaties</option>
                <option value="Genk">Genk</option>
                <option value="Wilrijk">Wilrijk</option>
              </select>
            </div>
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
                <span className="font-semibold text-gray-800">{filteredConfig.length} kisten geconfigureerd</span>
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
                    {filteredConfig.length === 0 && (
                      <tr><td colSpan={10} className="py-10 text-center text-gray-400">Geen kisten geconfigureerd.</td></tr>
                    )}
                    {filteredConfig.map((row, i) => {
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

// ── VerbruiksanalyseView ───────────────────────────────────────────────────
interface VerbruiksanalyseProps {
  data: ConsumptionStat[]
  filteredData: ConsumptionStat[]
  meta: ConsumptionMeta | null
  loading: boolean
  error: string | null
  leadTime: number
  safetyDays: number
  onlyInConfig: boolean
  selectedKist: string | null
  applyingAll: boolean
  applyStatus: { ok: boolean; msg: string } | null
  updatingId: number | null
  onReload: () => void
  onLeadTimeChange: (v: number) => void
  onSafetyDaysChange: (v: number) => void
  onOnlyInConfigChange: (v: boolean) => void
  onSelectKist: (v: string | null) => void
  onApplySingle: (stat: ConsumptionStat) => void
  onApplyAll: () => void
}

function VerbruiksanalyseView({
  data, filteredData, meta, loading, error,
  leadTime, safetyDays, onlyInConfig, selectedKist,
  applyingAll, applyStatus, updatingId,
  onReload, onLeadTimeChange, onSafetyDaysChange,
  onOnlyInConfigChange, onSelectKist,
  onApplySingle, onApplyAll,
}: VerbruiksanalyseProps) {

  const BATCH_SIZE = 80 // ~80 bestanden per batch ≈ 1.5–2 MB, ruim onder Vercel's 4.5 MB limiet

  const [uploadOpen, setUploadOpen]     = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    success?: boolean
    files_processed?: number
    files_failed?: number
    records_upserted?: number
    top_kisten?: { case_type: string; quantity: number }[]
    error?: string
  } | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setUploadResult(null)

    // Splits in batches van BATCH_SIZE zodat we altijd onder de 4.5 MB Vercel-limiet blijven
    const batches: File[][] = []
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE))
    }

    let totalProcessed = 0
    let totalFailed    = 0
    let totalUpserted  = 0
    const allTopKisten = new Map<string, number>()
    let lastError: string | undefined

    try {
      for (let b = 0; b < batches.length; b++) {
        setBatchProgress({ current: b + 1, total: batches.length })
        const form = new FormData()
        batches[b].forEach(f => form.append('files', f))
        const res  = await fetch('/api/grote-inpak/packed-consumption/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (json.success) {
          totalProcessed += json.files_processed ?? 0
          totalFailed    += json.files_failed    ?? 0
          totalUpserted  += json.records_upserted ?? 0
          ;(json.top_kisten ?? []).forEach((k: { case_type: string; quantity: number }) => {
            allTopKisten.set(k.case_type, (allTopKisten.get(k.case_type) ?? 0) + k.quantity)
          })
        } else {
          lastError = json.error
          totalFailed += batches[b].length
        }
      }

      const topKisten = Array.from(allTopKisten.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([case_type, quantity]) => ({ case_type, quantity }))

      setUploadResult({
        success: totalProcessed > 0,
        files_processed: totalProcessed,
        files_failed: totalFailed,
        records_upserted: totalUpserted,
        top_kisten: topKisten,
        error: totalProcessed === 0 ? (lastError ?? 'Alle bestanden mislukt') : undefined,
      })
      if (totalProcessed > 0) onReload()
    } catch (err: any) {
      setUploadResult({ error: err.message })
    } finally {
      setUploading(false)
      setBatchProgress(null)
      e.target.value = ''
    }
  }

  const selectedStat = selectedKist ? data.find(r => r.case_type === selectedKist) : null

  // Top 20 voor de barChart
  const chartData = filteredData.slice(0, 20).map(r => ({
    name: r.case_type,
    total: r.total,
    avg: r.avg_per_day,
  }))

  const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe']

  const noData = !loading && data.length === 0

  return (
    <div className="space-y-5">

      {/* ── Upload sectie ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setUploadOpen(!uploadOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-purple-600" />
            PACKED_Y / PACKED_N bestanden uploaden
          </span>
          <span className="text-xs text-gray-400">{uploadOpen ? '▲ Inklappen' : '▼ Uitklappen'}</span>
        </button>

        {uploadOpen && (
          <div className="p-4 bg-white border-t border-gray-100 space-y-4">
            <p className="text-sm text-gray-600">
              Upload één of meerdere <strong>PACKED_Y.XLS</strong> of <strong>PACKED_N.XLS</strong> bestanden.
              Je kan alle 224 bestanden tegelijk selecteren — ze worden automatisch verwerkt en opgeslagen.
            </p>

            <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50/30'}`}>
              {uploading ? (
                <>
                  <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                  {batchProgress && batchProgress.total > 1 ? (
                    <div className="w-full max-w-xs space-y-1 text-center">
                      <span className="text-sm text-gray-600 font-medium">
                        Batch {batchProgress.current} / {batchProgress.total} uploaden...
                      </span>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        {Math.round((batchProgress.current / batchProgress.total) * 100)}% — even geduld
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Bestanden verwerken...</span>
                  )}
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                  <div className="text-center">
                    <span className="text-sm font-semibold text-purple-700">Klik om bestanden te selecteren</span>
                    <p className="text-xs text-gray-400 mt-1">
                      PACKED_Y*.XLS en PACKED_N*.XLS — alle bestanden tegelijk selecteren is OK
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      Worden automatisch opgesplitst in batches van {BATCH_SIZE} bestanden
                    </p>
                  </div>
                </>
              )}
              <input
                type="file"
                multiple
                accept=".xls,.xlsx"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploadResult && (
              <div className={`rounded-lg p-4 text-sm space-y-3 ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {uploadResult.error && (
                  <p className="text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {uploadResult.error}
                  </p>
                )}
                {uploadResult.success && (
                  <div className="space-y-2">
                    <p className="text-green-800 font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {uploadResult.files_processed} bestand{uploadResult.files_processed !== 1 ? 'en' : ''} verwerkt · {uploadResult.records_upserted?.toLocaleString('nl-NL')} dagrecords opgeslagen
                      {(uploadResult.files_failed ?? 0) > 0 && (
                        <span className="text-orange-600 font-normal">· {uploadResult.files_failed} mislukt</span>
                      )}
                    </p>
                    {uploadResult.top_kisten && uploadResult.top_kisten.length > 0 && (
                      <div>
                        <p className="text-green-700 text-xs font-medium mb-1">Top kisten in geüploade data:</p>
                        <div className="flex flex-wrap gap-2">
                          {uploadResult.top_kisten.map(k => (
                            <span key={k.case_type} className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-mono">
                              {k.case_type}: {k.quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI cards */}
      {meta && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Totaal verbruikt</p>
            <p className="text-3xl font-bold text-gray-900">{meta.total_kisten_verbruikt.toLocaleString('nl-NL')}</p>
            <p className="text-xs text-gray-400 mt-1">kisten afgelopen {meta.days} dagen</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-xs text-purple-700 uppercase font-medium mb-1">Unieke types</p>
            <p className="text-3xl font-bold text-purple-800">{meta.unieke_typen}</p>
            <p className="text-xs text-purple-400 mt-1">{meta.in_kanban_config} in kanban · {meta.niet_in_config} niet</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-xs text-indigo-700 uppercase font-medium mb-1">Meest gebruikt</p>
            <p className="text-2xl font-bold text-indigo-800">{meta.meest_gebruikt ?? '—'}</p>
            <p className="text-xs text-indigo-400 mt-1">{data[0]?.total ?? 0} stuks · {data[0]?.avg_per_day ?? 0}/dag</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700 uppercase font-medium mb-1">Lead time instelling</p>
            <p className="text-3xl font-bold text-green-800">{leadTime} <span className="text-lg font-medium">+ {safetyDays}</span></p>
            <p className="text-xs text-green-400 mt-1">werkdagen + veiligheidsbuffer</p>
          </div>
        </div>
      )}

      {/* Instellingen + actiebalk */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600 font-medium whitespace-nowrap">Lead time (dagen):</label>
          <input
            type="number" min={1} max={30} value={leadTime}
            onChange={e => onLeadTimeChange(Math.max(1, Math.min(30, Number(e.target.value))))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600 font-medium whitespace-nowrap">Veiligheidsbuffer (dagen):</label>
          <input
            type="number" min={0} max={30} value={safetyDays}
            onChange={e => onSafetyDaysChange(Math.max(0, Math.min(30, Number(e.target.value))))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
          />
        </div>
        <div className="w-px h-6 bg-gray-300 hidden md:block" />
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={onlyInConfig} onChange={e => onOnlyInConfigChange(e.target.checked)} className="w-4 h-4" />
          Alleen kisten in kanban rekken
        </label>
        <div className="flex-1" />
        <button
          onClick={onReload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
        <button
          onClick={onApplyAll}
          disabled={applyingAll || loading || filteredData.filter(r => r.in_config && r.avg_per_day > 0).length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          {applyingAll ? 'Bijwerken...' : `Pas verbruik/dag toe (${filteredData.filter(r => r.in_config && r.avg_per_day > 0).length} kisten)`}
        </button>
      </div>

      {applyStatus && (
        <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${applyStatus.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {applyStatus.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {applyStatus.msg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error.includes('does not exist') || error.includes('relation') ? (
            <span>Tabel nog niet aangemaakt. Voer eerst de SQL-migratie uit in Supabase en importeer de data via het script.</span>
          ) : error}
        </div>
      )}

      {noData && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Package className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-amber-800 font-semibold mb-1">Nog geen verbruiksdata</p>
          <p className="text-amber-600 text-sm">Voer het importscript uit om de PACKED_Y/N bestanden te laden:</p>
          <code className="mt-3 block bg-amber-100 text-amber-900 text-xs px-4 py-2 rounded-lg font-mono">
            powershell -ExecutionPolicy Bypass -File scripts\run-packed-import.ps1
          </code>
        </div>
      )}

      {/* Grafiek + details naast elkaar */}
      {!loading && filteredData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Barsgrafiek top 20 */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Top {Math.min(20, filteredData.length)} kisttypen — totaal verbruikt (afgelopen {meta?.days ?? 365} dagen)
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fontWeight: 600 }} width={52} />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    name === 'total' ? `${val} stuks` : `${val}/dag`,
                    name === 'total' ? 'Totaal' : 'Gem/dag',
                  ]}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} onClick={(d) => onSelectKist(d.name === selectedKist ? null : d.name)}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === selectedKist ? '#7c3aed' : CHART_COLORS[i % CHART_COLORS.length]}
                      opacity={selectedKist && entry.name !== selectedKist ? 0.4 : 1}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail van geselecteerde kist */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {selectedStat ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900">{selectedStat.case_type}</h3>
                  <button onClick={() => onSelectKist(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕ Sluit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Totaal verbruikt</span>
                    <span className="font-semibold">{selectedStat.total} stuks</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Actieve dagen</span>
                    <span className="font-semibold">{selectedStat.active_days}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Gem. per dag</span>
                    <span className="font-semibold text-purple-700">{selectedStat.avg_per_day.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Huidig verbruik/dag</span>
                    <span className={`font-semibold ${selectedStat.current_verbruik_per_dag ? '' : 'text-gray-400'}`}>
                      {selectedStat.current_verbruik_per_dag?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-semibold text-purple-800 mb-2">Suggesties (lead {leadTime}d + {safetyDays}d buffer)</p>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Min (bestelpunt)</span>
                    <span className="font-bold text-purple-800">{selectedStat.suggested_min}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Max (doel)</span>
                    <span className="font-bold text-purple-800">{selectedStat.suggested_max}</span>
                  </div>
                  {selectedStat.current_max !== null && (
                    <div className="flex justify-between">
                      <span className="text-purple-600">Huidig max</span>
                      <span className={`font-bold ${selectedStat.current_max < selectedStat.suggested_max ? 'text-red-600' : 'text-green-700'}`}>
                        {selectedStat.current_max} {selectedStat.current_max < selectedStat.suggested_max ? '⚠️ te laag' : '✓'}
                      </span>
                    </div>
                  )}
                  {selectedStat.suggested_posities && (
                    <div className="flex justify-between">
                      <span className="text-purple-600">Aanbevolen posities</span>
                      <span className="font-bold text-purple-800">{selectedStat.suggested_posities}</span>
                    </div>
                  )}
                </div>
                {/* Maandgrafiek */}
                {selectedStat.monthly.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Maandelijks verbruik</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={selectedStat.monthly} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: number) => [`${v} stuks`, 'Verbruik']} labelFormatter={(l: string) => l} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {selectedStat.in_config && selectedStat.config_id && selectedStat.avg_per_day > 0 && (
                  <button
                    onClick={() => onApplySingle(selectedStat)}
                    disabled={updatingId === selectedStat.config_id}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    {updatingId === selectedStat.config_id ? 'Bijwerken...' : `Pas toe: ${selectedStat.suggested_verbruik_per_dag.toFixed(2)}/dag`}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-400">
                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Klik op een balk in de grafiek<br />om details te zien</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hoofdtabel */}
      {!loading && filteredData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">{filteredData.length} kisttypen</span>
            <p className="text-xs text-gray-400">
              Suggestie formule: avg/dag × lead_time ({leadTime}d) = min · avg/dag × (lead+buffer) ({leadTime + safetyDays}d) = max
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3 text-left">Kisttype</th>
                  <th className="px-4 py-3 text-left">Locatie</th>
                  <th className="px-4 py-3 text-center">Totaal verbruikt</th>
                  <th className="px-4 py-3 text-center">Actieve dagen</th>
                  <th className="px-4 py-3 text-center">Gem/dag (data)</th>
                  <th className="px-4 py-3 text-center">Huidig config/dag</th>
                  <th className="px-4 py-3 text-center bg-purple-50 text-purple-700">Suggestie min</th>
                  <th className="px-4 py-3 text-center bg-purple-50 text-purple-700">Suggestie max</th>
                  <th className="px-4 py-3 text-center">Huidig max</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map(row => {
                  const diffPct = row.current_verbruik_per_dag && row.avg_per_day
                    ? Math.round(((row.avg_per_day - row.current_verbruik_per_dag) / row.current_verbruik_per_dag) * 100)
                    : null
                  const maxTooLow = row.current_max !== null && row.current_max < row.suggested_max && row.avg_per_day > 0
                  return (
                    <tr
                      key={row.case_type}
                      onClick={() => onSelectKist(row.case_type === selectedKist ? null : row.case_type)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${row.case_type === selectedKist ? 'bg-purple-50/60' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-gray-900">{row.case_type}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.productielocatie ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.productielocatie === 'Genk' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {row.productielocatie}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">niet in config</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-gray-900">
                        {row.total > 0 ? row.total.toLocaleString('nl-NL') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{row.active_days || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {row.avg_per_day > 0 ? (
                          <span className="font-semibold text-purple-700">{row.avg_per_day.toFixed(2)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-gray-600">{row.current_verbruik_per_dag?.toFixed(2) ?? '—'}</span>
                          {diffPct !== null && Math.abs(diffPct) >= 10 && (
                            <span className={`text-xs px-1 rounded ${diffPct > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center bg-purple-50/30">
                        <span className="font-semibold text-purple-700">{row.suggested_min > 0 ? row.suggested_min : '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center bg-purple-50/30">
                        <span className="font-semibold text-purple-700">{row.suggested_max > 0 ? row.suggested_max : '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.current_max !== null ? (
                          <span className={maxTooLow ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                            {row.current_max} {maxTooLow ? '⚠️' : ''}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {!row.in_config ? (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Niet in rekken</span>
                        ) : row.total === 0 ? (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Geen data</span>
                        ) : maxTooLow ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Max te laag</span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                        {row.in_config && row.config_id && row.avg_per_day > 0 && (
                          <button
                            onClick={() => onApplySingle(row)}
                            disabled={updatingId === row.config_id}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Zap className="w-3 h-3" />
                            {updatingId === row.config_id ? '...' : `Pas toe`}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-gray-400">Verbruiksdata laden...</div>
      )}
    </div>
  )
}

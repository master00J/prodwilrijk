'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Upload, Download, TrendingUp, ChevronDown, ChevronRight, Plus, Minus, Calendar, RefreshCw, Search, Clock, History } from 'lucide-react'

type ChangeType = 'added' | 'removed' | 'date_change'

interface Snapshot {
  id: string
  snapshot_at: string
  source_files: string[]
  total_records: number
  cnt_added: number
  cnt_removed: number
  cnt_date_change: number
}

interface ForecastChange {
  id: number
  case_label: string
  case_type: string
  old_arrival_date: string | null
  new_arrival_date: string | null
  source_file: string
  change_type: ChangeType
  snapshot_id: string
  changed_at: string
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL')
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function shiftDays(old_date: string | null, new_date: string | null): string {
  if (!old_date || !new_date) return '—'
  const diff = Math.round((new Date(new_date).getTime() - new Date(old_date).getTime()) / 86400000)
  if (diff === 0) return '0 dagen'
  return diff > 0 ? `+${diff} dagen` : `${diff} dagen`
}

const CHANGE_COLORS: Record<ChangeType, { bg: string; text: string; badge: string; icon: string; label: string }> = {
  added:       { bg: 'bg-green-50',  text: 'text-green-800',  badge: 'bg-green-100 text-green-800',  icon: '🟢', label: 'Nieuw' },
  removed:     { bg: 'bg-red-50',    text: 'text-red-800',    badge: 'bg-red-100 text-red-800',      icon: '🔴', label: 'Verwijderd' },
  date_change: { bg: 'bg-orange-50', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800',icon: '🟠', label: 'Datum' },
}

export default function ForecastTab() {
  const [forecastData, setForecastData] = useState<any[]>([])
  const [pilsOnlyData, setPilsOnlyData] = useState<any[]>([])
  const [countOnPils, setCountOnPils] = useState(0)
  const [countPilsOnly, setCountPilsOnly] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Collapsible secties
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    upload: true,
    historiek: true,
    wijzigingen: true,
    historiekOverzicht: false,
    huidig: true,
  })
  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Snapshot systeem
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [snapshotChanges, setSnapshotChanges] = useState<ForecastChange[]>([])
  const [changesLoading, setChangesLoading] = useState(false)
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeType | 'all'>('all')
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set())
  const [lastUploadResult, setLastUploadResult] = useState<{ added: number; removed: number; date_change: number } | null>(null)

  const loadForecast = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      const res = await fetch(`/api/grote-inpak/forecast?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const result = await res.json()
        setForecastData(result.data || [])
        setPilsOnlyData(result.pils_only || [])
        setCountOnPils(Number(result.count_already_on_pils) || 0)
        setCountPilsOnly(Number(result.count_pils_only) || 0)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  const loadSnapshots = useCallback(async () => {
    setSnapshotsLoading(true)
    try {
      const res = await fetch('/api/grote-inpak/forecast-snapshots')
      if (res.ok) {
        const result = await res.json()
        setSnapshots(result.data || [])
        // Auto-select meest recente snapshot
        if (result.data?.length > 0 && !selectedSnapshotId) {
          setSelectedSnapshotId(result.data[0].id)
        }
      }
    } catch { /* ignore */ } finally {
      setSnapshotsLoading(false)
    }
  }, [selectedSnapshotId])

  const loadSnapshotChanges = useCallback(async (snapshotId: string) => {
    setChangesLoading(true)
    try {
      const res = await fetch(`/api/grote-inpak/forecast-changes?snapshot_id=${snapshotId}`)
      if (res.ok) {
        const result = await res.json()
        setSnapshotChanges(result.data || [])
      }
    } catch { /* ignore */ } finally {
      setChangesLoading(false)
    }
  }, [])

  useEffect(() => { loadForecast() }, [loadForecast])
  useEffect(() => { loadSnapshots() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedSnapshotId) loadSnapshotChanges(selectedSnapshotId)
  }, [selectedSnapshotId, loadSnapshotChanges])

  const handleFileSelect = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const valid = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.csv'))
    if (valid.length === 0) { alert('Ongeldig bestandstype. Verwacht: .csv'); return }
    setSelectedFiles(valid)
  }

  const handleFileUpload = async (files: File[]) => {
    if (!files?.length) return
    setLoading(true)
    setLastUploadResult(null)
    try {
      const allRows: any[] = []
      const errors: string[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileType', 'forecast')
        const uploadRes = await fetch('/api/grote-inpak/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const result = await uploadRes.json()
          allRows.push(...(result.data || []))
        } else {
          const err = await uploadRes.json()
          errors.push(`${file.name}: ${err.error || 'Upload mislukt'}`)
        }
      }

      if (allRows.length > 0) {
        const saveRes = await fetch('/api/grote-inpak/forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            forecastData: allRows,
            replace: true,
            uploadedFileNames: files.map((f) => f.name),
          }),
        })
        if (!saveRes.ok) {
          const err = await saveRes.json()
          throw new Error(err.error || 'Opslaan mislukt')
        }
        const saveResult = await saveRes.json()
        if (saveResult.changes) {
          setLastUploadResult(saveResult.changes)
          setSelectedSnapshotId(saveResult.snapshot_id)
        }
        window.dispatchEvent(new CustomEvent('grote-inpak-upload-log-refresh'))
      }

      await loadForecast()
      await loadSnapshots()
      setSelectedFiles([])

      if (errors.length > 0) alert(`Sommige bestanden faalden:\n${errors.join('\n')}`)
    } catch (err: any) {
      alert(`Fout bij uploaden: ${err.message || 'Onbekende fout'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) handleFileSelect(e.dataTransfer.files)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const downloadForecastMatrix = async (location: 'Genk' | 'Wilrijk' | 'Alle') => {
    try {
      const res = await fetch('/api/grote-inpak/forecast-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, dateFrom: dateFrom || null, dateTo: dateTo || null }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Export mislukt') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date()
      const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
      const locLabel = location === 'Alle' ? 'Alle locaties' : location
      a.href = url; a.download = `Forecast ${locLabel} ${todayStr}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Forecast export mislukt: ${err.message}`)
    }
  }

  const matchesSearch = (item: { case_label?: string; case_type?: string; source_file?: string }) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      String(item.case_label || '').toLowerCase().includes(q) ||
      String(item.case_type || '').toLowerCase().includes(q) ||
      String(item.source_file || '').toLowerCase().includes(q)
    )
  }

  const filteredForecast = forecastData.filter(matchesSearch)
  const filteredPilsOnly = pilsOnlyData.filter(matchesSearch)
  const totalVisible = filteredForecast.length + filteredPilsOnly.length

  // ── HISTORIEK OVERZICHT (alle caselabels) ──
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'Alle' | 'C' | 'K'>('Alle')
  const [historyOnlyChanged, setHistoryOnlyChanged] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (historySearch) params.set('search', historySearch)
      if (historyTypeFilter !== 'Alle') params.set('case_type', historyTypeFilter)
      if (historyOnlyChanged) params.set('only_changed', '1')
      const res = await fetch(`/api/grote-inpak/forecast-history?${params}`)
      if (res.ok) {
        const result = await res.json()
        setHistoryData(result.data || [])
        setHistoryLoaded(true)
      }
    } catch { /* ignore */ } finally {
      setHistoryLoading(false)
    }
  }, [historySearch, historyTypeFilter, historyOnlyChanged])

  // Case label historiek lookup
  const [caseLabelSearch, setCaseLabelSearch] = useState('')
  const [caseLabelHistory, setCaseLabelHistory] = useState<ForecastChange[]>([])
  const [caseLabelLoading, setCaseLabelLoading] = useState(false)
  const [caseLabelSearched, setCaseLabelSearched] = useState('')

  const loadCaseLabelHistory = useCallback(async (label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    setCaseLabelLoading(true)
    setCaseLabelSearched(trimmed)
    try {
      const res = await fetch(`/api/grote-inpak/forecast-changes?case_label=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        const result = await res.json()
        setCaseLabelHistory(result.data || [])
      }
    } catch { /* ignore */ } finally {
      setCaseLabelLoading(false)
    }
  }, [])

  // Gefilterde wijzigingen voor geselecteerde snapshot
  const filteredChanges = useMemo(() => {
    if (changeTypeFilter === 'all') return snapshotChanges
    return snapshotChanges.filter(c => c.change_type === changeTypeFilter)
  }, [snapshotChanges, changeTypeFilter])

  const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId)

  return (
    <div className="space-y-4">
      {/* Header + globale zoekbalk + export knoppen */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold">📈 Forecast</h2>
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Zoek caselabel, type, bestand..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-60"
            />
          </div>
          <button
            onClick={() => downloadForecastMatrix('Genk')}
            disabled={forecastData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Matrix Genk
          </button>
          <button
            onClick={() => downloadForecastMatrix('Wilrijk')}
            disabled={forecastData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Matrix Wilrijk
          </button>
          <button
            onClick={() => downloadForecastMatrix('Alle')}
            disabled={forecastData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm disabled:opacity-50 font-medium"
          >
            <Download className="w-4 h-4" /> Matrix Alle locaties
          </button>
        </div>
      </div>

      {/* ── UPLOAD SECTIE ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('upload')}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" /> Forecast uploaden
          </span>
          {openSections.upload ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {openSections.upload && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-50 scale-105'
                : selectedFiles.length > 0 ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-blue-400'
              }`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <Upload className={`w-10 h-10 mx-auto mb-2 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="font-medium mb-1">Forecast CSV</p>
              {selectedFiles.length > 0 ? (
                <p className="text-sm text-green-700 font-semibold mb-3">{selectedFiles.length} bestand(en) geselecteerd</p>
              ) : (
                <p className="text-sm text-gray-500 mb-3">Sleep bestanden hierheen of klik om te selecteren</p>
              )}
              <input type="file" accept=".csv" className="hidden" id="forecast-upload" multiple onChange={e => handleFileSelect(e.target.files)} />
              <div className="flex gap-2 justify-center">
                <label htmlFor="forecast-upload" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
                  {selectedFiles.length > 0 ? 'Wijzig bestanden' : 'Selecteer bestanden'}
                </label>
                {selectedFiles.length > 0 && (
                  <button
                    onClick={() => handleFileUpload(selectedFiles)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Uploaden...' : 'Upload'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Upload alle forecast-CSV’s tegelijk. <strong>FOR####</strong>: kolom A datum, B caselabel, C casetype.
                <strong> FORESCO</strong>: A datum, E caselabel, F casetype.
              </p>
            </div>

            {lastUploadResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-4 items-center">
                <p className="font-semibold text-gray-700 mr-2">Laatste upload:</p>
                <span className="flex items-center gap-1.5 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  <Plus className="w-3.5 h-3.5" /> {lastUploadResult.added} nieuw
                </span>
                <span className="flex items-center gap-1.5 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  <Minus className="w-3.5 h-3.5" /> {lastUploadResult.removed} verwijderd
                </span>
                <span className="flex items-center gap-1.5 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" /> {lastUploadResult.date_change} datumwijzigingen
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CASE LABEL HISTORIEK ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('historiek')}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" /> Datumhistoriek per caselabel
          </span>
          {openSections.historiek ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {openSections.historiek && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={caseLabelSearch}
              onChange={e => setCaseLabelSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadCaseLabelHistory(caseLabelSearch)}
              placeholder="Bv. WLB-2026-04-K80-001"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={() => loadCaseLabelHistory(caseLabelSearch)}
              disabled={caseLabelLoading || !caseLabelSearch.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {caseLabelLoading ? 'Laden...' : 'Opzoeken'}
            </button>
          </div>

        {caseLabelSearched && !caseLabelLoading && (
          <div className="mt-0">
            {caseLabelHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Geen historiek gevonden voor <strong>{caseLabelSearched}</strong>.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wide">
                  {caseLabelHistory.length} wijziging(en) gevonden voor <span className="text-gray-800 font-semibold">{caseLabelSearched}</span>
                </p>
                {/* Tijdlijn */}
                <div className="relative">
                  {/* Verticale lijn */}
                  <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-4">
                    {caseLabelHistory.map((c, i) => {
                      const style = CHANGE_COLORS[c.change_type]
                      const isFirst = i === 0
                      return (
                        <div key={c.id} className="relative flex items-start gap-4 pl-10">
                          {/* Tijdlijn dot */}
                          <div className={`absolute left-0 w-9 h-9 rounded-full flex items-center justify-center text-base border-2 border-white shadow-sm z-10 ${
                            c.change_type === 'added' ? 'bg-green-100'
                            : c.change_type === 'removed' ? 'bg-red-100'
                            : 'bg-orange-100'
                          }`}>
                            {style.icon}
                          </div>
                          {/* Kaartje */}
                          <div className={`flex-1 rounded-lg border p-3 text-sm ${
                            isFirst ? 'border-purple-200 bg-purple-50' : 'border-gray-100 bg-gray-50'
                          }`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                                {style.icon} {style.label}
                              </span>
                              <span className="text-xs text-gray-400">{fmtTs(c.changed_at)}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                              {c.change_type === 'date_change' ? (
                                <>
                                  <span className="text-gray-500 line-through">{fmtDate(c.old_arrival_date)}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="font-semibold text-gray-900">{fmtDate(c.new_arrival_date)}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    shiftDays(c.old_arrival_date, c.new_arrival_date).startsWith('-')
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {shiftDays(c.old_arrival_date, c.new_arrival_date)}
                                  </span>
                                </>
                              ) : c.change_type === 'added' ? (
                                <span className="font-semibold text-gray-900">Ingepland op {fmtDate(c.new_arrival_date)}</span>
                              ) : (
                                <span className="text-gray-500">Was gepland op {fmtDate(c.old_arrival_date)}</span>
                              )}
                              {c.case_type && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{c.case_type}</span>
                              )}
                            </div>
                            {c.source_file && (
                              <p className="text-xs text-gray-400 mt-1.5">📄 {c.source_file}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>
        )}
      </div>

      {/* ── WIJZIGINGEN PER SNAPSHOT ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center border-b border-gray-100">
          <button
            onClick={() => toggleSection('wijzigingen')}
            className="flex-1 px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Wijzigingen per upload
            </span>
            {openSections.wijzigingen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          <button onClick={loadSnapshots} className="px-4 text-gray-400 hover:text-gray-700 transition-colors">
            <RefreshCw className={`w-4 h-4 ${snapshotsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {openSections.wijzigingen && (snapshots.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nog geen uploads. Upload een forecast CSV om wijzigingen bij te houden.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {snapshots.map(snap => {
              const isExpanded = expandedSnapshots.has(snap.id)
              const isSelected = selectedSnapshotId === snap.id
              const hasChanges = snap.cnt_added + snap.cnt_removed + snap.cnt_date_change > 0

              return (
                <div key={snap.id}>
                  {/* Snapshot header rij */}
                  <div
                    className={`px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected && isExpanded ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setSelectedSnapshotId(snap.id)
                      setExpandedSnapshots(prev => {
                        const next = new Set(prev)
                        isExpanded ? next.delete(snap.id) : next.add(snap.id)
                        return next
                      })
                    }}
                  >
                    <div className="text-gray-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{fmtTs(snap.snapshot_at)}</span>
                        {snap.source_files?.length > 0 && (
                          <span className="text-xs text-gray-400">{snap.source_files.join(', ')}</span>
                        )}
                        <span className="text-xs text-gray-500">{snap.total_records} records</span>
                      </div>
                    </div>
                    {/* Change badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {snap.cnt_added > 0 && (
                        <span className="flex items-center gap-1 bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          <Plus className="w-3 h-3" />{snap.cnt_added}
                        </span>
                      )}
                      {snap.cnt_removed > 0 && (
                        <span className="flex items-center gap-1 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          <Minus className="w-3 h-3" />{snap.cnt_removed}
                        </span>
                      )}
                      {snap.cnt_date_change > 0 && (
                        <span className="flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          <Calendar className="w-3 h-3" />{snap.cnt_date_change}
                        </span>
                      )}
                      {!hasChanges && (
                        <span className="text-xs text-gray-400">Geen wijzigingen</span>
                      )}
                    </div>
                  </div>

                  {/* Uitgevouwen wijzigingen voor deze snapshot */}
                  {isExpanded && isSelected && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {/* Filter knoppen */}
                      <div className="px-5 py-3 flex items-center gap-2">
                        {(['all', 'added', 'removed', 'date_change'] as const).map(type => {
                          const active = changeTypeFilter === type
                          const info = type === 'all' ? { label: 'Alle', badge: 'bg-gray-200 text-gray-700' } : CHANGE_COLORS[type]
                          const count = type === 'all' ? snapshotChanges.length
                            : snapshotChanges.filter(c => c.change_type === type).length
                          return (
                            <button
                              key={type}
                              onClick={() => setChangeTypeFilter(type)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                active ? 'border-gray-400 bg-white shadow-sm' : 'border-transparent hover:bg-gray-200'
                              } ${info.badge}`}
                            >
                              {type === 'all' ? 'Alle' : CHANGE_COLORS[type].label}
                              <span className="font-bold">{count}</span>
                            </button>
                          )
                        })}
                      </div>

                      {changesLoading ? (
                        <div className="px-5 py-6 text-center text-gray-400 text-sm">Laden...</div>
                      ) : filteredChanges.length === 0 ? (
                        <div className="px-5 py-6 text-center text-gray-400 text-sm">Geen wijzigingen in dit filter.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
                                <th className="px-5 py-2 text-left">Type</th>
                                <th className="px-5 py-2 text-left">Case Label</th>
                                <th className="px-4 py-2 text-left">Case Type</th>
                                <th className="px-4 py-2 text-left">Oude datum</th>
                                <th className="px-4 py-2 text-left">Nieuwe datum</th>
                                <th className="px-4 py-2 text-left">Verschuiving</th>
                                <th className="px-4 py-2 text-left">Bronbestand</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredChanges.map((c, i) => {
                                const style = CHANGE_COLORS[c.change_type]
                                return (
                                  <tr key={i} className={`${style.bg} hover:brightness-95 transition-all`}>
                                    <td className="px-5 py-2.5">
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                                        {style.icon} {style.label}
                                      </span>
                                    </td>
                                    <td className="px-5 py-2.5 font-medium text-gray-900">{c.case_label}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{c.case_type || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{fmtDate(c.old_arrival_date)}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{fmtDate(c.new_arrival_date)}</td>
                                    <td className={`px-4 py-2.5 font-medium ${style.text}`}>
                                      {c.change_type === 'date_change' ? shiftDays(c.old_arrival_date, c.new_arrival_date) : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-400 text-xs">{c.source_file || '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── HISTORIEK OVERZICHT ALLE CASELABELS ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center border-b border-gray-100">
          <button
            onClick={() => {
              toggleSection('historiekOverzicht')
              if (!historyLoaded) loadHistory()
            }}
            className="flex-1 px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Datumhistoriek alle caselabels
              {historyData.length > 0 && (
                <span className="text-xs font-normal text-gray-400">({historyData.length} caselabels)</span>
              )}
            </span>
            {openSections.historiekOverzicht ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {openSections.historiekOverzicht && (
            <button onClick={loadHistory} className="px-4 text-gray-400 hover:text-gray-700 transition-colors">
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {openSections.historiekOverzicht && (
          <>
            {/* Filters */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadHistory()}
                  placeholder="Zoek caselabel of type..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-52"
                />
              </div>
              <select
                value={historyTypeFilter}
                onChange={e => setHistoryTypeFilter(e.target.value as 'Alle' | 'C' | 'K')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value="Alle">Alle types</option>
                <option value="C">C-kisten</option>
                <option value="K">K-kisten</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={historyOnlyChanged}
                  onChange={e => setHistoryOnlyChanged(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                Alleen gewijzigde datums
              </label>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                {historyLoading ? 'Laden...' : 'Toepassen'}
              </button>
            </div>

            {!historyLoaded ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Klik op het tabblad om de historiek te laden.
              </div>
            ) : historyLoading ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Laden...</div>
            ) : historyData.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Geen historiek gevonden.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left">Case Label</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Huidige datum</th>
                      <th className="px-4 py-3 text-left">Datumprogressie</th>
                      <th className="px-4 py-3 text-left w-24">Wijzigingen</th>
                      <th className="px-4 py-3 text-left w-28">Totale verschuiving</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.map((row, i) => {
                      const shiftClass =
                        row.shift_days !== null && row.shift_days < -14 ? 'text-red-700 font-semibold' :
                        row.shift_days !== null && row.shift_days < -7  ? 'text-orange-600 font-medium' :
                        row.shift_days !== null && row.shift_days > 14  ? 'text-green-700' :
                        'text-gray-500'
                      const shiftLabel = row.shift_days === null ? '—'
                        : row.shift_days === 0 ? '0 dagen'
                        : row.shift_days > 0 ? `+${row.shift_days} dagen`
                        : `${row.shift_days} dagen`

                      return (
                        <tr key={i} className={`hover:bg-gray-50 ${row.date_count > 0 ? '' : 'opacity-60'}`}>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{row.case_label}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              String(row.case_type).startsWith('C') ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>{row.case_type || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 font-medium">
                            {row.current_date ? new Date(row.current_date).toLocaleDateString('nl-NL') : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.dates.length === 0 ? (
                              <span className="text-gray-300 text-xs">Geen historiek</span>
                            ) : (
                              <div className="flex items-center gap-1 flex-wrap">
                                {row.dates.map((d: string, di: number) => (
                                  <span key={di} className="flex items-center gap-1">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      di === row.dates.length - 1 ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'bg-gray-100 text-gray-500 line-through'
                                    }`}>
                                      {new Date(d).toLocaleDateString('nl-NL')}
                                    </span>
                                    {di < row.dates.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.date_count > 0 ? (
                              <span className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">{row.date_count}×</span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className={`px-4 py-2.5 text-sm ${shiftClass}`}>{shiftLabel}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── HUIDIGE FORECAST DATA ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center border-b border-gray-100">
          <button
            onClick={() => toggleSection('huidig')}
            className="flex-1 px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500" /> Huidige forecast
              {(forecastData.length > 0 || pilsOnlyData.length > 0) && (
                <span className="text-xs font-normal text-gray-400">
                  ({searchQuery ? `${totalVisible} gevonden · ` : ''}
                  {forecastData.length} forecast
                  {countPilsOnly > 0 ? ` + ${countPilsOnly} alleen PILS` : ''}
                  {countOnPils > 0 ? ` · ${countOnPils} forecast al op PILS verborgen` : ''}
                  {forecastData.length > 0 ? ' · forecast-deel = Excel' : ''})
                </span>
              )}
            </span>
            {openSections.huidig ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
        </div>

        {openSections.huidig && <>
        <p className="px-5 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-100 leading-relaxed">
          <strong>Forecast</strong> = onderweg (Atlas), minus labels die al op PILS staan (zelfde basis als Excel-export).{' '}
          <strong>Alleen PILS</strong> = nooit op forecast aangemeld, wel in Willebroek of op trailer — die staan hieronder ook in de lijst.
        </p>
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Zoeken op caselabel, type..."
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-52"
            />
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">Laden...</div>
        ) : totalVisible === 0 ? (
          <div className="py-10 text-center text-gray-400">Geen forecast data. Upload een forecast CSV.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                <tr>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Case Label</th>
                  <th className="px-5 py-3 text-left">Case Type</th>
                  <th className="px-4 py-3 text-left">Aankomstdatum</th>
                  <th className="px-4 py-3 text-left">Bronbestand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredForecast.map((item, i) => (
                  <tr key={`f-${i}`} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        Forecast
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-medium text-gray-900">{item.case_label || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-700">{item.case_type || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{fmtDate(item.arrival_date)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{item.source_file || '—'}</td>
                  </tr>
                ))}
                {filteredPilsOnly.map((item, i) => (
                  <tr key={`p-${i}`} className="hover:bg-amber-50/60 bg-amber-50/30">
                    <td className="px-5 py-2.5">
                      <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        Alleen PILS
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-medium text-gray-900">{item.case_label || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-700">{item.case_type || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{fmtDate(item.arrival_date)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{item.source_file || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </div>
    </div>
  )
}

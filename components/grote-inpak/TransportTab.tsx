'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Download, FileSpreadsheet, Search, Save, LayoutGrid, List, AlertTriangle, CheckCircle, Clock, Truck, Flame, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { GroteInpakCase } from '@/types/database'

interface TransportTabProps {
  transport: any[]
  overview: GroteInpakCase[]
}

interface UrgencyGroup {
  case_type: string
  erp_code: string | null
  description: string | null
  stapel: number
  total_count: number
  oldest_arrival: string | null
  stock_genk: number
  stock_willebroek: number
  stock_wilrijk: number
  stock_in_productie: number
  cases: { case_label: string; arrival_date: string | null; dagen_te_laat: number }[]
}

function addWorkdays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

function urgencyClass(arrivalDate: string | null | undefined): string {
  if (!arrivalDate) return 'text-gray-400'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const arrival = new Date(arrivalDate)
  const diffDays = Math.ceil((arrival.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'text-red-600 font-semibold'
  if (diffDays <= 3) return 'text-orange-600 font-semibold'
  if (diffDays <= 7) return 'text-yellow-700'
  return 'text-gray-700'
}

function urgencyBadge(arrivalDate: string | null | undefined, inWillebroek: boolean) {
  if (inWillebroek) return { label: 'In WB', cls: 'bg-green-100 text-green-800' }
  if (!arrivalDate) return { label: '—', cls: 'bg-gray-100 text-gray-500' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const arrival = new Date(arrivalDate)
  const diffDays = Math.ceil((arrival.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d te laat`, cls: 'bg-red-100 text-red-800' }
  if (diffDays === 0) return { label: 'Vandaag', cls: 'bg-orange-100 text-orange-800' }
  if (diffDays <= 3) return { label: `${diffDays}d`, cls: 'bg-yellow-100 text-yellow-800' }
  return { label: `${diffDays}d`, cls: 'bg-blue-50 text-blue-700' }
}

export default function TransportTab({ transport, overview }: TransportTabProps) {
  const [viewMode, setViewMode] = useState<'planning' | 'urgency' | 'detail'>('planning')
  const [filterStatus, setFilterStatus] = useState<'Alle' | 'In Willebroek' | 'Niet in Willebroek'>('Niet in Willebroek')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [editedData, setEditedData] = useState<Map<string, Partial<GroteInpakCase>>>(new Map())

  // Urgentielijst state
  const [urgencyData, setUrgencyData] = useState<UrgencyGroup[]>([])
  const [urgencyLoading, setUrgencyLoading] = useState(false)
  const [urgencyError, setUrgencyError] = useState<string | null>(null)
  const [expandedUrgency, setExpandedUrgency] = useState<Set<string>>(new Set())
  const [isExportingUrgency, setIsExportingUrgency] = useState(false)

  const loadUrgency = useCallback(async () => {
    setUrgencyLoading(true)
    setUrgencyError(null)
    try {
      const res = await fetch('/api/grote-inpak/genk-urgency')
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Laden mislukt') }
      const result = await res.json()
      setUrgencyData(result.data || [])
    } catch (e: any) {
      setUrgencyError(e.message)
    } finally {
      setUrgencyLoading(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'urgency' && urgencyData.length === 0 && !urgencyLoading) {
      loadUrgency()
    }
  }, [viewMode, urgencyData.length, urgencyLoading, loadUrgency])

  const handleExportUrgency = async () => {
    setIsExportingUrgency(true)
    try {
      const res = await fetch('/api/grote-inpak/genk-urgency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: urgencyData }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Export mislukt') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Urgentielijst_Genk_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Export mislukt: ${e.message}`)
    } finally {
      setIsExportingUrgency(false)
    }
  }
  const [isGenerating, setIsGenerating] = useState(false)

  // Transport = PILS cases, al volledige data — alleen Genk-cases zijn relevant
  const transportWithDetails = useMemo(() => {
    return transport
      .filter((t) => {
        const loc = String(t.productielocatie || '').toLowerCase()
        return loc.includes('genk')
      })
      .map((t) => ({ ...t, ...editedData.get(t.case_label) }))
  }, [transport, editedData])

  // Filters voor de detailweergave
  const filteredTransport = useMemo(() => {
    let filtered = [...transportWithDetails]
    if (filterStatus === 'In Willebroek') filtered = filtered.filter(i => i.in_willebroek === true)
    else if (filterStatus === 'Niet in Willebroek') filtered = filtered.filter(i => i.in_willebroek === false)
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(i => i.arrival_date && new Date(i.arrival_date) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter(i => i.arrival_date && new Date(i.arrival_date) <= to)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(i =>
        i.case_label?.toLowerCase().includes(q) ||
        i.case_type?.toLowerCase().includes(q) ||
        i.item_number?.toLowerCase().includes(q) ||
        i.erp_code?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [transportWithDetails, filterStatus, dateFrom, dateTo, searchQuery])

  // Groepsoverzicht per case_type voor de planningsweergave
  const planningGroups = useMemo(() => {
    const map = new Map<string, {
      case_type: string
      erp_code: string
      stapel: number
      total: number
      inWillebroek: number
      needTransport: number
      nextArrival: string | null
      overdue: number
      thisWeek: number
      labels: string[]
    }>()

    transportWithDetails.forEach(item => {
      if (item.in_willebroek) return // alleen niet-in-WB items in planningsoverzicht
      const key = item.case_type || 'Onbekend'
      const existing = map.get(key)
      const today = new Date(); today.setHours(0,0,0,0)
      const arrival = item.arrival_date ? new Date(item.arrival_date) : null
      const diffDays = arrival ? Math.ceil((arrival.getTime() - today.getTime()) / 86400000) : null
      const isOverdue = diffDays !== null && diffDays < 0
      const isThisWeek = diffDays !== null && diffDays >= 0 && diffDays <= 7

      if (!existing) {
        map.set(key, {
          case_type: key,
          erp_code: item.erp_code || '-',
          stapel: item.stapel || 1,
          total: 1,
          inWillebroek: 0,
          needTransport: 1,
          nextArrival: item.arrival_date || null,
          overdue: isOverdue ? 1 : 0,
          thisWeek: isThisWeek ? 1 : 0,
          labels: [item.case_label],
        })
      } else {
        existing.total++
        existing.needTransport++
        existing.overdue += isOverdue ? 1 : 0
        existing.thisWeek += isThisWeek ? 1 : 0
        existing.labels.push(item.case_label)
        if (item.arrival_date) {
          if (!existing.nextArrival || item.arrival_date < existing.nextArrival) {
            existing.nextArrival = item.arrival_date
          }
        }
      }
    })

    // Voeg ook de items toe die al in WB zijn voor totalen
    transportWithDetails.filter(i => i.in_willebroek).forEach(item => {
      const key = item.case_type || 'Onbekend'
      const existing = map.get(key)
      if (existing) {
        existing.total++
        existing.inWillebroek++
      } else {
        map.set(key, {
          case_type: key,
          erp_code: item.erp_code || '-',
          stapel: item.stapel || 1,
          total: 1,
          inWillebroek: 1,
          needTransport: 0,
          nextArrival: null,
          overdue: 0,
          thisWeek: 0,
          labels: [item.case_label],
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      // Sorteer: eerst overdue, dan thisWeek, dan rest
      if (b.overdue !== a.overdue) return b.overdue - a.overdue
      if (b.thisWeek !== a.thisWeek) return b.thisWeek - a.thisWeek
      return b.needTransport - a.needTransport
    })
  }, [transportWithDetails])

  // Weekoverzicht: volgende 14 dagen, hoeveel komen er aan per dag
  const weekTimeline = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const days: { date: string; label: string; count: number; items: any[] }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const items = transportWithDetails.filter(item =>
        !item.in_willebroek && item.arrival_date === dateStr
      )
      const dayName = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
      days.push({ date: dateStr, label: dayName, count: items.length, items })
    }
    return days.filter(d => d.count > 0)
  }, [transportWithDetails])

  // KPIs
  const totalGenk = transportWithDetails.length
  const inWillebroek = transportWithDetails.filter(i => i.in_willebroek).length
  const needTransport = totalGenk - inWillebroek
  const overdueCount = transportWithDetails.filter(i => {
    if (i.in_willebroek) return false
    if (!i.arrival_date) return false
    const today = new Date(); today.setHours(0,0,0,0)
    return new Date(i.arrival_date) < today
  }).length

  const handleFieldChange = (caseLabel: string, field: keyof GroteInpakCase, value: any) => {
    const newEdited = new Map(editedData)
    newEdited.set(caseLabel, { ...(newEdited.get(caseLabel) || {}), [field]: value })
    setEditedData(newEdited)
  }

  const handleSave = async () => {
    try {
      const updates = Array.from(editedData.entries()).map(([case_label, upd]) => ({ case_label, ...upd }))
      const res = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      setEditedData(new Map())
      alert('Wijzigingen opgeslagen!')
      window.location.reload()
    } catch (err) {
      alert('Fout bij opslaan. Probeer opnieuw.')
    }
  }

  const handleGenerateTransportPlanning = async () => {
    setIsGenerating(true)
    try {
      const stockRes = await fetch('/api/grote-inpak/stock')
      const stockResult = stockRes.ok ? await stockRes.json() : { data: [] }
      const res = await fetch('/api/grote-inpak/transport-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transportData: filteredTransport, stockData: stockResult.data || [] }),
      })
      if (!res.ok) throw new Error('Genereren mislukt')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Transportplanning_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Fout bij genereren transport planning.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadExcel = () => {
    const rows = filteredTransport.map(item => ({
      'Case Label': item.case_label,
      'Case Type': item.case_type,
      'ERP Code': item.erp_code || '',
      'Stapel': item.stapel || 1,
      'Arrival Date': item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('nl-NL') : '',
      'Item Number': item.item_number,
      'In Willebroek': item.in_willebroek ? 'Ja' : 'Nee',
      'Stock Location': item.stock_location,
      'Status': item.status,
      'Comment': item.comment,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transport')
    XLSX.writeFile(wb, `Transport_Genk_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🚚 Transport Planning — Genk → Willebroek</h2>
        {/* View toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('planning')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'planning' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Planningsoverzicht
          </button>
          <button
            onClick={() => setViewMode('urgency')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'urgency' ? 'bg-white shadow text-red-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <Flame className="w-4 h-4" /> Urgentielijst Genk
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'detail' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <List className="w-4 h-4" /> Detail
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase mb-1">
            <Truck className="w-4 h-4" /> Totaal Genk
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalGenk}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 text-xs font-medium uppercase mb-1">
            <CheckCircle className="w-4 h-4" /> Al in Willebroek
          </div>
          <p className="text-3xl font-bold text-green-700">{inWillebroek}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-medium uppercase mb-1">
            <Clock className="w-4 h-4" /> Nog te transporteren
          </div>
          <p className="text-3xl font-bold text-blue-700">{needTransport}</p>
        </div>
        <div className={`rounded-xl p-4 border ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`flex items-center gap-2 text-xs font-medium uppercase mb-1 ${overdueCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
            <AlertTriangle className="w-4 h-4" /> Te laat
          </div>
          <p className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>{overdueCount}</p>
        </div>
      </div>

      {/* Actieknoppen */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={handleSave}
          disabled={editedData.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          <Save className="w-4 h-4" /> Opslaan
        </button>
        <button
          onClick={handleGenerateTransportPlanning}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {isGenerating ? 'Genereren...' : 'Genereer Transport Planning Excel'}
        </button>
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          <Download className="w-4 h-4" /> Download overzicht Excel
        </button>
      </div>

      {/* ── PLANNINGSOVERZICHT ── */}
      {viewMode === 'planning' && (
        <div className="space-y-6">
          {/* Timeline: welke dagen komen er kisten aan */}
          {weekTimeline.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">📅 Aankomsten komende 14 dagen</h3>
              <div className="flex flex-wrap gap-3">
                {weekTimeline.map(day => {
                  const urgCls = urgencyClass(day.date)
                  return (
                    <div key={day.date} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[110px]">
                      <p className={`text-xs font-medium ${urgCls}`}>{day.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-0.5">{day.count}</p>
                      <p className="text-xs text-gray-500">kisten</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Groepstabel per case_type */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Nog te transporteren — per case type</h3>
              <span className="text-sm text-gray-500">{planningGroups.filter(g => g.needTransport > 0).length} types</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                  <tr>
                    <th className="px-5 py-3 text-left">Case Type</th>
                    <th className="px-5 py-3 text-left">ERP Code</th>
                    <th className="px-4 py-3 text-center">Stapel</th>
                    <th className="px-4 py-3 text-center">Totaal</th>
                    <th className="px-4 py-3 text-center">In WB</th>
                    <th className="px-4 py-3 text-center">Te sturen</th>
                    <th className="px-4 py-3 text-center">Te laat</th>
                    <th className="px-4 py-3 text-center">Deze week</th>
                    <th className="px-5 py-3 text-left">Vroegste datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {planningGroups.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                        Geen transport data. Upload een PILS bestand om te beginnen.
                      </td>
                    </tr>
                  )}
                  {planningGroups.map(group => {
                    const badge = urgencyBadge(group.nextArrival, group.needTransport === 0)
                    return (
                      <tr key={group.case_type} className={`hover:bg-gray-50 ${group.overdue > 0 ? 'bg-red-50/40' : ''}`}>
                        <td className="px-5 py-3 font-medium text-gray-900">{group.case_type}</td>
                        <td className="px-5 py-3 text-sm text-gray-600 font-mono">{group.erp_code}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{group.stapel}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">{group.total}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-700 font-medium">{group.inWillebroek}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${group.needTransport > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                            {group.needTransport}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {group.overdue > 0
                            ? <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{group.overdue}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {group.thisWeek > 0
                            ? <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{group.thisWeek}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-3">
                          {group.needTransport > 0 && group.nextArrival ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${urgencyClass(group.nextArrival)}`}>
                                {new Date(group.nextArrival).toLocaleDateString('nl-NL')}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                            </div>
                          ) : <span className="text-gray-300">—</span>}
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

      {/* ── URGENTIELIJST GENK ── */}
      {viewMode === 'urgency' && (
        <div className="space-y-4">
          {/* Header + acties */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-600" /> K-kisten urgentielijst voor Genk
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Gesorteerd op oudste aankomstdatum — kisten die het langst wachten staan bovenaan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadUrgency}
                disabled={urgencyLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 ${urgencyLoading ? 'animate-spin' : ''}`} /> Vernieuwen
              </button>
              <button
                onClick={handleExportUrgency}
                disabled={isExportingUrgency || urgencyData.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isExportingUrgency ? 'Exporteren...' : 'Exporteer naar Excel (sturen naar Genk)'}
              </button>
            </div>
          </div>

          {urgencyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {urgencyError}
            </div>
          )}

          {urgencyLoading ? (
            <div className="py-12 text-center text-gray-400">Laden...</div>
          ) : urgencyData.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              Geen K-kisten gevonden in Genk die nog niet in Willebroek zijn.<br />
              <span className="text-xs">Upload een PILS bestand om te beginnen.</span>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 text-left">Kisttype</th>
                    <th className="px-4 py-3 text-left">Omschrijving</th>
                    <th className="px-4 py-3 text-left">ERP Code</th>
                    <th className="px-4 py-3 text-center">Stapel</th>
                    <th className="px-4 py-3 text-center">Aantal</th>
                    <th className="px-4 py-3 text-left">Vroegste datum</th>
                    <th className="px-4 py-3 text-center">Stock Genk</th>
                    <th className="px-4 py-3 text-center">Stock WB</th>
                    <th className="px-4 py-3 text-center">Stock Wilrijk</th>
                    <th className="px-4 py-3 text-center">In productie</th>
                    <th className="px-3 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {urgencyData.map((group, i) => {
                    const isOverdue = group.cases.some(c => c.dagen_te_laat > 0)
                    const maxOverdue = Math.max(0, ...group.cases.map(c => c.dagen_te_laat || 0))
                    const isExpanded = expandedUrgency.has(group.case_type)
                    return (
                      <>
                        <tr
                          key={group.case_type}
                          className={`hover:bg-gray-50 cursor-pointer ${isOverdue ? 'bg-red-50/50' : ''}`}
                          onClick={() => setExpandedUrgency(prev => {
                            const next = new Set(prev)
                            isExpanded ? next.delete(group.case_type) : next.add(group.case_type)
                            return next
                          })}
                        >
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isOverdue ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{i + 1}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">{group.case_type}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{group.description || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{group.erp_code || '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{group.stapel}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900">{group.total_count}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${urgencyClass(group.oldest_arrival)}`}>
                                {group.oldest_arrival ? new Date(group.oldest_arrival).toLocaleDateString('nl-NL') : '—'}
                              </span>
                              {isOverdue && (
                                <span className="text-xs bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded-full">
                                  {maxOverdue}d te laat
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${group.stock_genk > 0 ? 'text-green-700' : 'text-gray-400'}`}>{group.stock_genk || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${group.stock_willebroek > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{group.stock_willebroek || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${group.stock_wilrijk > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{group.stock_wilrijk || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${group.stock_in_productie > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{group.stock_in_productie || '—'}</span>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                          </td>
                        </tr>
                        {/* Uitgevouwen caselabels */}
                        {isExpanded && group.cases
                          .slice()
                          .sort((a, b) => {
                            if (!a.arrival_date && !b.arrival_date) return 0
                            if (!a.arrival_date) return 1
                            if (!b.arrival_date) return -1
                            return a.arrival_date.localeCompare(b.arrival_date)
                          })
                          .map((c, ci) => (
                            <tr key={`${group.case_type}-${c.case_label}`} className="bg-gray-50/80">
                              <td className="px-3 py-2 text-center text-xs text-gray-400">{ci + 1}</td>
                              <td className="px-4 py-2 text-xs text-gray-500 pl-8" colSpan={2}>
                                <span className="font-mono font-medium text-gray-700">{c.case_label}</span>
                              </td>
                              <td className="px-4 py-2" colSpan={3}></td>
                              <td className="px-4 py-2 text-xs">
                                <span className={urgencyClass(c.arrival_date)}>
                                  {c.arrival_date ? new Date(c.arrival_date).toLocaleDateString('nl-NL') : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center text-xs" colSpan={4}>
                                {c.dagen_te_laat > 0 && (
                                  <span className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded-full text-xs">{c.dagen_te_laat}d te laat</span>
                                )}
                              </td>
                              <td></td>
                            </tr>
                          ))
                        }
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DETAILWEERGAVE ── */}
      {viewMode === 'detail' && (
        <div>
          {/* Filters */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option>Alle</option>
                  <option>In Willebroek</option>
                  <option>Niet in Willebroek</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Van datum</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tot datum</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="inline w-4 h-4 mr-1" />Zoeken
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Case, type, ERP code..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-2">{filteredTransport.length} cases</div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 text-left">Case Label</th>
                    <th className="px-4 py-3 text-left">Case Type</th>
                    <th className="px-4 py-3 text-left">ERP Code</th>
                    <th className="px-4 py-3 text-left">Arrival Date</th>
                    <th className="px-4 py-3 text-center">In WB</th>
                    <th className="px-4 py-3 text-left">Stock Location</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Comment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredTransport.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-400">Geen resultaten.</td>
                    </tr>
                  )}
                  {filteredTransport.map((item) => {
                    const edited = editedData.get(item.case_label) || {}
                    const di = { ...item, ...edited }
                    const urgCls = di.in_willebroek ? 'text-gray-700' : urgencyClass(di.arrival_date)
                    return (
                      <tr key={item.case_label} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{di.case_label}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{di.case_type || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500 font-mono">{di.erp_code || '-'}</td>
                        <td className={`px-4 py-2.5 text-sm ${urgCls}`}>
                          {di.arrival_date ? new Date(di.arrival_date).toLocaleDateString('nl-NL') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={di.in_willebroek || false}
                            onChange={e => handleFieldChange(item.case_label, 'in_willebroek', e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{di.stock_location || '-'}</td>
                        <td className="px-4 py-2.5">
                          <select
                            value={di.status ?? ''}
                            onChange={e => handleFieldChange(item.case_label, 'status', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">-</option>
                            <option>In productie</option>
                            <option>Gereed</option>
                            <option>Verzonden</option>
                            <option>In transit</option>
                            <option>Ontvangen</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={di.comment || ''}
                            onChange={e => handleFieldChange(item.case_label, 'comment', e.target.value)}
                            placeholder="Opmerking..."
                            className="text-sm w-full border border-gray-300 rounded px-2 py-1"
                          />
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

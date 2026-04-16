'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AdminGuard from '@/components/AdminGuard'

interface KistStock {
  id: number
  kistnummer: string
  erp_code: string | null
  huidige_voorraad: number
  minimum_voorraad: number
  te_bestellen: number
}

interface CmrMatch {
  erp_code: string
  kistnummer: string
  description: string | null
  amount: number
  current_stock: number
  stock_id: number
}

interface CmrUnmatched {
  erp_code: string
  description: string | null
  amount: number
}

interface ConsumptionRow {
  kistnummer: string
  consumed: number
  delivered: number
  avg_per_day: number
  suggested_min: number
  current_min: number
  huidige_voorraad: number
}

type Tab = 'stock' | 'verbruik' | 'bestellen'

export default function AirtecKistenStockPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stock')
  const [stock, setStock] = useState<KistStock[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ kistnummer: '', erp_code: '', huidige_voorraad: '', minimum_voorraad: '' })
  const [saving, setSaving] = useState(false)

  // CMR scan state
  const [cmrScanning, setCmrScanning] = useState(false)
  const [cmrMatched, setCmrMatched] = useState<CmrMatch[]>([])
  const [cmrUnmatched, setCmrUnmatched] = useState<CmrUnmatched[]>([])
  const [cmrConfirming, setCmrConfirming] = useState(false)
  const [cmrDone, setCmrDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Verbruik state
  const [consumptionData, setConsumptionData] = useState<ConsumptionRow[]>([])
  const [consumptionDays, setConsumptionDays] = useState(30)
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null)

  // Re-order state
  const [orderNotes, setOrderNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch('/api/airtec-kisten-stock')
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setStock(data || [])
    } catch {
      alert('Fout bij ophalen stock')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStock() }, [fetchStock])

  const fetchConsumption = useCallback(async () => {
    setConsumptionLoading(true)
    try {
      const res = await fetch(`/api/airtec-kisten-stock/consumption?days=${consumptionDays}`)
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setConsumptionData(data || [])
    } catch {
      alert('Fout bij ophalen verbruik')
    } finally {
      setConsumptionLoading(false)
    }
  }, [consumptionDays])

  useEffect(() => {
    if (activeTab === 'verbruik') fetchConsumption()
  }, [activeTab, fetchConsumption])

  const filtered = stock.filter(s => {
    const term = searchTerm.toLowerCase()
    return !term || s.kistnummer.toLowerCase().includes(term) || (s.erp_code || '').toLowerCase().includes(term)
  })

  const itemsToOrder = stock.filter(s => s.te_bestellen > 0).sort((a, b) => b.te_bestellen - a.te_bestellen)
  const totalTeBestellen = stock.reduce((sum, s) => sum + s.te_bestellen, 0)

  // CRUD handlers
  const handleAdd = () => {
    setFormData({ kistnummer: '', erp_code: '', huidige_voorraad: '0', minimum_voorraad: '0' })
    setEditingId(null)
    setShowAddModal(true)
  }

  const handleEdit = (item: KistStock) => {
    setFormData({
      kistnummer: item.kistnummer,
      erp_code: item.erp_code || '',
      huidige_voorraad: String(item.huidige_voorraad),
      minimum_voorraad: String(item.minimum_voorraad),
    })
    setEditingId(item.id)
    setShowAddModal(true)
  }

  const handleSave = async () => {
    if (!formData.kistnummer.trim()) { alert('Kistnummer is verplicht'); return }
    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        kistnummer: formData.kistnummer.trim(),
        erp_code: formData.erp_code.trim() || null,
        huidige_voorraad: Number(formData.huidige_voorraad) || 0,
        minimum_voorraad: Number(formData.minimum_voorraad) || 0,
      }
      const res = await fetch('/api/airtec-kisten-stock', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Opslaan mislukt') }
      setShowAddModal(false)
      fetchStock()
    } catch (err: any) { alert(err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Weet je zeker dat je deze kist wilt verwijderen?')) return
    await fetch(`/api/airtec-kisten-stock?id=${id}`, { method: 'DELETE' })
    fetchStock()
  }

  // CMR file processing (shared by input and drag-drop)
  const processCmrFile = async (file: File) => {
    setCmrScanning(true)
    setCmrMatched([])
    setCmrUnmatched([])
    setCmrDone(false)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mediaType = file.type || 'image/jpeg'
      const res = await fetch('/api/airtec-kisten-stock/scan-cmr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Scan mislukt') }
      const data = await res.json()
      setCmrMatched(data.matched || [])
      setCmrUnmatched(data.unmatched || [])
    } catch (err: any) {
      alert(err.message || 'CMR scan mislukt')
    } finally {
      setCmrScanning(false)
    }
  }

  const handleCmrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processCmrFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processCmrFile(file)
  }

  const handleCmrConfirm = async () => {
    if (cmrMatched.length === 0) return
    setCmrConfirming(true)
    try {
      const res = await fetch('/api/airtec-kisten-stock/confirm-cmr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cmrMatched.map(m => ({ kistnummer: m.kistnummer, amount: m.amount, erp_code: m.erp_code })) }),
      })
      if (!res.ok) throw new Error('Bevestigen mislukt')
      setCmrDone(true)
      fetchStock()
    } catch (err: any) { alert(err.message) } finally { setCmrConfirming(false) }
  }

  const handleCmrReset = () => { setCmrMatched([]); setCmrUnmatched([]); setCmrDone(false) }

  // Apply suggested minimum
  const applySuggestion = async (kistnummer: string, suggested: number) => {
    setApplyingSuggestion(kistnummer)
    try {
      const item = stock.find(s => s.kistnummer === kistnummer)
      if (!item) return
      await fetch('/api/airtec-kisten-stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, minimum_voorraad: suggested }),
      })
      fetchStock()
      fetchConsumption()
    } finally { setApplyingSuggestion(null) }
  }

  // Send re-order email
  const handleSendOrder = async () => {
    if (itemsToOrder.length === 0) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/airtec-kisten-stock/send-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToOrder, notes: orderNotes.trim() || undefined }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Verzenden mislukt') }
      setSendResult('Bestelling verzonden naar prodwilrijk@foresco.eu')
    } catch (err: any) {
      setSendResult(`Fout: ${err.message}`)
    } finally { setSending(false) }
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'stock', label: 'Stock overzicht' },
    { key: 'bestellen', label: 'Bestellen', badge: itemsToOrder.length || undefined },
    { key: 'verbruik', label: 'Verbruik & analyse' },
  ]

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Airtec Kisten Stock</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stock.length} kisten
                {totalTeBestellen > 0 && <span className="ml-2 text-red-600 font-medium">({totalTeBestellen} stuks te bestellen)</span>}
              </p>
            </div>
            <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">
              + Kist toevoegen
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.label}
                {t.badge ? <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{t.badge}</span> : null}
              </button>
            ))}
          </div>

          {/* ============= TAB: STOCK ============= */}
          {activeTab === 'stock' && (
            <>
              {/* Drag & drop CMR zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !cmrScanning && fileInputRef.current?.click()}
                className={`mb-6 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-indigo-500 bg-indigo-50' : cmrScanning ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              >
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleCmrUpload} className="hidden" />
                {cmrScanning ? (
                  <div className="text-indigo-600 font-medium"><span className="animate-pulse">CMR wordt gescand...</span></div>
                ) : (
                  <div>
                    <p className="text-gray-600 font-medium">CMR document uploaden</p>
                    <p className="text-sm text-gray-400 mt-1">Sleep een bestand hierheen of klik om te selecteren (PDF of foto)</p>
                  </div>
                )}
              </div>

              {/* CMR resultaten */}
              {(cmrMatched.length > 0 || cmrUnmatched.length > 0) && (
                <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">{cmrDone ? 'Levering verwerkt' : 'CMR Scan Resultaat'}</h2>
                    <button onClick={handleCmrReset} className="text-sm text-gray-500 hover:text-gray-700">Sluiten</button>
                  </div>
                  {cmrMatched.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-green-700 mb-2">Herkende kisten ({cmrMatched.length})</h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-4">Kist</th><th className="pb-2 pr-4">ERP</th><th className="pb-2 pr-4">Beschrijving</th>
                            <th className="pb-2 pr-4 text-right">Geleverd</th><th className="pb-2 text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cmrMatched.map((m, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-2 pr-4 font-mono font-bold">{m.kistnummer}</td>
                              <td className="py-2 pr-4 text-gray-600">{m.erp_code}</td>
                              <td className="py-2 pr-4 text-gray-500 text-xs">{m.description || '—'}</td>
                              <td className="py-2 pr-4 text-right font-bold text-green-700">+{m.amount}</td>
                              <td className="py-2 text-right text-gray-500">{m.current_stock} &rarr; {m.current_stock + m.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!cmrDone && (
                        <button onClick={handleCmrConfirm} disabled={cmrConfirming}
                          className="mt-4 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm">
                          {cmrConfirming ? 'Verwerken...' : `Bevestig levering (${cmrMatched.length} kisten)`}
                        </button>
                      )}
                    </div>
                  )}
                  {cmrUnmatched.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-amber-700 mb-2">Niet-herkend ({cmrUnmatched.length})</h3>
                      <div className="space-y-1">
                        {cmrUnmatched.map((u, i) => (
                          <div key={i} className="text-sm text-gray-500 flex gap-4">
                            <span className="font-mono">{u.erp_code}</span><span>{u.description || '—'}</span><span className="text-gray-400">({u.amount}x)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Zoek + tabel */}
              <div className="mb-4">
                <input type="text" placeholder="Zoek op kistnummer of ERP code..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-md px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {loading ? <div className="p-8 text-center text-gray-500">Laden...</div> : filtered.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">{stock.length === 0 ? 'Nog geen kisten. Voeg er een toe.' : 'Geen resultaten.'}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3">Kist</th><th className="px-4 py-3">ERP Code</th>
                        <th className="px-4 py-3 text-right">Voorraad</th><th className="px-4 py-3 text-right">Minimum</th>
                        <th className="px-4 py-3 text-right">Te bestellen</th><th className="px-4 py-3 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const isLow = item.huidige_voorraad < item.minimum_voorraad
                        const isEmpty = item.huidige_voorraad === 0 && item.minimum_voorraad > 0
                        return (
                          <tr key={item.id} className={`border-t ${isEmpty ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''} hover:bg-gray-50`}>
                            <td className="px-4 py-3 font-mono font-bold">{item.kistnummer}</td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.erp_code || '—'}</td>
                            <td className={`px-4 py-3 text-right font-bold ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>{item.huidige_voorraad}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{item.minimum_voorraad}</td>
                            <td className="px-4 py-3 text-right">
                              {item.te_bestellen > 0 ? <span className="font-bold text-red-600">{item.te_bestellen}</span> : <span className="text-green-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => handleEdit(item)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Bewerken</button>
                                <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Verwijder</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ============= TAB: BESTELLEN ============= */}
          {activeTab === 'bestellen' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-1">Bestelling stagekisten</h2>
              <p className="text-sm text-gray-500 mb-6">Wordt verzonden naar prodwilrijk@foresco.eu</p>

              {itemsToOrder.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg font-medium">Alles op stock</p>
                  <p className="text-sm mt-1">Er zijn momenteel geen kisten die besteld moeten worden.</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm mb-6">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3">Kist</th><th className="px-4 py-3">ERP Code</th>
                        <th className="px-4 py-3 text-right">Te bestellen</th><th className="px-4 py-3 text-right">Huidige stock</th>
                        <th className="px-4 py-3 text-right">Min. voorraad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsToOrder.map(item => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-3 font-mono font-bold">{item.kistnummer}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.erp_code || '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{item.te_bestellen}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{item.huidige_voorraad}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{item.minimum_voorraad}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 font-bold">
                        <td className="px-4 py-3" colSpan={2}>Totaal</td>
                        <td className="px-4 py-3 text-right text-red-600">{totalTeBestellen}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opmerking (optioneel)</label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Eventuele opmerkingen bij de bestelling..."
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleSendOrder}
                      disabled={sending}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                    >
                      {sending ? 'Verzenden...' : `Bestelling verzenden (${itemsToOrder.length} kisten)`}
                    </button>
                    {sendResult && (
                      <span className={`text-sm font-medium ${sendResult.startsWith('Fout') ? 'text-red-600' : 'text-green-600'}`}>
                        {sendResult}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============= TAB: VERBRUIK ============= */}
          {activeTab === 'verbruik' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Verbruik & analyse</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Periode:</span>
                    {[7, 14, 30, 60, 90].map(d => (
                      <button key={d} onClick={() => setConsumptionDays(d)}
                        className={`px-3 py-1 text-xs rounded-full font-medium ${
                          consumptionDays === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>{d}d</button>
                    ))}
                  </div>
                </div>

                {consumptionLoading ? <div className="py-8 text-center text-gray-500">Laden...</div> : consumptionData.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <p className="font-medium">Nog geen verbruik data</p>
                    <p className="text-sm mt-1">Verbruik wordt automatisch bijgehouden bij het klaarmelden van items.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3">Kist</th>
                        <th className="px-4 py-3 text-right">Verbruikt</th>
                        <th className="px-4 py-3 text-right">Geleverd</th>
                        <th className="px-4 py-3 text-right">Gem./dag</th>
                        <th className="px-4 py-3 text-right">Huidig min.</th>
                        <th className="px-4 py-3 text-right">Suggestie min.</th>
                        <th className="px-4 py-3 text-right">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumptionData.map(row => {
                        const diff = row.suggested_min - row.current_min
                        return (
                          <tr key={row.kistnummer} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-bold">{row.kistnummer}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-medium">{row.consumed}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-medium">{row.delivered}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{row.avg_per_day}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{row.current_min}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold ${diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                {row.suggested_min}
                              </span>
                              {diff !== 0 && <span className="text-xs text-gray-400 ml-1">({diff > 0 ? '+' : ''}{diff})</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {diff !== 0 && (
                                <button
                                  onClick={() => applySuggestion(row.kistnummer, row.suggested_min)}
                                  disabled={applyingSuggestion === row.kistnummer}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                                >
                                  {applyingSuggestion === row.kistnummer ? '...' : 'Toepassen'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                <p className="text-xs text-gray-400 mt-4">
                  Suggestie is gebaseerd op gemiddeld dagverbruik x 10 werkdagen (2 weken buffer).
                </p>
              </div>
            </div>
          )}

          {/* Add/Edit Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">{editingId ? 'Kist bewerken' : 'Kist toevoegen'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kistnummer *</label>
                    <input type="text" value={formData.kistnummer} onChange={(e) => setFormData(f => ({ ...f, kistnummer: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="bijv. 192" disabled={!!editingId} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ERP Code</label>
                    <input type="text" value={formData.erp_code} onChange={(e) => setFormData(f => ({ ...f, erp_code: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="bijv. GP005700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Huidige Voorraad</label>
                      <input type="number" min="0" value={formData.huidige_voorraad} onChange={(e) => setFormData(f => ({ ...f, huidige_voorraad: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Voorraad</label>
                      <input type="number" min="0" value={formData.minimum_voorraad} onChange={(e) => setFormData(f => ({ ...f, minimum_voorraad: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6 justify-end">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Annuleren</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                    {saving ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

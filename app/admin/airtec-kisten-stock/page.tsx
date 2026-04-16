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

export default function AirtecKistenStockPage() {
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const filtered = stock.filter(s => {
    const term = searchTerm.toLowerCase()
    return !term
      || s.kistnummer.toLowerCase().includes(term)
      || (s.erp_code || '').toLowerCase().includes(term)
  })

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
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Opslaan mislukt')
      }
      setShowAddModal(false)
      fetchStock()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Weet je zeker dat je deze kist wilt verwijderen?')) return
    const res = await fetch(`/api/airtec-kisten-stock?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Verwijderen mislukt'); return }
    fetchStock()
  }

  // CMR scan
  const handleCmrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setCmrScanning(true)
    setCmrMatched([])
    setCmrUnmatched([])
    setCmrDone(false)

    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'
      const res = await fetch('/api/airtec-kisten-stock/scan-cmr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })

      if (!res.ok) throw new Error('Scan mislukt')
      const data = await res.json()
      setCmrMatched(data.matched || [])
      setCmrUnmatched(data.unmatched || [])
    } catch (err: any) {
      alert(err.message || 'CMR scan mislukt')
    } finally {
      setCmrScanning(false)
    }
  }

  const handleCmrConfirm = async () => {
    if (cmrMatched.length === 0) return
    setCmrConfirming(true)
    try {
      const res = await fetch('/api/airtec-kisten-stock/confirm-cmr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cmrMatched.map(m => ({
            kistnummer: m.kistnummer,
            amount: m.amount,
            erp_code: m.erp_code,
          })),
        }),
      })
      if (!res.ok) throw new Error('Bevestigen mislukt')
      setCmrDone(true)
      fetchStock()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCmrConfirming(false)
    }
  }

  const handleCmrReset = () => {
    setCmrMatched([])
    setCmrUnmatched([])
    setCmrDone(false)
  }

  const totalTeBestellen = filtered.reduce((sum, s) => sum + s.te_bestellen, 0)

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Airtec Kisten Stock</h1>
              <p className="text-sm text-gray-500 mt-1">
                Beheer voorraad van stagekisten — {stock.length} kisten
                {totalTeBestellen > 0 && (
                  <span className="ml-2 text-red-600 font-medium">({totalTeBestellen} stuks te bestellen)</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                onChange={handleCmrUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={cmrScanning}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
              >
                {cmrScanning ? (
                  <><span className="animate-spin">⏳</span> Scannen...</>
                ) : (
                  <><span>📄</span> CMR Scannen</>
                )}
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                + Kist toevoegen
              </button>
            </div>
          </div>

          {/* CMR Scan resultaten */}
          {(cmrMatched.length > 0 || cmrUnmatched.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {cmrDone ? '✅ Levering verwerkt' : '📄 CMR Scan Resultaat'}
                </h2>
                <button onClick={handleCmrReset} className="text-sm text-gray-500 hover:text-gray-700">
                  Sluiten
                </button>
              </div>

              {cmrMatched.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-green-700 mb-2">
                    Herkende kisten ({cmrMatched.length})
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4">Kistnummer</th>
                        <th className="pb-2 pr-4">ERP Code</th>
                        <th className="pb-2 pr-4">Beschrijving</th>
                        <th className="pb-2 pr-4 text-right">Geleverd</th>
                        <th className="pb-2 text-right">Huidige stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cmrMatched.map((m, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-mono font-bold">{m.kistnummer}</td>
                          <td className="py-2 pr-4 text-gray-600">{m.erp_code}</td>
                          <td className="py-2 pr-4 text-gray-500 text-xs">{m.description || '—'}</td>
                          <td className="py-2 pr-4 text-right font-bold text-green-700">+{m.amount}</td>
                          <td className="py-2 text-right text-gray-500">{m.current_stock} → {m.current_stock + m.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!cmrDone && (
                    <button
                      onClick={handleCmrConfirm}
                      disabled={cmrConfirming}
                      className="mt-4 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                    >
                      {cmrConfirming ? 'Verwerken...' : `Bevestig levering (${cmrMatched.length} kisten)`}
                    </button>
                  )}
                </div>
              )}

              {cmrUnmatched.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-amber-700 mb-2">
                    Niet-herkend ({cmrUnmatched.length}) — niet in stockbeheer
                  </h3>
                  <div className="space-y-1">
                    {cmrUnmatched.map((u, i) => (
                      <div key={i} className="text-sm text-gray-500 flex gap-4">
                        <span className="font-mono">{u.erp_code}</span>
                        <span>{u.description || '—'}</span>
                        <span className="text-gray-400">({u.amount} stuks)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Zoekbalk */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Zoek op kistnummer of ERP code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Stock tabel */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Laden...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {stock.length === 0 ? 'Nog geen kisten geconfigureerd. Voeg er een toe.' : 'Geen resultaten gevonden.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3">Kistnummer</th>
                    <th className="px-4 py-3">ERP Code</th>
                    <th className="px-4 py-3 text-right">Huidige Voorraad</th>
                    <th className="px-4 py-3 text-right">Minimum Voorraad</th>
                    <th className="px-4 py-3 text-right">Te Bestellen</th>
                    <th className="px-4 py-3 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isLow = item.huidige_voorraad < item.minimum_voorraad
                    const isEmpty = item.huidige_voorraad === 0 && item.minimum_voorraad > 0
                    return (
                      <tr
                        key={item.id}
                        className={`border-t ${isEmpty ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''} hover:bg-gray-50`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">{item.kistnummer}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.erp_code || '—'}</td>
                        <td className={`px-4 py-3 text-right font-bold ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                          {item.huidige_voorraad}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.minimum_voorraad}</td>
                        <td className="px-4 py-3 text-right">
                          {item.te_bestellen > 0 ? (
                            <span className="font-bold text-red-600">{item.te_bestellen}</span>
                          ) : (
                            <span className="text-green-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEdit(item)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Verwijder
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Add/Edit Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">
                  {editingId ? 'Kist bewerken' : 'Kist toevoegen'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kistnummer *</label>
                    <input
                      type="text"
                      value={formData.kistnummer}
                      onChange={(e) => setFormData(f => ({ ...f, kistnummer: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="bijv. 192"
                      disabled={!!editingId}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ERP Code</label>
                    <input
                      type="text"
                      value={formData.erp_code}
                      onChange={(e) => setFormData(f => ({ ...f, erp_code: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="bijv. GP005700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Huidige Voorraad</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.huidige_voorraad}
                        onChange={(e) => setFormData(f => ({ ...f, huidige_voorraad: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Voorraad</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.minimum_voorraad}
                        onChange={(e) => setFormData(f => ({ ...f, minimum_voorraad: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6 justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
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

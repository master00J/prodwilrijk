'use client'

import { useState, useEffect } from 'react'

interface PrepackUnlistedItem {
  id: number
  item_number: string | null
  quantity: number
  description: string | null
  po_line: string | null
  supplier: string | null
  label_date: string | null
  opmerking: string | null
  status: string
  created_at: string
}

export default function UnlistedItemsSection({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<PrepackUnlistedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/incoming-goods/unlisted')
      if (!res.ok) throw new Error('Ophalen mislukt')
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      fetchItems()
      setExpanded(true)
    }
  }, [refreshKey])

  const handleDelete = async (id: number) => {
    if (!confirm('Dit item verwijderen?')) return
    try {
      const res = await fetch('/api/incoming-goods/unlisted', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }

  const handleResolve = async (id: number) => {
    try {
      const res = await fetch('/api/incoming-goods/unlisted', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Bijwerken mislukt')
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bijwerken mislukt')
    }
  }

  const pendingItems = items.filter(i => i.status === 'pending')

  if (loading && items.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6 border border-amber-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-amber-800">
            Niet in WMS-lijst (andere flow?)
          </h2>
          {pendingItems.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {pendingItems.length}
            </span>
          )}
        </div>
        <span className="text-2xl text-amber-600">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-gray-600 text-sm">
            Items die via de label scanner zijn gescand maar niet in de WMS-import voorkomen.
            Deze kunnen van een andere flow zijn (bijv. Airtec, Grote Inpak, of verkeerd geleverd).
          </p>

          {items.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              Nog geen items. Scan een label om items toe te voegen die niet in de lijst staan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Item Nr</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Omschrijving</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Aantal</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">P.O. Lijn</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Leverancier</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Label datum</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Opmerking</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Gescand op</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-32">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-bold text-gray-900">{item.item_number || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={item.description || ''}>
                        {item.description || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{item.quantity}</td>
                      <td className="px-3 py-2 text-gray-600">{item.po_line || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{item.supplier || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{item.label_date || '—'}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={item.opmerking || ''}>
                        {item.opmerking || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {new Date(item.created_at).toLocaleString('nl-BE', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolve(item.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                            title="Item is opgelost / verwerkt"
                          >
                            Opgelost
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Verwijder
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

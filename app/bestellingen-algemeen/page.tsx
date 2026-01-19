'use client'

import { useEffect, useMemo, useState } from 'react'

type Artikel = {
  id: number
  volledige_omschrijving: string
  artikelnummer: string
}

type OrderItem = {
  id: number
  description: string
  articleNumber: string
  quantity: number
}

export default function BestellingenAlgemeenPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [results, setResults] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(false)
  const [orderList, setOrderList] = useState<OrderItem[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    const run = async () => {
      if (!debouncedSearch) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const response = await fetch(`/api/search_artikels?q=${encodeURIComponent(debouncedSearch)}`)
        if (!response.ok) throw new Error('Zoeken mislukt')
        const data = await response.json()
        setResults(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [debouncedSearch])

  const handleAddToOrder = (artikel: Artikel, quantity: number) => {
    if (quantity <= 0 || Number.isNaN(quantity)) {
      setMessage({ type: 'error', text: 'Aantal moet groter zijn dan 0' })
      return
    }

    setOrderList((prev) => {
      const existing = prev.find((item) => item.id === artikel.id)
      if (existing) {
        return prev.map((item) =>
          item.id === artikel.id ? { ...item, quantity: item.quantity + quantity } : item
        )
      }
      return [
        ...prev,
        {
          id: artikel.id,
          description: artikel.volledige_omschrijving,
          articleNumber: artikel.artikelnummer,
          quantity,
        },
      ]
    })
    setMessage({ type: 'success', text: 'Artikel toegevoegd aan bestelling' })
  }

  const handleRemove = (id: number) => {
    setOrderList((prev) => prev.filter((item) => item.id !== id))
    setMessage({ type: 'success', text: 'Artikel verwijderd uit bestelling' })
  }

  const handleSendOrder = async () => {
    if (orderList.length === 0) {
      setMessage({ type: 'error', text: 'Geen artikelen geselecteerd om te bestellen' })
      return
    }
    try {
      const response = await fetch('/api/plaats_bestelling_algemeen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderList }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Bestelling versturen mislukt')
      }
      setOrderList([])
      setMessage({ type: 'success', text: 'Bestelling succesvol verstuurd' })
    } catch (error: any) {
      console.error('Order error:', error)
      setMessage({ type: 'error', text: error.message || 'Fout bij het versturen' })
    }
  }

  const orderCount = useMemo(() => orderList.reduce((sum, item) => sum + item.quantity, 0), [orderList])

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Bestellingen Algemeen</h1>
        <p className="text-sm text-gray-600">Zoek artikelen en maak een bestel-lijst.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Zoek artikel</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Zoek op artikelomschrijving of artikelnummer..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {loading && <p className="text-sm text-gray-500 mt-2">Artikelen zoeken...</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-lg font-semibold mb-4">Gevonden Artikelen</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Omschrijving</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnummer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aantal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actie</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    {debouncedSearch ? 'Geen artikelen gevonden' : 'Gebruik de zoekbalk om artikelen te zoeken'}
                  </td>
                </tr>
              ) : (
                results.map((artikel) => (
                  <tr key={artikel.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{artikel.volledige_omschrijving}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{artikel.artikelnummer}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        defaultValue={1}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                        id={`qty-${artikel.id}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          const input = document.getElementById(`qty-${artikel.id}`) as HTMLInputElement | null
                          const quantity = input ? Number(input.value) : 1
                          handleAddToOrder(artikel, quantity)
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Toevoegen
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">Te Bestellen Artikelen</div>
          <div className="text-sm text-gray-600">Totaal stuks: {orderCount}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Omschrijving</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnummer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aantal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actie</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Geen artikelen geselecteerd
                  </td>
                </tr>
              ) : (
                orderList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.articleNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSendOrder}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Verstuur Bestelling
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow ${
            message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useMemo, useState } from 'react'
import { WoodStock } from '@/types/database'
import { useWoodOfflineSync } from '@/lib/offline/useWoodOfflineSync'
import { enqueueOutbox } from '@/lib/offline/woodOfflineDb'
import OfflineStatusBanner from '@/components/offline/OfflineStatusBanner'

async function fetchStockFromServer(): Promise<WoodStock[]> {
  const response = await fetch('/api/wood/stock', { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to fetch stock')
  return response.json()
}

export default function WoodPickingPage() {
  const {
    state,
    stock,
    loading,
    refetchFromServer,
    fullSync,
    applyLocalPick,
  } = useWoodOfflineSync({ fetchStock: fetchStockFromServer })

  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof WoodStock | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [edits, setEdits] = useState<Record<number, Partial<WoodStock>>>({})
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())

  const handleSort = (column: keyof WoodStock) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredStock = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return stock
    const compactTerm = term.replace(/\s+/g, '')

    return stock.filter((item) => {
      const dim = `${item.dikte}x${item.breedte}x${item.lengte}`
      const dimStar = `${item.dikte}*${item.breedte}*${item.lengte}`
      const haystack = [
        item.houtsoort,
        item.pakketnummer,
        item.dikte,
        item.breedte,
        item.lengte,
        item.locatie,
        item.aantal,
        dim,
        dimStar,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase()

      if (haystack.includes(term)) return true
      return haystack.replace(/\s+/g, '').includes(compactTerm)
    })
  }, [stock, searchTerm])

  const sortedStock = [...filteredStock].sort((a, b) => {
    if (!sortColumn) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })

  const handlePick = useCallback(
    async (stockItem: WoodStock) => {
      const raw = prompt(`Aantal planken om te picken (max ${stockItem.aantal}):`, String(stockItem.aantal))
      if (raw === null) return
      const amount = Number(raw)
      if (!Number.isFinite(amount) || amount <= 0 || amount > stockItem.aantal) {
        alert('Ongeldig aantal')
        return
      }
      if (!confirm(`Pick ${amount} planken van dit item?`)) return

      // 1. outbox-item wegschrijven (ook als online — zo blijft de flow uniform)
      await enqueueOutbox({
        kind: 'pick',
        stock_id: stockItem.id,
        aantal: amount,
        snapshot: {
          houtsoort: stockItem.houtsoort,
          pakketnummer: stockItem.pakketnummer ?? null,
          locatie: stockItem.locatie,
          dikte: stockItem.dikte,
          breedte: stockItem.breedte,
          lengte: stockItem.lengte,
        },
        client_created_at: new Date().toISOString(),
      })

      // 2. lokale cache direct bijwerken (optimistic)
      await applyLocalPick(stockItem.id, amount)

      // 3. proberen te synchroniseren (lukt online, stille fallback offline)
      void fullSync()
    },
    [applyLocalPick, fullSync]
  )

  const handleFieldChange = (id: number, field: keyof WoodStock, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const handleSaveRow = async (item: WoodStock) => {
    if (!state.online) {
      alert('Bewerken van een rij vereist internet. Picken werkt wél offline.')
      return
    }
    const rowEdits = edits[item.id]
    if (!rowEdits || Object.keys(rowEdits).length === 0) return

    const numericFields: Array<keyof WoodStock> = ['dikte', 'breedte', 'lengte', 'aantal']
    const payload: Partial<WoodStock> = {}

    Object.entries(rowEdits).forEach(([key, value]) => {
      const field = key as keyof WoodStock
      if (numericFields.includes(field)) {
        const numericValue = Number(String(value).replace(',', '.'))
        payload[field] = Number.isFinite(numericValue) ? (numericValue as any) : (item as any)[field]
      } else {
        payload[field] = value as any
      }
    })

    setSavingIds((prev) => new Set(prev).add(item.id))
    try {
      const response = await fetch('/api/wood/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, ...payload }),
      })
      if (!response.ok) throw new Error('Failed to update stock')
      await refetchFromServer()
      setEdits((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Failed to update stock')
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleCancelRow = (id: number) => {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  if (loading && stock.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="bg-white rounded-lg shadow p-6 mb-6 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Wood Picking</h1>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium no-print"
          >
            🖨️ Print volledige lijst
          </button>
        </div>
      </div>

      <div className="no-print">
        <OfflineStatusBanner
          online={state.online}
          pending={state.pending}
          syncing={state.syncing}
          lastSync={state.lastSync}
          errors={state.errors}
          onManualSync={fullSync}
        />
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 no-print">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Zoek op soort, locatie, pakketnummer of 22x100x4500..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('houtsoort')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Wood Type {sortColumn === 'houtsoort' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('pakketnummer')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Package # {sortColumn === 'pakketnummer' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('dikte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Thickness (mm) {sortColumn === 'dikte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('breedte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Width (mm) {sortColumn === 'breedte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('lengte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Length (mm) {sortColumn === 'lengte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('locatie')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Location {sortColumn === 'locatie' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('aantal')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Amount {sortColumn === 'aantal' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No stock found
                  </td>
                </tr>
              ) : (
                sortedStock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 break-words">
                      <input
                        value={(edits[item.id]?.houtsoort as string) ?? item.houtsoort ?? ''}
                        onChange={(e) => handleFieldChange(item.id, 'houtsoort', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={(edits[item.id]?.pakketnummer as string) ?? item.pakketnummer ?? ''}
                        onChange={(e) => handleFieldChange(item.id, 'pakketnummer', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={String((edits[item.id]?.dikte as number | string | undefined) ?? item.dikte ?? '')}
                        onChange={(e) => handleFieldChange(item.id, 'dikte', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={String((edits[item.id]?.breedte as number | string | undefined) ?? item.breedte ?? '')}
                        onChange={(e) => handleFieldChange(item.id, 'breedte', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={String((edits[item.id]?.lengte as number | string | undefined) ?? item.lengte ?? '')}
                        onChange={(e) => handleFieldChange(item.id, 'lengte', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={(edits[item.id]?.locatie as string) ?? item.locatie ?? ''}
                        onChange={(e) => handleFieldChange(item.id, 'locatie', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 break-words">
                      <input
                        value={String((edits[item.id]?.aantal as number | string | undefined) ?? item.aantal ?? '')}
                        onChange={(e) => handleFieldChange(item.id, 'aantal', e.target.value)}
                        disabled={!state.online}
                        className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none disabled:text-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm no-print">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePick(item)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          Pick
                        </button>
                        <button
                          onClick={() => handleSaveRow(item)}
                          disabled={savingIds.has(item.id) || !state.online}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title={state.online ? undefined : 'Bewerken vereist internet'}
                        >
                          Opslaan
                        </button>
                        <button
                          onClick={() => handleCancelRow(item.id)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          Annuleer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

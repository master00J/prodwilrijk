'use client'

export const dynamic = 'force-dynamic'

import AdminGuard from '@/components/AdminGuard'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { StorageRentalCustomer, StorageRentalItem, StorageRentalLocation } from '@/types/database'

const parseNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const toUtcDate = (value: string) => new Date(`${value}T00:00:00Z`)

const getOverlapDays = (
  start: Date | null,
  end: Date | null,
  rangeStart: Date,
  rangeEnd: Date
) => {
  const startMs = Math.max((start || rangeStart).getTime(), rangeStart.getTime())
  const endMs = Math.min((end || rangeEnd).getTime(), rangeEnd.getTime())
  if (endMs < startMs) return 0
  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1
}

export default function StorageRentalsPage() {
  const [customers, setCustomers] = useState<StorageRentalCustomer[]>([])
  const [locations, setLocations] = useState<StorageRentalLocation[]>([])
  const [items, setItems] = useState<StorageRentalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)

  const [editingCustomer, setEditingCustomer] = useState<StorageRentalCustomer | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerNotes] = useState('')

  const [editingLocation, setEditingLocation] = useState<StorageRentalLocation | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locationCapacity, setLocationCapacity] = useState('')
  const [locationNotes] = useState('')

  const [editingItem, setEditingItem] = useState<StorageRentalItem | null>(null)
  const [itemCustomerId, setItemCustomerId] = useState('')
  const [itemLocationId, setItemLocationId] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemM2, setItemM2] = useState('')
  const [itemPricePerM2, setItemPricePerM2] = useState('')
  const [itemStartDate, setItemStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [itemEndDate, setItemEndDate] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [itemActive, setItemActive] = useState(true)

  const [reportCustomerIds, setReportCustomerIds] = useState<string[]>([])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const params = includeInactive ? '?include_inactive=true' : ''
      const [customerRes, locationRes, itemRes] = await Promise.all([
        fetch(`/api/storage-rentals/customers${params}`),
        fetch(`/api/storage-rentals/locations${params}`),
        fetch(`/api/storage-rentals/items${params}`),
      ])

      if (customerRes.ok) {
        const data = await customerRes.json()
        setCustomers(data.customers || [])
      }
      if (locationRes.ok) {
        const data = await locationRes.json()
        setLocations(data.locations || [])
      }
      if (itemRes.ok) {
        const data = await itemRes.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Load error:', error)
      alert('Ophalen mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive])

  const activeItems = useMemo(() => items.filter((item) => item.active !== false), [items])
  const totalUsedM2 = useMemo(
    () => activeItems.reduce((sum, item) => sum + Number(item.m2 || 0), 0),
    [activeItems]
  )
  const totalRevenue = useMemo(
    () =>
      activeItems.reduce(
        (sum, item) => sum + Number(item.m2 || 0) * Number(item.price_per_m2 || 0),
        0
      ),
    [activeItems]
  )
  const totalCapacityM2 = useMemo(
    () =>
      locations
        .filter((location) => location.active !== false)
        .reduce((sum, location) => sum + Number(location.capacity_m2 || 0), 0),
    [locations]
  )
  const occupancy = totalCapacityM2 ? (totalUsedM2 / totalCapacityM2) * 100 : null
  const activeCustomersCount = useMemo(
    () => customers.filter((customer) => customer.active !== false).length,
    [customers]
  )

  const resetCustomerForm = () => {
    setEditingCustomer(null)
    setCustomerName('')
  }

  const resetLocationForm = () => {
    setEditingLocation(null)
    setLocationName('')
    setLocationCapacity('')
  }

  const resetItemForm = () => {
    setEditingItem(null)
    setItemCustomerId('')
    setItemLocationId('')
    setItemDescription('')
    setItemM2('')
    setItemPricePerM2('')
    setItemStartDate(new Date().toISOString().slice(0, 10))
    setItemEndDate('')
    setItemNotes('')
    setItemActive(true)
  }

  const handleCopyItem = (item: StorageRentalItem) => {
    setEditingItem(null)
    setItemCustomerId(item.customer_id ? String(item.customer_id) : '')
    setItemLocationId(item.location_id ? String(item.location_id) : '')
    setItemDescription(item.description || '')
    setItemM2(item.m2?.toString() || '')
    setItemPricePerM2(item.price_per_m2?.toString() || '')
    setItemStartDate(item.start_date || new Date().toISOString().slice(0, 10))
    setItemEndDate(item.end_date || '')
    setItemNotes(item.notes || '')
    setItemActive(item.active !== false)
  }

  type ReportRow = {
    id: number
    customer: string
    description: string
    m2: number
    price: number
    overlapDays: number
    cost: number
    start: string
    end: string
    location: string
  }

  type ReportSummary = {
    error?: string
    totalDays?: number
    totalCost?: number
    averageM2?: number
    occupancyPercent?: number | null
    rows?: ReportRow[]
  }

  const reportSummary = useMemo<ReportSummary | null>(() => {
    if (!reportStartDate || !reportEndDate) {
      return null
    }

    const rangeStart = toUtcDate(reportStartDate)
    const rangeEnd = toUtcDate(reportEndDate)
    if (rangeEnd.getTime() < rangeStart.getTime()) {
      return {
        error: 'Einddatum moet na startdatum liggen.',
      }
    }

    const totalDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1
    if (totalDays <= 0) {
      return {
        error: 'Ongeldige periode.',
      }
    }

    const selectedIds =
      reportCustomerIds.length > 0
        ? reportCustomerIds.map((id) => Number(id))
        : customers.map((customer) => customer.id)
    const customerItems = items.filter((item) => selectedIds.includes(item.customer_id))
    const rows = customerItems
      .map((item) => {
        const itemStart = item.start_date ? toUtcDate(item.start_date) : null
        const itemEnd = item.end_date ? toUtcDate(item.end_date) : null
        const overlapDays = getOverlapDays(itemStart, itemEnd, rangeStart, rangeEnd)
        if (overlapDays <= 0) return null
        const m2 = Number(item.m2 || 0)
        const price = Number(item.price_per_m2 || 0)
        const cost = m2 && price ? (m2 * price * overlapDays) / 365 : 0
        return {
          id: item.id,
          customer:
            item.customer?.name ||
            customers.find((customer) => customer.id === item.customer_id)?.name ||
            '-',
          description: item.description || '',
          m2,
          price,
          overlapDays,
          cost,
          start: item.start_date || '-',
          end: item.end_date || '-',
          location:
            item.location?.name ||
            locations.find((loc) => loc.id === item.location_id)?.name ||
            '-',
        }
      })
      .filter((row): row is ReportRow => row !== null)

    const totalCost = rows.reduce((sum, row) => sum + row.cost, 0)
    const totalM2Days = rows.reduce((sum, row) => sum + row.m2 * row.overlapDays, 0)
    const averageM2 = totalM2Days / totalDays
    const occupancyPercent = totalCapacityM2 ? (averageM2 / totalCapacityM2) * 100 : null

    return {
      totalDays,
      totalCost,
      averageM2,
      occupancyPercent,
      rows,
    }
  }, [reportCustomerIds, reportStartDate, reportEndDate, items, locations, totalCapacityM2, customers])

  const handleExportReportExcel = () => {
    if (!reportSummary || reportSummary.error || !reportSummary.rows) {
      alert('Selecteer eerst een geldige periode.')
      return
    }

    const headers = [
      'Klant',
      'Omschrijving',
      'Locatie',
      'm²',
      'Prijs/m²',
      'Dagen',
      'Start',
      'Einde',
      'Bedrag',
    ]
    const rows = reportSummary.rows.map((row) => [
      row.customer,
      row.description || '-',
      row.location,
      row.m2.toFixed(2),
      row.price ? row.price.toFixed(2) : '-',
      row.overlapDays.toString(),
      row.start,
      row.end,
      row.cost.toFixed(2),
    ])

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rapport')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opslag-rapport_${reportStartDate}_tot_${reportEndDate}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCustomerSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!customerName.trim()) {
      alert('Naam is verplicht')
      return
    }

    const payload = {
      id: editingCustomer?.id,
      name: customerName.trim(),
    }

    const response = await fetch('/api/storage-rentals/customers', {
      method: editingCustomer ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      alert(error.error || 'Klant opslaan mislukt')
      return
    }

    await fetchAll()
    resetCustomerForm()
  }

  const handleLocationSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!locationName.trim()) {
      alert('Naam is verplicht')
      return
    }

    const capacityValue = parseNumber(locationCapacity)
    const payload = {
      id: editingLocation?.id,
      name: locationName.trim(),
      capacity_m2: capacityValue,
    }

    const response = await fetch('/api/storage-rentals/locations', {
      method: editingLocation ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      alert(error.error || 'Locatie opslaan mislukt')
      return
    }

    await fetchAll()
    resetLocationForm()
  }

  const handleItemSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!itemCustomerId) {
      alert('Klant is verplicht')
      return
    }
    const m2Value = parseNumber(itemM2)
    if (!m2Value || m2Value <= 0) {
      alert('Geef een geldig m² in')
      return
    }
    const priceValue = parseNumber(itemPricePerM2)

    const payload = {
      id: editingItem?.id,
      customer_id: Number(itemCustomerId),
      location_id: itemLocationId ? Number(itemLocationId) : null,
      description: itemDescription.trim() || null,
      m2: m2Value,
      price_per_m2: priceValue,
      start_date: itemStartDate || null,
      end_date: itemEndDate || null,
      notes: itemNotes.trim() || null,
      active: itemActive,
    }

    const response = await fetch('/api/storage-rentals/items', {
      method: editingItem ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      alert(error.error || 'Opslag opslaan mislukt')
      return
    }

    await fetchAll()
    resetItemForm()
  }

  const handleStopItem = async (item: StorageRentalItem) => {
    const endDate = item.end_date || new Date().toISOString().slice(0, 10)
    const response = await fetch('/api/storage-rentals/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, active: false, end_date: endDate }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      alert(error.error || 'Opslag stoppen mislukt')
      return
    }
    await fetchAll()
  }

  const handleDelete = async (type: 'customer' | 'location' | 'item', id: number) => {
    if (!confirm('Ben je zeker dat je dit wil verwijderen?')) return
    const response = await fetch(`/api/storage-rentals/${type}s`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      alert(error.error || 'Verwijderen mislukt')
      return
    }
    await fetchAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Laden...</div>
      </div>
    )
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Opslagverhuur</h1>
            <p className="text-sm text-gray-600">Beheer klanten en opslagruimte los van WMS-projecten.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="w-4 h-4"
            />
            Toon inactief
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Actieve klanten</div>
            <div className="text-2xl font-semibold">{activeCustomersCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Bezet m²</div>
            <div className="text-2xl font-semibold">{totalUsedM2.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Rendement</div>
            <div className="text-2xl font-semibold">
              {totalRevenue.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Capaciteit m²</div>
            <div className="text-2xl font-semibold">{totalCapacityM2.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Bezettingsgraad</div>
            <div className="text-2xl font-semibold">
              {occupancy === null ? '-' : `${occupancy.toFixed(1)}%`}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Klant rapport</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Klant</label>
              <select
                multiple
                value={reportCustomerIds}
                onChange={(event) =>
                  setReportCustomerIds(Array.from(event.target.selectedOptions).map((opt) => opt.value))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[140px]"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Geen selectie = alle klanten.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(event) => setReportStartDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einde</label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(event) => setReportEndDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setReportCustomerIds([])
                  setReportStartDate('')
                  setReportEndDate('')
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setReportCustomerIds(customers.map((customer) => String(customer.id)))}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Selecteer alle
              </button>
            </div>
          </div>

          {!reportSummary ? (
            <p className="text-sm text-gray-500">Selecteer een klant en periode om het rapport te tonen.</p>
          ) : reportSummary.error ? (
            <p className="text-sm text-red-600">{reportSummary.error}</p>
          ) : reportSummary.totalDays === undefined ||
            reportSummary.totalCost === undefined ||
            reportSummary.averageM2 === undefined ||
            reportSummary.rows === undefined ? (
            <p className="text-sm text-gray-500">Geen rapportdata beschikbaar.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Periode (dagen)</div>
                  <div className="text-xl font-semibold">{reportSummary.totalDays}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Gem. bezet m²</div>
                  <div className="text-xl font-semibold">{reportSummary.averageM2.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Bezettingsgraad</div>
                  <div className="text-xl font-semibold">
                    {reportSummary.occupancyPercent == null
                      ? '-'
                      : `${reportSummary.occupancyPercent.toFixed(1)}%`}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Te betalen</div>
                  <div className="text-xl font-semibold">
                    {reportSummary.totalCost.toLocaleString('nl-BE', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={handleExportReportExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Exporteer Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Klant</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Omschrijving</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">m²</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prijs/m²</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dagen</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bedrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {reportSummary.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-sm text-gray-500 text-center">
                          Geen records in deze periode.
                        </td>
                      </tr>
                    ) : (
                      reportSummary.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-sm">{row.customer}</td>
                          <td className="px-3 py-2 text-sm">{row.description || '-'}</td>
                          <td className="px-3 py-2 text-sm">{row.location}</td>
                          <td className="px-3 py-2 text-sm">{row.m2.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm">{row.price ? row.price.toFixed(2) : '-'}</td>
                          <td className="px-3 py-2 text-sm">{row.overlapDays}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {row.start} → {row.end}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.cost.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Klanten</h2>
              <span className="text-xs text-gray-500">{customers.length} totaal</span>
            </div>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                {editingCustomer ? 'Klant aanpassen' : 'Nieuwe klant toevoegen'}
              </summary>
              <form onSubmit={handleCustomerSubmit} className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bedrijfsnaam</label>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  {editingCustomer ? 'Bijwerken' : 'Toevoegen'}
                </button>
                {editingCustomer && (
                  <button
                    type="button"
                    onClick={resetCustomerForm}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    Annuleer
                  </button>
                )}
              </form>
            </details>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Klant</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-sm text-gray-500 text-center">
                        Geen klanten
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className={customer.active === false ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 text-sm">{customer.name}</td>
                        <td className="px-3 py-2 text-sm">
                          {customer.active !== false ? 'Actief' : 'Inactief'}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCustomer(customer)
                                setCustomerName(customer.name)
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() =>
                                fetch('/api/storage-rentals/customers', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: customer.id,
                                    active: customer.active === false,
                                  }),
                                }).then(fetchAll)
                              }
                              className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                            >
                              {customer.active === false ? 'Activeer' : 'Deactiveer'}
                            </button>
                            <button
                              onClick={() => handleDelete('customer', customer.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                            >
                              Verwijder
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

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Locaties</h2>
              <span className="text-xs text-gray-500">{locations.length} totaal</span>
            </div>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                {editingLocation ? 'Locatie aanpassen' : 'Nieuwe locatie toevoegen'}
              </summary>
              <form onSubmit={handleLocationSubmit} className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Naam</label>
                  <input
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Capaciteit (m²)</label>
                  <input
                    value={locationCapacity}
                    onChange={(event) => setLocationCapacity(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  {editingLocation ? 'Bijwerken' : 'Toevoegen'}
                </button>
                {editingLocation && (
                  <button
                    type="button"
                    onClick={resetLocationForm}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    Annuleer
                  </button>
                )}
              </form>
            </details>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Capaciteit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-gray-500 text-center">
                        Geen locaties
                      </td>
                    </tr>
                  ) : (
                    locations.map((location) => (
                      <tr key={location.id} className={location.active === false ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 text-sm">{location.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {location.capacity_m2 ? Number(location.capacity_m2).toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {location.active !== false ? 'Actief' : 'Inactief'}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingLocation(location)
                                setLocationName(location.name)
                                setLocationCapacity(location.capacity_m2?.toString() || '')
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() =>
                                fetch('/api/storage-rentals/locations', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: location.id,
                                    active: location.active === false,
                                  }),
                                }).then(fetchAll)
                              }
                              className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                            >
                              {location.active === false ? 'Activeer' : 'Deactiveer'}
                            </button>
                            <button
                              onClick={() => handleDelete('location', location.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                            >
                              Verwijder
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Opslagen</h2>
          <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Klant</label>
              <select
                value={itemCustomerId}
                onChange={(event) => setItemCustomerId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecteer klant</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
              <select
                value={itemLocationId}
                onChange={(event) => setItemLocationId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Geen locatie</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">m²</label>
              <input
                value={itemM2}
                onChange={(event) => setItemM2(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prijs/m²</label>
              <input
                value={itemPricePerM2}
                onChange={(event) => setItemPricePerM2(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actief</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={itemActive}
                  onChange={(event) => setItemActive(event.target.checked)}
                  className="w-4 h-4"
                />
                Actief
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
              <input
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                type="date"
                value={itemStartDate}
                onChange={(event) => setItemStartDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einde</label>
              <input
                type="date"
                value={itemEndDate}
                onChange={(event) => setItemEndDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
              <input
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-6 flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingItem ? 'Opslag bijwerken' : 'Opslag toevoegen'}
              </button>
              {editingItem && (
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Annuleer
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Klant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Omschrijving</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">m²</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prijs/m²</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rendement</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-4 text-sm text-gray-500 text-center">
                      Geen opslagrecords
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className={item.active === false ? 'bg-gray-50' : ''}>
                      <td className="px-3 py-2 text-sm">
                        {item.customer?.name || customers.find((c) => c.id === item.customer_id)?.name || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {item.location?.name || locations.find((l) => l.id === item.location_id)?.name || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{item.description || '-'}</td>
                      <td className="px-3 py-2 text-sm">{item.m2 ? Number(item.m2).toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-sm">
                        {item.price_per_m2 ? Number(item.price_per_m2).toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {item.m2 && item.price_per_m2
                          ? (Number(item.m2) * Number(item.price_per_m2)).toFixed(2)
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {item.start_date || '-'} → {item.end_date || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {item.active !== false ? 'Actief' : 'Gestopt'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyItem(item)}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                          >
                            Kopieer
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item)
                              setItemCustomerId(item.customer_id ? String(item.customer_id) : '')
                              setItemLocationId(item.location_id ? String(item.location_id) : '')
                              setItemDescription(item.description || '')
                              setItemM2(item.m2?.toString() || '')
                              setItemPricePerM2(item.price_per_m2?.toString() || '')
                              setItemStartDate(item.start_date || new Date().toISOString().slice(0, 10))
                              setItemEndDate(item.end_date || '')
                              setItemNotes(item.notes || '')
                              setItemActive(item.active !== false)
                            }}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                          >
                            Bewerken
                          </button>
                          {item.active !== false && (
                            <button
                              onClick={() => handleStopItem(item)}
                              className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                            >
                              Stop
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete('item', item.id)}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                          >
                            Verwijder
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
    </AdminGuard>
  )
}

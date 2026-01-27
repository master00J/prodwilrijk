'use client'

export const dynamic = 'force-dynamic'

import AdminGuard from '@/components/AdminGuard'
import { useEffect, useMemo, useState } from 'react'
import type { StorageRentalCustomer, StorageRentalItem, StorageRentalLocation } from '@/types/database'

const parseNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export default function StorageRentalsPage() {
  const [customers, setCustomers] = useState<StorageRentalCustomer[]>([])
  const [locations, setLocations] = useState<StorageRentalLocation[]>([])
  const [items, setItems] = useState<StorageRentalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)

  const [editingCustomer, setEditingCustomer] = useState<StorageRentalCustomer | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [customerActive, setCustomerActive] = useState(true)

  const [editingLocation, setEditingLocation] = useState<StorageRentalLocation | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locationCapacity, setLocationCapacity] = useState('')
  const [locationNotes, setLocationNotes] = useState('')
  const [locationActive, setLocationActive] = useState(true)

  const [editingItem, setEditingItem] = useState<StorageRentalItem | null>(null)
  const [itemCustomerId, setItemCustomerId] = useState('')
  const [itemLocationId, setItemLocationId] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemM2, setItemM2] = useState('')
  const [itemStartDate, setItemStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [itemEndDate, setItemEndDate] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [itemActive, setItemActive] = useState(true)

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
    setCustomerNotes('')
    setCustomerActive(true)
  }

  const resetLocationForm = () => {
    setEditingLocation(null)
    setLocationName('')
    setLocationCapacity('')
    setLocationNotes('')
    setLocationActive(true)
  }

  const resetItemForm = () => {
    setEditingItem(null)
    setItemCustomerId('')
    setItemLocationId('')
    setItemDescription('')
    setItemM2('')
    setItemStartDate(new Date().toISOString().slice(0, 10))
    setItemEndDate('')
    setItemNotes('')
    setItemActive(true)
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
      notes: customerNotes.trim() || null,
      active: customerActive,
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
      notes: locationNotes.trim() || null,
      active: locationActive,
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

    const payload = {
      id: editingItem?.id,
      customer_id: Number(itemCustomerId),
      location_id: itemLocationId ? Number(itemLocationId) : null,
      description: itemDescription.trim() || null,
      m2: m2Value,
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Klanten</h2>
            <form onSubmit={handleCustomerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrijfsnaam</label>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actief</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={customerActive}
                    onChange={(event) => setCustomerActive(event.target.checked)}
                    className="w-4 h-4"
                  />
                  Actief
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
                <input
                  value={customerNotes}
                  onChange={(event) => setCustomerNotes(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCustomer ? 'Klant bijwerken' : 'Klant toevoegen'}
                </button>
                {editingCustomer && (
                  <button
                    type="button"
                    onClick={resetCustomerForm}
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
                                setCustomerNotes(customer.notes || '')
                                setCustomerActive(customer.active !== false)
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

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Locaties</h2>
            <form onSubmit={handleLocationSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capaciteit (m²)</label>
                <input
                  value={locationCapacity}
                  onChange={(event) => setLocationCapacity(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actief</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={locationActive}
                    onChange={(event) => setLocationActive(event.target.checked)}
                    className="w-4 h-4"
                  />
                  Actief
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
                <input
                  value={locationNotes}
                  onChange={(event) => setLocationNotes(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingLocation ? 'Locatie bijwerken' : 'Locatie toevoegen'}
                </button>
                {editingLocation && (
                  <button
                    type="button"
                    onClick={resetLocationForm}
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
                                setLocationNotes(location.notes || '')
                                setLocationActive(location.active !== false)
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-sm text-gray-500 text-center">
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
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {item.start_date || '-'} → {item.end_date || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {item.active !== false ? 'Actief' : 'Gestopt'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item)
                              setItemCustomerId(item.customer_id ? String(item.customer_id) : '')
                              setItemLocationId(item.location_id ? String(item.location_id) : '')
                              setItemDescription(item.description || '')
                              setItemM2(item.m2?.toString() || '')
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type StockStatus = 'in_stock' | 'reserved' | 'shipped' | 'damaged'

type WeertCustomer = {
  id: number
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
  active: boolean
}

type WeertStockItem = {
  id: number
  customer_id?: number | null
  customer?: WeertCustomer | null
  item_code?: string | null
  description: string
  pallet_or_package?: string | null
  quantity: number
  unit: string
  location?: string | null
  status: StockStatus
  received_at?: string | null
  last_counted_at?: string | null
  notes?: string | null
}

const STATUS_OPTIONS: { value: StockStatus; label: string; className: string }[] = [
  { value: 'in_stock', label: 'Op stock', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'reserved', label: 'Gereserveerd', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'shipped', label: 'Verzonden', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'damaged', label: 'Beschadigd', className: 'bg-red-50 text-red-700 border-red-200' },
]

const emptyCustomerForm = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  notes: '',
  active: true,
}

const emptyItemForm = {
  customer_id: '',
  item_code: '',
  description: '',
  pallet_or_package: '',
  quantity: '1',
  unit: 'stuks',
  location: '',
  status: 'in_stock' as StockStatus,
  received_at: '',
  last_counted_at: '',
  notes: '',
}

export default function WeertStockPage() {
  const [customers, setCustomers] = useState<WeertCustomer[]>([])
  const [items, setItems] = useState<WeertStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (customerFilter) params.set('customerId', customerFilter)
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/admin/weert-stock?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Weert stock laden mislukt')
      setCustomers(data.customers || [])
      setItems(data.items || [])
    } catch (err: any) {
      setError(err.message || 'Weert stock laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [customerFilter, search, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.lines += 1
        acc.quantity += Number(item.quantity) || 0
        acc.customers.add(item.customer_id || 0)
        if (item.status === 'reserved') acc.reserved += Number(item.quantity) || 0
        if (item.status === 'damaged') acc.damaged += Number(item.quantity) || 0
        return acc
      },
      { lines: 0, quantity: 0, reserved: 0, damaged: 0, customers: new Set<number>() }
    )
  }, [items])

  const activeCustomers = customers.filter(customer => customer.active)

  const resetCustomerForm = () => {
    setEditingCustomerId(null)
    setCustomerForm(emptyCustomerForm)
  }

  const resetItemForm = () => {
    setEditingItemId(null)
    setItemForm(emptyItemForm)
  }

  const saveCustomer = async () => {
    if (!customerForm.name.trim()) {
      alert('Klantnaam is verplicht')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/weert-stock', {
        method: editingCustomerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'customer',
          ...(editingCustomerId ? { id: editingCustomerId } : {}),
          ...customerForm,
          name: customerForm.name.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Klant opslaan mislukt')
      resetCustomerForm()
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Klant opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const saveItem = async () => {
    if (!itemForm.description.trim()) {
      alert('Omschrijving is verplicht')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/weert-stock', {
        method: editingItemId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'item',
          ...(editingItemId ? { id: editingItemId } : {}),
          ...itemForm,
          customer_id: itemForm.customer_id || null,
          quantity: Number(itemForm.quantity) || 0,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Stocklijn opslaan mislukt')
      resetItemForm()
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Stocklijn opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const editCustomer = (customer: WeertCustomer) => {
    setEditingCustomerId(customer.id)
    setCustomerForm({
      name: customer.name || '',
      contact_name: customer.contact_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
      active: customer.active,
    })
  }

  const editItem = (item: WeertStockItem) => {
    setEditingItemId(item.id)
    setItemForm({
      customer_id: item.customer_id ? String(item.customer_id) : '',
      item_code: item.item_code || '',
      description: item.description || '',
      pallet_or_package: item.pallet_or_package || '',
      quantity: String(item.quantity ?? 0),
      unit: item.unit || 'stuks',
      location: item.location || '',
      status: item.status || 'in_stock',
      received_at: item.received_at || '',
      last_counted_at: item.last_counted_at || '',
      notes: item.notes || '',
    })
  }

  const deleteRow = async (type: 'customer' | 'item', id: number) => {
    const label = type === 'customer' ? 'klant' : 'stocklijn'
    if (!confirm(`Weet je zeker dat je deze ${label} wilt verwijderen?`)) return
    try {
      const response = await fetch(`/api/admin/weert-stock?type=${type}&id=${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Verwijderen mislukt')
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Verwijderen mislukt')
    }
  }

  const statusMeta = (status: StockStatus) =>
    STATUS_OPTIONS.find(option => option.value === status) || STATUS_OPTIONS[0]

  return (
    <AdminGuard>
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weert Stockbeheer</h1>
            <p className="mt-1 text-sm text-gray-500">
              Beheer stocklijnen voor locatie Weert, inclusief klant, rek/locatie, status en opmerkingen.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Vernieuwen'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Stocklijnen</div>
            <div className="mt-1 text-2xl font-bold text-blue-900">{summary.lines}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Totaal aantal</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">{summary.quantity}</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Gereserveerd</div>
            <div className="mt-1 text-2xl font-bold text-amber-900">{summary.reserved}</div>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Klanten</div>
            <div className="mt-1 text-2xl font-bold text-purple-900">{customers.length}</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingCustomerId ? 'Klant bewerken' : 'Klant toevoegen'}
            </h2>
            <div className="mt-4 space-y-3">
              <input
                value={customerForm.name}
                onChange={event => setCustomerForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Klantnaam *"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={customerForm.contact_name}
                onChange={event => setCustomerForm(prev => ({ ...prev, contact_name: event.target.value }))}
                placeholder="Contactpersoon"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={customerForm.email}
                  onChange={event => setCustomerForm(prev => ({ ...prev, email: event.target.value }))}
                  placeholder="E-mail"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <input
                  value={customerForm.phone}
                  onChange={event => setCustomerForm(prev => ({ ...prev, phone: event.target.value }))}
                  placeholder="Telefoon"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <textarea
                value={customerForm.notes}
                onChange={event => setCustomerForm(prev => ({ ...prev, notes: event.target.value }))}
                placeholder="Klantnotities"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={customerForm.active}
                  onChange={event => setCustomerForm(prev => ({ ...prev, active: event.target.checked }))}
                />
                Actieve klant
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveCustomer}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingCustomerId ? 'Klant opslaan' : 'Klant toevoegen'}
                </button>
                {editingCustomerId && (
                  <button
                    type="button"
                    onClick={resetCustomerForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingItemId ? 'Stocklijn bewerken' : 'Stocklijn toevoegen'}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                value={itemForm.customer_id}
                onChange={event => setItemForm(prev => ({ ...prev, customer_id: event.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Geen klant gekoppeld</option>
                {activeCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
              <input
                value={itemForm.item_code}
                onChange={event => setItemForm(prev => ({ ...prev, item_code: event.target.value }))}
                placeholder="Artikelcode / referentie"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={itemForm.description}
                onChange={event => setItemForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Omschrijving *"
                className="md:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={itemForm.pallet_or_package}
                onChange={event => setItemForm(prev => ({ ...prev, pallet_or_package: event.target.value }))}
                placeholder="Pallet / pakketnummer"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={itemForm.location}
                onChange={event => setItemForm(prev => ({ ...prev, location: event.target.value }))}
                placeholder="Rek / locatie in Weert"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  value={itemForm.quantity}
                  onChange={event => setItemForm(prev => ({ ...prev, quantity: event.target.value }))}
                  placeholder="Aantal"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <input
                  value={itemForm.unit}
                  onChange={event => setItemForm(prev => ({ ...prev, unit: event.target.value }))}
                  placeholder="Eenheid"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={itemForm.status}
                onChange={event => setItemForm(prev => ({ ...prev, status: event.target.value as StockStatus }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={itemForm.received_at}
                  onChange={event => setItemForm(prev => ({ ...prev, received_at: event.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  title="Ontvangen op"
                />
                <input
                  type="date"
                  value={itemForm.last_counted_at}
                  onChange={event => setItemForm(prev => ({ ...prev, last_counted_at: event.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  title="Laatst geteld"
                />
              </div>
              <textarea
                value={itemForm.notes}
                onChange={event => setItemForm(prev => ({ ...prev, notes: event.target.value }))}
                placeholder="Interne notities"
                rows={3}
                className="md:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={saveItem}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {editingItemId ? 'Stocklijn opslaan' : 'Stocklijn toevoegen'}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Zoek op artikel, omschrijving, pallet of locatie"
              className="md:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={customerFilter}
              onChange={event => setCustomerFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Alle klanten</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Alle statussen</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Klant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Artikel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Pallet</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Aantal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Locatie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Datums</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">Stock wordt geladen...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                      Geen stocklijnen gevonden voor deze filters.
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const meta = statusMeta(item.status)
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{item.customer?.name || 'Geen klant'}</div>
                          {item.customer?.contact_name && (
                            <div className="text-xs text-gray-500">{item.customer.contact_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          {item.item_code && <div className="text-xs text-gray-500">{item.item_code}</div>}
                          {item.notes && <div className="mt-1 text-xs text-gray-400">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.pallet_or_package || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {item.quantity} <span className="font-normal text-gray-500">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.location || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${meta.className}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <div>Ontvangen: {item.received_at || '-'}</div>
                          <div>Geteld: {item.last_counted_at || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                          >
                            Bewerk
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow('item', item.id)}
                            className="font-medium text-red-600 hover:text-red-800"
                          >
                            Verwijder
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Klanten</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {customers.map(customer => (
              <div key={customer.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.contact_name || 'Geen contactpersoon'}</div>
                    <div className="text-xs text-gray-400">{customer.email || customer.phone || 'Geen contactgegevens'}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${customer.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {customer.active ? 'Actief' : 'Inactief'}
                  </span>
                </div>
                {customer.notes && <p className="mt-2 text-sm text-gray-500">{customer.notes}</p>}
                <div className="mt-3 flex gap-3 text-sm">
                  <button type="button" onClick={() => editCustomer(customer)} className="font-medium text-blue-600 hover:text-blue-800">
                    Bewerk
                  </button>
                  <button type="button" onClick={() => deleteRow('customer', customer.id)} className="font-medium text-red-600 hover:text-red-800">
                    Verwijder
                  </button>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Nog geen klanten toegevoegd.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}

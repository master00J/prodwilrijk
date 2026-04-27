'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type StockStatus = 'in_stock' | 'reserved' | 'shipped' | 'damaged'
type FilterMode = 'all' | 'to_order' | 'ok' | 'over_max'

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
  min_stock: number
  max_stock: number
  reorder_shortage?: number
  reorder_quantity?: number
  unit: string
  location?: string | null
  status: StockStatus
  received_at?: string | null
  last_counted_at?: string | null
  notes?: string | null
}

const STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in_stock', label: 'Actief' },
  { value: 'reserved', label: 'Gereserveerd' },
  { value: 'shipped', label: 'Uit stock' },
  { value: 'damaged', label: 'Geblokkeerd' },
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
  quantity: '0',
  min_stock: '0',
  max_stock: '0',
  unit: 'stuks',
  location: '',
  status: 'in_stock' as StockStatus,
  last_counted_at: '',
  notes: '',
}

const numberValue = (value: unknown) => Number(value) || 0

function reorderQuantity(item: WeertStockItem) {
  const current = numberValue(item.quantity)
  const min = numberValue(item.min_stock)
  const max = numberValue(item.max_stock)
  return current < min ? Math.max(0, max - current) : 0
}

function shortage(item: WeertStockItem) {
  return Math.max(0, numberValue(item.min_stock) - numberValue(item.quantity))
}

function stockLevel(item: WeertStockItem) {
  const current = numberValue(item.quantity)
  const min = numberValue(item.min_stock)
  const max = numberValue(item.max_stock)
  if (current < min) return 'to_order'
  if (max > 0 && current > max) return 'over_max'
  return 'ok'
}

export default function WeertStockPage() {
  const [customers, setCustomers] = useState<WeertCustomer[]>([])
  const [items, setItems] = useState<WeertStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
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

      const response = await fetch(`/api/admin/weert-stock?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Weert min/max voorraad laden mislukt')
      setCustomers(data.customers || [])
      setItems(data.items || [])
    } catch (err: any) {
      setError(err.message || 'Weert min/max voorraad laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [customerFilter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const visibleItems = useMemo(() => {
    if (filterMode === 'all') return items
    return items.filter(item => stockLevel(item) === filterMode)
  }, [filterMode, items])

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const orderQty = reorderQuantity(item)
        const level = stockLevel(item)
        acc.lines += 1
        acc.quantity += numberValue(item.quantity)
        acc.toOrder += orderQty
        if (orderQty > 0) acc.linesToOrder += 1
        if (level === 'over_max') acc.overMax += 1
        return acc
      },
      { lines: 0, quantity: 0, toOrder: 0, linesToOrder: 0, overMax: 0 }
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
    const min = numberValue(itemForm.min_stock)
    const max = numberValue(itemForm.max_stock)
    if (max > 0 && max < min) {
      alert('Maximum voorraad moet groter of gelijk zijn aan minimum voorraad')
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
          quantity: numberValue(itemForm.quantity),
          min_stock: min,
          max_stock: max,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Voorraadregel opslaan mislukt')
      resetItemForm()
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Voorraadregel opslaan mislukt')
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
      min_stock: String(item.min_stock ?? 0),
      max_stock: String(item.max_stock ?? 0),
      unit: item.unit || 'stuks',
      location: item.location || '',
      status: item.status || 'in_stock',
      last_counted_at: item.last_counted_at || '',
      notes: item.notes || '',
    })
  }

  const deleteRow = async (type: 'customer' | 'item', id: number) => {
    const label = type === 'customer' ? 'klant' : 'voorraadregel'
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

  const healthBadge = (item: WeertStockItem) => {
    const level = stockLevel(item)
    if (level === 'to_order') {
      return <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Bestellen</span>
    }
    if (level === 'over_max') {
      return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Boven max</span>
    }
    return <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">OK</span>
  }

  return (
    <AdminGuard>
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weert Min/Max Voorraad</h1>
            <p className="mt-1 text-sm text-gray-500">
              Beheer per klant en artikel de huidige voorraad, minimumvoorraad, maximumvoorraad en besteladvies voor locatie Weert.
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
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`rounded-xl border p-4 text-left ${filterMode === 'all' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Artikels</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summary.lines}</div>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('to_order')}
            className={`rounded-xl border p-4 text-left ${filterMode === 'to_order' ? 'border-red-300 bg-red-50' : 'border-red-100 bg-red-50'}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Te bestellen regels</div>
            <div className="mt-1 text-2xl font-bold text-red-900">{summary.linesToOrder}</div>
          </button>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Besteladvies totaal</div>
            <div className="mt-1 text-2xl font-bold text-amber-900">{summary.toOrder}</div>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode('over_max')}
            className={`rounded-xl border p-4 text-left ${filterMode === 'over_max' ? 'border-purple-300 bg-purple-50' : 'border-purple-100 bg-purple-50'}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Boven maximum</div>
            <div className="mt-1 text-2xl font-bold text-purple-900">{summary.overMax}</div>
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingCustomerId ? 'Klant bewerken' : 'Klant toevoegen'}
            </h2>
            <div className="mt-4 space-y-3">
              <input value={customerForm.name} onChange={event => setCustomerForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Klantnaam *" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={customerForm.contact_name} onChange={event => setCustomerForm(prev => ({ ...prev, contact_name: event.target.value }))} placeholder="Contactpersoon" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={customerForm.email} onChange={event => setCustomerForm(prev => ({ ...prev, email: event.target.value }))} placeholder="E-mail" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={customerForm.phone} onChange={event => setCustomerForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="Telefoon" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <textarea value={customerForm.notes} onChange={event => setCustomerForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Klantnotities" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={customerForm.active} onChange={event => setCustomerForm(prev => ({ ...prev, active: event.target.checked }))} />
                Actieve klant
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={saveCustomer} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {editingCustomerId ? 'Klant opslaan' : 'Klant toevoegen'}
                </button>
                {editingCustomerId && (
                  <button type="button" onClick={resetCustomerForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Annuleren
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingItemId ? 'Min/max regel bewerken' : 'Min/max regel toevoegen'}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={itemForm.customer_id} onChange={event => setItemForm(prev => ({ ...prev, customer_id: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Geen klant gekoppeld</option>
                {activeCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
              <input value={itemForm.item_code} onChange={event => setItemForm(prev => ({ ...prev, item_code: event.target.value }))} placeholder="Artikelcode / referentie" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={itemForm.description} onChange={event => setItemForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Omschrijving *" className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
              <input value={itemForm.pallet_or_package} onChange={event => setItemForm(prev => ({ ...prev, pallet_or_package: event.target.value }))} placeholder="Pallet / verpakking / artikelgroep" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={itemForm.location} onChange={event => setItemForm(prev => ({ ...prev, location: event.target.value }))} placeholder="Rek / locatie in Weert" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />

              <div className="grid grid-cols-3 gap-3 md:col-span-2">
                <label className="text-xs font-medium text-gray-600">
                  Huidig
                  <input type="number" min={0} value={itemForm.quantity} onChange={event => setItemForm(prev => ({ ...prev, quantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  Minimum
                  <input type="number" min={0} value={itemForm.min_stock} onChange={event => setItemForm(prev => ({ ...prev, min_stock: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  Maximum
                  <input type="number" min={0} value={itemForm.max_stock} onChange={event => setItemForm(prev => ({ ...prev, max_stock: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <input value={itemForm.unit} onChange={event => setItemForm(prev => ({ ...prev, unit: event.target.value }))} placeholder="Eenheid" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={itemForm.status} onChange={event => setItemForm(prev => ({ ...prev, status: event.target.value as StockStatus }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label className="text-xs font-medium text-gray-600">
                Laatst geteld
                <input type="date" value={itemForm.last_counted_at} onChange={event => setItemForm(prev => ({ ...prev, last_counted_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <textarea value={itemForm.notes} onChange={event => setItemForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Interne notities" rows={3} className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
              <div className="flex gap-2 md:col-span-2">
                <button type="button" onClick={saveItem} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {editingItemId ? 'Min/max regel opslaan' : 'Min/max regel toevoegen'}
                </button>
                {editingItemId && (
                  <button type="button" onClick={resetItemForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Annuleren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Zoek op artikel, omschrijving, pallet of locatie" className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
            <select value={customerFilter} onChange={event => setCustomerFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Alle klanten</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <select value={filterMode} onChange={event => setFilterMode(event.target.value as FilterMode)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="all">Alle regels</option>
              <option value="to_order">Alleen te bestellen</option>
              <option value="ok">Alleen OK</option>
              <option value="over_max">Boven maximum</option>
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
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Huidig</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Min</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Max</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Besteladvies</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Locatie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">Voorraad wordt geladen...</td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">Geen min/max regels gevonden.</td>
                  </tr>
                ) : (
                  visibleItems.map(item => {
                    const orderQty = reorderQuantity(item)
                    const missing = shortage(item)
                    return (
                      <tr key={item.id} className={orderQty > 0 ? 'bg-red-50/40' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{item.customer?.name || 'Geen klant'}</div>
                          {item.customer?.contact_name && <div className="text-xs text-gray-500">{item.customer.contact_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="text-xs text-gray-500">{item.item_code || '-'}{item.pallet_or_package ? ` / ${item.pallet_or_package}` : ''}</div>
                          {item.notes && <div className="mt-1 text-xs text-gray-400">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{item.min_stock}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{item.max_stock}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          {orderQty > 0 ? (
                            <div>
                              <div className="font-bold text-red-700">{orderQty} {item.unit}</div>
                              <div className="text-xs text-red-500">tekort tot min: {missing}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.location || '-'}</td>
                        <td className="px-4 py-3 text-sm">{healthBadge(item)}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button type="button" onClick={() => editItem(item)} className="mr-3 font-medium text-blue-600 hover:text-blue-800">Bewerk</button>
                          <button type="button" onClick={() => deleteRow('item', item.id)} className="font-medium text-red-600 hover:text-red-800">Verwijder</button>
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
                  <button type="button" onClick={() => editCustomer(customer)} className="font-medium text-blue-600 hover:text-blue-800">Bewerk</button>
                  <button type="button" onClick={() => deleteRow('customer', customer.id)} className="font-medium text-red-600 hover:text-red-800">Verwijder</button>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Nog geen klanten toegevoegd.</div>
            )}
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}

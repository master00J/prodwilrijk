'use client'

import { Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StorageRentalCustomer } from '@/types/database'
import ActionMenu from './ActionMenu'
import SlideOver from './SlideOver'

type Props = {
  customers: StorageRentalCustomer[]
  editingCustomer: StorageRentalCustomer | null
  customerName: string
  setEditingCustomer: (c: StorageRentalCustomer | null) => void
  setCustomerName: (s: string) => void
  resetCustomerForm: () => void
  handleCustomerSubmit: (e: React.FormEvent) => void
  savingCustomer: boolean
  handleDelete: (type: 'customer', id: number) => void
  toggleCustomerActive: (customer: StorageRentalCustomer) => void
  customerNameError?: string
  /** Rendement + #opslagen per klant, uit de hook. */
  revenuePerCustomer: Map<number, { revenue: number; activeCount: number; totalCount: number }>
}

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function CustomersTab({
  customers,
  editingCustomer,
  customerName,
  setEditingCustomer,
  setCustomerName,
  resetCustomerForm,
  handleCustomerSubmit,
  savingCustomer,
  handleDelete,
  toggleCustomerActive,
  customerNameError,
  revenuePerCustomer,
}: Props) {
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(true)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers
      .filter((c) => (showInactive ? true : c.active !== false))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .map((c) => ({
        ...c,
        _stats: revenuePerCustomer.get(c.id) ?? { revenue: 0, activeCount: 0, totalCount: 0 },
      }))
      .sort((a, b) => b._stats.revenue - a._stats.revenue)
  }, [customers, search, showInactive, revenuePerCustomer])

  const openCreate = () => { resetCustomerForm(); setDrawerOpen(true) }
  const openEdit = (c: StorageRentalCustomer) => {
    setEditingCustomer(c); setCustomerName(c.name); setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); resetCustomerForm() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleCustomerSubmit(e)
    if (!customerNameError) setDrawerOpen(false)
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Klanten</h2>
            <span className="text-xs text-gray-500">
              {customers.filter((c) => c.active !== false).length} actief · {customers.length} totaal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek klant..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Zoek klant"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  aria-label="Zoekterm wissen"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              Toon inactief
            </label>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nieuwe klant
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Klant</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Opslagen</th>
                <th className="px-4 py-2.5 text-right">Rendement</th>
                <th className="px-4 py-2.5 w-10" aria-label="Acties"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-sm text-gray-500 text-center">
                    {customers.length === 0 ? 'Nog geen klanten toegevoegd.' : 'Geen resultaten.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const stats = c._stats
                  const isActive = c.active !== false
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${isActive ? '' : 'bg-gray-50/60 text-gray-500'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isActive ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums">
                        {stats.totalCount === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <div>
                            <span className="font-medium text-gray-900">{stats.activeCount}</span>
                            <span className="text-gray-400"> / {stats.totalCount}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums">
                        {stats.revenue > 0 ? (
                          <span className="font-semibold text-emerald-700">{eur(stats.revenue)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionMenu
                          ariaLabel="Acties voor klant"
                          items={[
                            {
                              label: 'Bewerken',
                              icon: <Pencil className="w-4 h-4" />,
                              onClick: () => openEdit(c),
                            },
                            {
                              label: isActive ? 'Deactiveer' : 'Activeer',
                              icon: <Power className="w-4 h-4" />,
                              onClick: () => toggleCustomerActive(c),
                            },
                            {
                              label: 'Verwijder',
                              icon: <Trash2 className="w-4 h-4" />,
                              danger: true,
                              divider: true,
                              onClick: () => handleDelete('customer', c.id),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingCustomer ? 'Klant bewerken' : 'Nieuwe klant'}
        subtitle={editingCustomer ? `ID #${editingCustomer.id}` : undefined}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeDrawer}
              className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuleer
            </button>
            <button
              type="button"
              form="customer-form"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
              disabled={savingCustomer}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {savingCustomer && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {editingCustomer ? 'Bijwerken' : 'Toevoegen'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bedrijfsnaam <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                customerNameError ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!customerNameError}
            />
            {customerNameError && (
              <p className="text-xs text-red-600 mt-1">{customerNameError}</p>
            )}
          </div>
        </form>
      </SlideOver>
    </>
  )
}

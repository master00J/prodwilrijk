'use client'

import { Trash2 } from 'lucide-react'
import type { ManagedOrder } from './types'
import { formatDate } from './kpi-formatters'
import type { Site } from '@/lib/sites'

export function OrderManagementSection({
  availableSites,
  manageSite,
  setManageSite,
  manageTab,
  setManageTab,
  manageSearch,
  setManageSearch,
  managedOrders,
  manageLoading,
  deletingOrderId,
  onRefresh,
  onDelete,
}: {
  availableSites: Site[]
  manageSite: Site
  setManageSite: (site: Site) => void
  manageTab: 'actief' | 'afgewerkt'
  setManageTab: (tab: 'actief' | 'afgewerkt') => void
  manageSearch: string
  setManageSearch: (q: string) => void
  managedOrders: ManagedOrder[]
  manageLoading: boolean
  deletingOrderId: number | null
  onRefresh: () => void
  onDelete: (order: ManagedOrder) => void
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Productieorders beheren</h2>
          <p className="text-sm text-gray-500 mt-1">
            Verwijder orders uit de tijdregistratie-flow. Actieve timers moeten eerst gestopt worden op{' '}
            <a href="/production-order-time" className="text-blue-700 underline">
              /production-order-time
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={manageSite}
            onChange={(e) => setManageSite(e.target.value as Site)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {availableSites.map((siteOption) => (
              <option key={siteOption} value={siteOption}>
                {siteOption}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Zoek order..."
            value={manageSearch}
            onChange={(e) => setManageSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-48"
          />
          <button
            type="button"
            onClick={onRefresh}
            disabled={manageLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            Vernieuwen
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
        {(['actief', 'afgewerkt'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setManageTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
              manageTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {manageLoading ? (
        <p className="text-gray-500 py-10 text-center">Orders laden...</p>
      ) : managedOrders.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">Geen orders gevonden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 px-5 font-medium">Order</th>
                <th className="py-3 pr-4 font-medium">Verkooporder</th>
                <th className="py-3 pr-4 font-medium">Geüpload</th>
                <th className="py-3 pr-4 font-medium">Afgewerkt</th>
                <th className="py-3 pr-5 font-medium text-right">Actie</th>
              </tr>
            </thead>
            <tbody>
              {managedOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2 px-5 font-medium">{order.order_number}</td>
                  <td className="py-2 pr-4">{order.sales_order_number || '–'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(order.uploaded_at)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(order.finished_at)}</td>
                  <td className="py-2 pr-5 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(order)}
                      disabled={deletingOrderId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingOrderId === order.id ? 'Bezig...' : 'Verwijder'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

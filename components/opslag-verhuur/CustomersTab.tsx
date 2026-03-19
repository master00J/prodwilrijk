'use client'

import type { StorageRentalCustomer } from '@/types/database'

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
}

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
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Klanten</h2>
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
              onChange={(e) => setCustomerName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                customerNameError ? 'border-red-500' : 'border-gray-300'
              }`}
              aria-invalid={!!customerNameError}
              aria-describedby={customerNameError ? 'customer-name-error' : undefined}
            />
            {customerNameError && (
              <p id="customer-name-error" className="text-xs text-red-600 mt-1">
                {customerNameError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingCustomer}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {savingCustomer && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
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
                        type="button"
                        onClick={() => {
                          setEditingCustomer(customer)
                          setCustomerName(customer.name)
                        }}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                      >
                        Bewerken
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCustomerActive(customer)}
                        className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                      >
                        {customer.active === false ? 'Activeer' : 'Deactiveer'}
                      </button>
                      <button
                        type="button"
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
  )
}

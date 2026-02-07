'use client'

import Pagination from '@/components/common/Pagination'
import { Download, Search } from 'lucide-react'
import type { StorageRentalCustomer, StorageRentalItem, StorageRentalLocation } from '@/types/database'

type ItemsTabProps = {
  customers: StorageRentalCustomer[]
  locations: StorageRentalLocation[]
  activeItems: StorageRentalItem[]
  stoppedItems: StorageRentalItem[]
  itemsTab: 'actief' | 'gestopt'
  setItemsTab: (t: 'actief' | 'gestopt') => void
  setItemsPage: (n: number) => void
  itemsSearch: string
  setItemsSearch: (s: string) => void
  itemsSortCol: string
  itemsSortDir: 'asc' | 'desc'
  toggleSort: (col: string) => void
  paginatedItems: StorageRentalItem[]
  displayedItemsLength: number
  itemsPage: number
  totalItemsPages: number
  ITEMS_PER_PAGE: number
  editingItem: StorageRentalItem | null
  itemCustomerId: string
  setItemCustomerId: (s: string) => void
  itemLocationId: string
  setItemLocationId: (s: string) => void
  itemDescription: string
  setItemDescription: (s: string) => void
  itemOrNumber: string
  setItemOrNumber: (s: string) => void
  itemCustomerDescription: string
  setItemCustomerDescription: (s: string) => void
  itemForescoId: string
  setItemForescoId: (s: string) => void
  itemPackingStatus: 'bare' | 'verpakt'
  setItemPackingStatus: (s: 'bare' | 'verpakt') => void
  itemPackedAt: string
  setItemPackedAt: (s: string) => void
  itemM2: string
  setItemM2: (s: string) => void
  itemM2Bare: string
  setItemM2Bare: (s: string) => void
  itemM2Verpakt: string
  setItemM2Verpakt: (s: string) => void
  itemPricePerM2: string
  setItemPricePerM2: (s: string) => void
  itemStartDate: string
  setItemStartDate: (s: string) => void
  itemEndDate: string
  setItemEndDate: (s: string) => void
  itemNotes: string
  setItemNotes: (s: string) => void
  itemActive: boolean
  setItemActive: (b: boolean) => void
  resetItemForm: () => void
  handleCopyItem: (item: StorageRentalItem) => void
  handleItemSubmit: (e: React.FormEvent) => void
  handleStopItem: (item: StorageRentalItem) => void
  handleDelete: (type: 'item', id: number) => void
  setItemFormFromItem: (item: StorageRentalItem) => void
  setPhotoPanelItemId: (id: number | null) => void
  getEffectiveM2: (item: StorageRentalItem) => number
  getItemRevenue: (item: StorageRentalItem) => number
  savingItem: boolean
  stoppingItemId: number | null
  handleExportItemsExcel: () => void
  itemCustomerError?: string
  itemM2Error?: string
}

export default function ItemsTab({
  customers,
  locations,
  activeItems,
  stoppedItems,
  itemsTab,
  setItemsTab,
  setItemsPage,
  itemsSearch,
  setItemsSearch,
  itemsSortCol,
  itemsSortDir,
  toggleSort,
  paginatedItems,
  displayedItemsLength,
  itemsPage,
  totalItemsPages,
  ITEMS_PER_PAGE,
  editingItem,
  itemCustomerId,
  setItemCustomerId,
  itemLocationId,
  setItemLocationId,
  itemDescription,
  setItemDescription,
  itemOrNumber,
  setItemOrNumber,
  itemCustomerDescription,
  setItemCustomerDescription,
  itemForescoId,
  setItemForescoId,
  itemPackingStatus,
  setItemPackingStatus,
  itemPackedAt,
  setItemPackedAt,
  itemM2,
  setItemM2,
  itemM2Bare,
  setItemM2Bare,
  itemM2Verpakt,
  setItemM2Verpakt,
  itemPricePerM2,
  setItemPricePerM2,
  itemStartDate,
  setItemStartDate,
  itemEndDate,
  setItemEndDate,
  itemNotes,
  setItemNotes,
  itemActive,
  setItemActive,
  resetItemForm,
  handleCopyItem,
  handleItemSubmit,
  handleStopItem,
  handleDelete,
  setItemFormFromItem,
  setPhotoPanelItemId,
  getEffectiveM2,
  getItemRevenue,
  savingItem,
  stoppingItemId,
  handleExportItemsExcel,
  itemCustomerError,
  itemM2Error,
}: ItemsTabProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Opslagen</h2>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={itemsSearch}
              onChange={(e) => {
                setItemsSearch(e.target.value)
                setItemsPage(1)
              }}
              placeholder="Zoek OR, klant, locatie..."
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              aria-label="Zoek items"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setItemsTab('actief')
                setItemsPage(1)
              }}
              className={`px-4 py-2 text-sm font-medium ${
                itemsTab === 'actief' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Actief ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setItemsTab('gestopt')
                setItemsPage(1)
              }}
              className={`px-4 py-2 text-sm font-medium ${
                itemsTab === 'gestopt' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Gestopt ({stoppedItems.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportItemsExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Exporteer Excel
          </button>
        </div>
      </div>

      <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Klant</label>
          <select
            value={itemCustomerId}
            onChange={(e) => setItemCustomerId(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg ${itemCustomerError ? 'border-red-500' : 'border-gray-300'}`}
            aria-invalid={!!itemCustomerError}
          >
            <option value="">Selecteer klant</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {itemCustomerError && (
            <p className="text-xs text-red-600 mt-1">{itemCustomerError}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
          <select
            value={itemLocationId}
            onChange={(e) => setItemLocationId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Geen locatie</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prijs/m²</label>
          <input
            value={itemPricePerM2}
            onChange={(e) => setItemPricePerM2(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actief</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemActive}
              onChange={(e) => setItemActive(e.target.checked)}
              className="w-4 h-4"
            />
            Actief
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OR-nummer</label>
          <input
            value={itemOrNumber}
            onChange={(e) => setItemOrNumber(e.target.value)}
            placeholder="Ordernummer"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving klant</label>
          <input
            value={itemCustomerDescription}
            onChange={(e) => setItemCustomerDescription(e.target.value)}
            placeholder="Omschrijving van klant"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foresco ID</label>
          <input
            value={itemForescoId}
            onChange={(e) => setItemForescoId(e.target.value)}
            placeholder="Foresco ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={itemPackingStatus}
            onChange={(e) => setItemPackingStatus(e.target.value as 'bare' | 'verpakt')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="bare">Bare (bij lossing)</option>
            <option value="verpakt">Verpakt (na verpakken)</option>
          </select>
        </div>
        {itemPackingStatus === 'verpakt' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum verpakt</label>
            <input
              type="date"
              value={itemPackedAt}
              onChange={(e) => setItemPackedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              Voor correcte prijsberekening: bare m² vóór deze datum, verpakt m² erna.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">m² bare</label>
          <input
            value={itemM2Bare}
            onChange={(e) => setItemM2Bare(e.target.value)}
            placeholder="m² bij lossing"
            className={`w-full px-3 py-2 border rounded-lg ${itemM2Error ? 'border-red-500' : 'border-gray-300'}`}
            aria-invalid={!!itemM2Error}
          />
          {itemM2Error && <p className="text-xs text-red-600 mt-1">{itemM2Error}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">m² verpakt</label>
          <input
            value={itemM2Verpakt}
            onChange={(e) => setItemM2Verpakt(e.target.value)}
            placeholder="m² na verpakken"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
          <input
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
          <input
            type="date"
            value={itemStartDate}
            onChange={(e) => setItemStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Einde</label>
          <input
            type="date"
            value={itemEndDate}
            onChange={(e) => setItemEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
          <input
            value={itemNotes}
            onChange={(e) => setItemNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="md:col-span-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={savingItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {savingItem && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
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

      {itemsTab === 'gestopt' && stoppedItems.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            Totale opbrengst gestopte items:{' '}
            <span className="font-semibold text-gray-900">
              {stoppedItems
                .reduce((sum, item) => sum + getItemRevenue(item), 0)
                .toLocaleString('nl-BE', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                })}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">OR</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                <button
                  type="button"
                  onClick={() => toggleSort('customer')}
                  className="hover:text-gray-700 flex items-center gap-1"
                >
                  Klant {itemsSortCol === 'customer' && (itemsSortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Omschr. klant
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Foresco ID
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Omschrijving
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                <button
                  type="button"
                  onClick={() => toggleSort('m2')}
                  className="hover:text-gray-700 flex items-center gap-1"
                >
                  m² {itemsSortCol === 'm2' && (itemsSortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prijs/m²</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Rendement
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                <button
                  type="button"
                  onClick={() => toggleSort('start_date')}
                  className="hover:text-gray-700 flex items-center gap-1"
                >
                  Periode {itemsSortCol === 'start_date' && (itemsSortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actief</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {displayedItemsLength === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-12 text-sm text-gray-500 text-center">
                  <p className="font-medium">
                    {itemsSearch
                      ? 'Geen resultaten gevonden voor je zoekopdracht.'
                      : itemsTab === 'actief'
                        ? 'Nog geen actieve opslagrecords.'
                        : 'Geen gestopte opslagrecords.'}
                  </p>
                  {itemsSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setItemsSearch('')
                        setItemsPage(1)
                      }}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Zoekfilter wissen
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <tr key={item.id} className={item.active === false ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 text-sm font-medium">{item.or_number || '-'}</td>
                  <td className="px-3 py-2 text-sm">
                    {item.customer?.name ||
                      customers.find((c) => c.id === item.customer_id)?.name ||
                      '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">{item.customer_description || '-'}</td>
                  <td className="px-3 py-2 text-sm">{item.foresco_id || '-'}</td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        item.packing_status === 'verpakt'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.packing_status || 'bare'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {item.location?.name ||
                      locations.find((l) => l.id === item.location_id)?.name ||
                      '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">{item.description || '-'}</td>
                  <td className="px-3 py-2 text-sm">{getEffectiveM2(item).toFixed(2)}</td>
                  <td className="px-3 py-2 text-sm">
                    {item.price_per_m2 ? Number(item.price_per_m2).toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {itemsTab === 'gestopt'
                      ? getItemRevenue(item) > 0
                        ? getItemRevenue(item).toLocaleString('nl-BE', {
                            style: 'currency',
                            currency: 'EUR',
                            minimumFractionDigits: 2,
                          })
                        : '-'
                      : getEffectiveM2(item) && item.price_per_m2
                        ? (getEffectiveM2(item) * Number(item.price_per_m2)).toFixed(2)
                        : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {item.start_date || '-'} → {item.end_date || '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {item.active !== false ? 'Actief' : 'Gestopt'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPhotoPanelItemId(item.id)}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                      >
                        Foto&apos;s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyItem(item)}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                      >
                        Kopieer
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemFormFromItem(item)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                      >
                        Bewerken
                      </button>
                      {item.active !== false && (
                        <button
                          type="button"
                          onClick={() => handleStopItem(item)}
                          disabled={stoppingItemId === item.id}
                          className="px-2 py-1 bg-yellow-500 text-white rounded text-xs disabled:opacity-60 flex items-center gap-1"
                        >
                          {stoppingItemId === item.id && (
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          )}
                          Stop
                        </button>
                      )}
                      <button
                        type="button"
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

      {displayedItemsLength > ITEMS_PER_PAGE && (
        <Pagination
          currentPage={itemsPage}
          totalPages={totalItemsPages}
          onPageChange={setItemsPage}
        />
      )}
    </div>
  )
}

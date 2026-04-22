'use client'

import Pagination from '@/components/common/Pagination'
import { Copy, Download, Filter, Image as ImageIcon, Pencil, Plus, Search, StopCircle, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { StorageRentalCustomer, StorageRentalItem, StorageRentalLocation } from '@/types/database'
import ActionMenu from './ActionMenu'
import SlideOver from './SlideOver'

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
  /** Drawer open/dicht state (getilt naar parent zodat tabswitch confirm kan werken). */
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  /** Filters */
  locationFilter: string
  setLocationFilter: (s: string) => void
  statusFilter: 'all' | 'bare' | 'verpakt'
  setStatusFilter: (s: 'all' | 'bare' | 'verpakt') => void
}

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function ItemsTab(props: ItemsTabProps) {
  const {
    customers, locations,
    activeItems, stoppedItems,
    itemsTab, setItemsTab, setItemsPage,
    itemsSearch, setItemsSearch,
    itemsSortCol, itemsSortDir, toggleSort,
    paginatedItems, displayedItemsLength,
    itemsPage, totalItemsPages, ITEMS_PER_PAGE,
    editingItem,
    itemCustomerId, setItemCustomerId,
    itemLocationId, setItemLocationId,
    itemDescription, setItemDescription,
    itemOrNumber, setItemOrNumber,
    itemCustomerDescription, setItemCustomerDescription,
    itemForescoId, setItemForescoId,
    itemPackingStatus, setItemPackingStatus,
    itemPackedAt, setItemPackedAt,
    itemM2Bare, setItemM2Bare,
    itemM2Verpakt, setItemM2Verpakt,
    itemPricePerM2, setItemPricePerM2,
    itemStartDate, setItemStartDate,
    itemEndDate, setItemEndDate,
    itemNotes, setItemNotes,
    itemActive, setItemActive,
    resetItemForm, handleCopyItem, handleItemSubmit, handleStopItem, handleDelete,
    setItemFormFromItem, setPhotoPanelItemId,
    getEffectiveM2, getItemRevenue,
    savingItem, stoppingItemId, handleExportItemsExcel,
    itemCustomerError, itemM2Error,
    drawerOpen, setDrawerOpen,
    locationFilter, setLocationFilter,
    statusFilter, setStatusFilter,
  } = props

  const [filtersOpen, setFiltersOpen] = useState(false)

  const openCreate = () => {
    resetItemForm()
    setDrawerOpen(true)
  }
  const openEdit = (item: StorageRentalItem) => {
    setItemFormFromItem(item)
    setDrawerOpen(true)
  }
  const closeDrawer = () => {
    setDrawerOpen(false)
    resetItemForm()
  }

  const clearFilters = () => {
    setItemsSearch('')
    setLocationFilter('')
    setStatusFilter('all')
    setItemsPage(1)
  }
  const hasActiveFilters =
    itemsSearch.trim() !== '' || locationFilter !== '' || statusFilter !== 'all'

  const stoppedRevenueTotal = stoppedItems.reduce((sum, item) => sum + getItemRevenue(item), 0)

  const renderSortArrow = (col: string) => {
    if (itemsSortCol !== col) return <span className="text-gray-300">↕</span>
    return itemsSortDir === 'asc' ? '↑' : '↓'
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Opslagen</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => { setItemsTab('actief'); setItemsPage(1) }}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  itemsTab === 'actief'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Actief · {activeItems.length}
              </button>
              <button
                type="button"
                onClick={() => { setItemsTab('gestopt'); setItemsPage(1) }}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  itemsTab === 'gestopt'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Gestopt · {stoppedItems.length}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={itemsSearch}
                onChange={(e) => { setItemsSearch(e.target.value); setItemsPage(1) }}
                placeholder="Zoek OR, klant, locatie..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Zoek items"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              aria-expanded={filtersOpen}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                  {(itemsSearch.trim() ? 1 : 0) + (locationFilter ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportItemsExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nieuwe opslag
            </button>
          </div>
        </div>

        {/* Extra filter-rij (collapsible) */}
        {filtersOpen && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Locatie</label>
              <select
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); setItemsPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">Alle locaties</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'bare' | 'verpakt'); setItemsPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">Alle</option>
                <option value="bare">Bare</option>
                <option value="verpakt">Verpakt</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
              >
                <X className="w-3 h-3" />
                Filters wissen
              </button>
            )}
          </div>
        )}

        {/* Totaal voor gestopte items */}
        {itemsTab === 'gestopt' && stoppedItems.length > 0 && (
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-sm text-gray-600 flex items-center justify-between">
            <span>Totale opbrengst gestopte opslagen</span>
            <span className="font-semibold text-gray-900 tabular-nums">{eur(stoppedRevenueTotal)}</span>
          </div>
        )}

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">
                  <button type="button" onClick={() => toggleSort('customer')} className="flex items-center gap-1 hover:text-gray-800">
                    Klant {renderSortArrow('customer')}
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Locatie</th>
                <th className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => toggleSort('m2')} className="flex items-center gap-1 hover:text-gray-800 ml-auto">
                    m² · Prijs {renderSortArrow('m2')}
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">Rendement</th>
                <th className="px-4 py-2.5 text-left">
                  <button type="button" onClick={() => toggleSort('start_date')} className="flex items-center gap-1 hover:text-gray-800">
                    Periode {renderSortArrow('start_date')}
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right w-10" aria-label="Acties"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {displayedItemsLength === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-sm text-gray-500 text-center">
                    <p className="font-medium">
                      {hasActiveFilters
                        ? 'Geen resultaten voor deze filters.'
                        : itemsTab === 'actief'
                          ? 'Nog geen actieve opslagen.'
                          : 'Geen gestopte opslagen.'}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Filters wissen
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={openCreate}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        + Eerste opslag toevoegen
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const m2 = getEffectiveM2(item)
                  const price = Number(item.price_per_m2 || 0)
                  const revenue = getItemRevenue(item)
                  const custName = item.customer?.name
                    || customers.find((c) => c.id === item.customer_id)?.name || '—'
                  const locName = item.location?.name
                    || locations.find((l) => l.id === item.location_id)?.name || '—'
                  const isStopped = item.active === false
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isStopped ? 'bg-gray-50/60 text-gray-500' : ''}`}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{custName}</div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          {item.or_number && <span>OR: <span className="font-medium text-gray-700">{item.or_number}</span></span>}
                          {item.foresco_id && <span>Foresco: <span className="font-medium text-gray-700">{item.foresco_id}</span></span>}
                          {item.customer_description && <span className="truncate max-w-xs">{item.customer_description}</span>}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            item.packing_status === 'verpakt'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.packing_status === 'verpakt' ? 'Verpakt' : 'Bare'}
                        </span>
                        {isStopped && (
                          <div className="text-[10px] text-gray-400 uppercase mt-1">Gestopt</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{locName}</td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums">
                        <div className="font-medium text-gray-900">{m2.toFixed(2)} m²</div>
                        <div className="text-xs text-gray-500">
                          {price ? `€ ${price.toFixed(2)}/m²` : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums">
                        <div className="font-semibold text-emerald-700">
                          {revenue > 0 ? eur(revenue) : '—'}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase">
                          {isStopped ? 'Definitief' : 'Tot vandaag'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{item.start_date || '—'}</div>
                        <div className="text-xs text-gray-400">
                          tot {item.end_date || '…'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionMenu
                          ariaLabel="Acties voor opslag"
                          items={[
                            {
                              label: "Foto's",
                              icon: <ImageIcon className="w-4 h-4" />,
                              onClick: () => setPhotoPanelItemId(item.id),
                            },
                            {
                              label: 'Bewerken',
                              icon: <Pencil className="w-4 h-4" />,
                              onClick: () => openEdit(item),
                            },
                            {
                              label: 'Kopieer',
                              icon: <Copy className="w-4 h-4" />,
                              onClick: () => {
                                handleCopyItem(item)
                                setDrawerOpen(true)
                              },
                            },
                            ...(!isStopped
                              ? [{
                                  label: stoppingItemId === item.id ? 'Bezig…' : 'Stop opslag',
                                  icon: <StopCircle className="w-4 h-4" />,
                                  disabled: stoppingItemId === item.id,
                                  divider: true,
                                  onClick: () => handleStopItem(item),
                                }]
                              : []),
                            {
                              label: 'Verwijder',
                              icon: <Trash2 className="w-4 h-4" />,
                              danger: true,
                              divider: isStopped,
                              onClick: () => handleDelete('item', item.id),
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

        {displayedItemsLength > ITEMS_PER_PAGE && (
          <div className="px-5 py-3 border-t border-gray-100">
            <Pagination
              currentPage={itemsPage}
              totalPages={totalItemsPages}
              onPageChange={setItemsPage}
            />
          </div>
        )}
      </div>

      {/* Form drawer */}
      <SlideOver
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingItem ? 'Opslag bewerken' : 'Nieuwe opslag'}
        subtitle={editingItem ? `ID #${editingItem.id}` : 'Vul de velden hieronder in'}
        maxWidth="max-w-3xl"
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
              form="item-form"
              onClick={(e) => {
                e.preventDefault()
                handleItemSubmit(e as unknown as React.FormEvent)
              }}
              disabled={savingItem}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {savingItem && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {editingItem ? 'Bijwerken' : 'Toevoegen'}
            </button>
          </>
        }
      >
        <form
          id="item-form"
          onSubmit={(e) => {
            handleItemSubmit(e)
          }}
          className="space-y-6"
        >
          <Section title="Klant & locatie">
            <Grid cols={2}>
              <Field label="Klant" error={itemCustomerError} required>
                <select
                  value={itemCustomerId}
                  onChange={(e) => setItemCustomerId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${itemCustomerError ? 'border-red-500' : 'border-gray-200'}`}
                >
                  <option value="">Selecteer klant</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Locatie">
                <select
                  value={itemLocationId}
                  onChange={(e) => setItemLocationId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Geen locatie</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </Field>
            </Grid>
          </Section>

          <Section title="Referenties">
            <Grid cols={3}>
              <Field label="OR-nummer">
                <input
                  value={itemOrNumber}
                  onChange={(e) => setItemOrNumber(e.target.value)}
                  placeholder="Ordernummer"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Foresco ID">
                <input
                  value={itemForescoId}
                  onChange={(e) => setItemForescoId(e.target.value)}
                  placeholder="Foresco ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Omschr. klant">
                <input
                  value={itemCustomerDescription}
                  onChange={(e) => setItemCustomerDescription(e.target.value)}
                  placeholder="Optioneel"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
            </Grid>
            <Field label="Omschrijving">
              <input
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Interne omschrijving"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
          </Section>

          <Section title="Afmetingen & prijs">
            <Grid cols={3}>
              <Field label="Status" hint="Bare = bij lossing, verpakt = na verpakken">
                <select
                  value={itemPackingStatus}
                  onChange={(e) => setItemPackingStatus(e.target.value as 'bare' | 'verpakt')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="bare">Bare</option>
                  <option value="verpakt">Verpakt</option>
                </select>
              </Field>
              <Field label="m² bare" error={itemM2Error}>
                <input
                  value={itemM2Bare}
                  onChange={(e) => setItemM2Bare(e.target.value)}
                  placeholder="bij lossing"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${itemM2Error ? 'border-red-500' : 'border-gray-200'}`}
                />
              </Field>
              <Field label="m² verpakt">
                <input
                  value={itemM2Verpakt}
                  onChange={(e) => setItemM2Verpakt(e.target.value)}
                  placeholder="na verpakken"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
            </Grid>
            <Grid cols={2}>
              <Field label="Prijs per m²">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    value={itemPricePerM2}
                    onChange={(e) => setItemPricePerM2(e.target.value)}
                    placeholder="bv. 27,50"
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </Field>
              {itemPackingStatus === 'verpakt' && (
                <Field
                  label="Datum verpakt"
                  hint="Bare m² wordt tot deze datum berekend, verpakt m² erna."
                >
                  <input
                    type="date"
                    value={itemPackedAt}
                    onChange={(e) => setItemPackedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </Field>
              )}
            </Grid>
          </Section>

          <Section title="Periode">
            <Grid cols={2}>
              <Field label="Start">
                <input
                  type="date"
                  value={itemStartDate}
                  onChange={(e) => setItemStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Einde" hint="Leeg = loopt nog">
                <input
                  type="date"
                  value={itemEndDate}
                  onChange={(e) => setItemEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Extra">
            <Field label="Notities">
              <input
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Optionele notities"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={itemActive}
                onChange={(e) => setItemActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Actief (uitvinken = gestopt)
            </label>
          </Section>
        </form>
      </SlideOver>
    </>
  )
}

/* ---------- kleine lay-out helpers binnen dit bestand ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  error,
  hint,
  required,
}: {
  label: string
  children: React.ReactNode
  error?: string
  hint?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

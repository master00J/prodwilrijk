'use client'

export const dynamic = 'force-dynamic'

import ConfirmModal from '@/components/opslag-verhuur/ConfirmModal'
import ItemsTab from '@/components/opslag-verhuur/ItemsTab'
import LocationsTab from '@/components/opslag-verhuur/LocationsTab'
import OverviewTab from '@/components/opslag-verhuur/OverviewTab'
import PhotoModal from '@/components/opslag-verhuur/PhotoModal'
import ReportTab from '@/components/opslag-verhuur/ReportTab'
import StorageDashboardCards from '@/components/opslag-verhuur/StorageDashboardCards'
import CustomersTab from '@/components/opslag-verhuur/CustomersTab'
import AdminGuard from '@/components/AdminGuard'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useStorageRentals } from './useStorageRentals'

const TABS = ['overzicht', 'klanten', 'locaties', 'opslagen', 'rapport'] as const
type Tab = (typeof TABS)[number]

function isTab(t: string | null): t is Tab {
  return TABS.includes(t as Tab)
}

export default function StorageRentalsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const mainTab = isTab(tabParam) ? tabParam : 'overzicht'

  const [unsavedTabSwitch, setUnsavedTabSwitch] = useState<Tab | null>(null)
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const bareInputRef = useRef<HTMLInputElement>(null)
  const verpaktInputRef = useRef<HTMLInputElement>(null)
  const savingItemPrevRef = useRef(false)

  const api = useStorageRentals()

  // Sluit de opslag-drawer automatisch na een succesvolle save. We detecteren
  // dit via de overgang van savingItem=true → false zonder validatie-errors.
  useEffect(() => {
    if (!api.savingItem && savingItemPrevRef.current) {
      if (!api.itemCustomerError && !api.itemM2Error) setItemDrawerOpen(false)
    }
    savingItemPrevRef.current = api.savingItem
  }, [api.savingItem, api.itemCustomerError, api.itemM2Error])

  const setTabToUrl = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  const setMainTab = (tab: Tab) => {
    if (isFormDirty(api)) {
      setUnsavedTabSwitch(tab)
    } else {
      setTabToUrl(tab)
    }
  }

  const handleUnsavedConfirm = () => {
    if (unsavedTabSwitch) {
      setTabToUrl(unsavedTabSwitch)
      setUnsavedTabSwitch(null)
    }
  }

  const isFormDirty = (a: ReturnType<typeof useStorageRentals>) => {
    return Boolean(
      a.customerName.trim() ||
        a.locationName.trim() ||
        a.locationCapacity.trim() ||
        a.itemCustomerId ||
        a.itemOrNumber.trim() ||
        a.itemDescription.trim() ||
        a.itemCustomerDescription.trim() ||
        a.itemForescoId.trim() ||
        a.itemM2Bare.trim() ||
        a.itemM2Verpakt.trim() ||
        a.itemM2.trim() ||
        a.itemPricePerM2.trim() ||
        a.itemNotes.trim()
    )
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Opslagverhuur</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Beheer klanten, locaties en opslagruimte.{' '}
              <span className="text-gray-400">Los van WMS-projecten.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => api.fetchAll()}
            disabled={api.loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors text-sm"
            aria-label="Ververs gegevens"
          >
            <RefreshCw className={`w-4 h-4 ${api.loading ? 'animate-spin' : ''}`} />
            Ververs
          </button>
        </div>

        <StorageDashboardCards
          loading={api.loading}
          activeCustomersCount={api.activeCustomersCount}
          totalCustomersCount={api.totalCustomersCount}
          totalUsedM2={api.totalUsedM2}
          totalRevenue={api.totalRevenue}
          revenueThisMonth={api.revenueThisMonth}
          totalCapacityM2={api.totalCapacityM2}
          occupancy={api.occupancy}
        />

        <nav
          className="flex overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 -mx-1 sm:mx-0"
          role="tablist"
          aria-label="Hoofdsecties"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mainTab === tab}
              onClick={() => setMainTab(tab)}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mainTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {mainTab === 'overzicht' && !api.loading && (
          <OverviewTab
            customers={api.customers}
            locations={api.locations}
            items={api.items}
            activeItems={api.activeItems}
            revenuePerCustomer={api.revenuePerCustomer}
            expiringItems={api.expiringItems}
            onGoToItems={() => setMainTab('opslagen')}
            onGoToCustomers={() => setMainTab('klanten')}
            onGoToReport={() => setMainTab('rapport')}
          />
        )}

        {mainTab === 'klanten' && (
          <CustomersTab
            customers={api.customers}
            editingCustomer={api.editingCustomer}
            customerName={api.customerName}
            setEditingCustomer={api.setEditingCustomer}
            setCustomerName={(s) => {
              api.setCustomerName(s)
              api.setCustomerNameError?.('')
            }}
            resetCustomerForm={api.resetCustomerForm}
            handleCustomerSubmit={api.handleCustomerSubmit}
            savingCustomer={api.savingCustomer}
            handleDelete={api.handleDelete}
            toggleCustomerActive={api.toggleCustomerActive}
            customerNameError={api.customerNameError}
            revenuePerCustomer={api.revenuePerCustomer}
          />
        )}

        {mainTab === 'locaties' && (
          <LocationsTab
            locations={api.locations}
            editingLocation={api.editingLocation}
            locationName={api.locationName}
            locationCapacity={api.locationCapacity}
            setEditingLocation={api.setEditingLocation}
            setLocationName={(s) => {
              api.setLocationName(s)
              api.setLocationNameError?.('')
            }}
            setLocationCapacity={(s) => {
              api.setLocationCapacity(s)
              api.setLocationCapacityError?.('')
            }}
            resetLocationForm={api.resetLocationForm}
            handleLocationSubmit={api.handleLocationSubmit}
            savingLocation={api.savingLocation}
            handleDelete={api.handleDelete}
            toggleLocationActive={api.toggleLocationActive}
            locationNameError={api.locationNameError}
            locationCapacityError={api.locationCapacityError}
            usagePerLocation={api.usagePerLocation}
          />
        )}

        {mainTab === 'rapport' && (
          <ReportTab
            customers={api.customers}
            reportCustomerIds={api.reportCustomerIds}
            setReportCustomerIds={api.setReportCustomerIds}
            reportOrSearch={api.reportOrSearch}
            setReportOrSearch={api.setReportOrSearch}
            reportStartDate={api.reportStartDate}
            setReportStartDate={api.setReportStartDate}
            reportEndDate={api.reportEndDate}
            setReportEndDate={api.setReportEndDate}
            reportSummary={api.reportSummary}
            handleExportReportExcel={api.handleExportReportExcel}
          />
        )}

        {mainTab === 'opslagen' && (
          <>
            <ItemsTab
              customers={api.customers}
              locations={api.locations}
              activeItems={api.activeItems}
              stoppedItems={api.stoppedItems}
              itemsTab={api.itemsTab}
              setItemsTab={api.setItemsTab}
              setItemsPage={api.setItemsPage}
              itemsSearch={api.itemsSearch}
              setItemsSearch={api.setItemsSearch}
              itemsSortCol={api.itemsSortCol}
              itemsSortDir={api.itemsSortDir}
              toggleSort={api.toggleSort}
              paginatedItems={api.paginatedItems}
              displayedItemsLength={api.displayedItems.length}
              itemsPage={api.itemsPage}
              totalItemsPages={api.totalItemsPages}
              ITEMS_PER_PAGE={api.ITEMS_PER_PAGE}
              editingItem={api.editingItem}
              itemCustomerId={api.itemCustomerId}
              setItemCustomerId={(s) => {
                api.setItemCustomerId(s)
                api.setItemCustomerError?.('')
              }}
              itemLocationId={api.itemLocationId}
              setItemLocationId={api.setItemLocationId}
              itemDescription={api.itemDescription}
              setItemDescription={api.setItemDescription}
              itemOrNumber={api.itemOrNumber}
              setItemOrNumber={api.setItemOrNumber}
              itemCustomerDescription={api.itemCustomerDescription}
              setItemCustomerDescription={api.setItemCustomerDescription}
              itemForescoId={api.itemForescoId}
              setItemForescoId={api.setItemForescoId}
              itemPackingStatus={api.itemPackingStatus}
              setItemPackingStatus={api.setItemPackingStatus}
              itemPackedAt={api.itemPackedAt}
              setItemPackedAt={api.setItemPackedAt}
              itemM2={api.itemM2}
              setItemM2={(s) => {
                api.setItemM2(s)
                api.setItemM2Error?.('')
              }}
              itemM2Bare={api.itemM2Bare}
              setItemM2Bare={(s) => {
                api.setItemM2Bare(s)
                api.setItemM2Error?.('')
              }}
              itemM2Verpakt={api.itemM2Verpakt}
              setItemM2Verpakt={(s) => {
                api.setItemM2Verpakt(s)
                api.setItemM2Error?.('')
              }}
              itemPricePerM2={api.itemPricePerM2}
              setItemPricePerM2={api.setItemPricePerM2}
              itemStartDate={api.itemStartDate}
              setItemStartDate={api.setItemStartDate}
              itemEndDate={api.itemEndDate}
              setItemEndDate={api.setItemEndDate}
              itemNotes={api.itemNotes}
              setItemNotes={api.setItemNotes}
              itemActive={api.itemActive}
              setItemActive={api.setItemActive}
              resetItemForm={api.resetItemForm}
              handleCopyItem={api.handleCopyItem}
              handleItemSubmit={api.handleItemSubmit}
              handleStopItem={api.handleStopItem}
              handleDelete={api.handleDelete}
              setItemFormFromItem={api.setItemFormFromItem}
              setPhotoPanelItemId={api.setPhotoPanelItemId}
              getEffectiveM2={api.getEffectiveM2}
              getItemRevenue={api.getItemRevenue}
              savingItem={api.savingItem}
              stoppingItemId={api.stoppingItemId}
              handleExportItemsExcel={api.handleExportItemsExcel}
              itemCustomerError={api.itemCustomerError}
              itemM2Error={api.itemM2Error}
              drawerOpen={itemDrawerOpen}
              setDrawerOpen={(open) => {
                setItemDrawerOpen(open)
                if (!open) api.resetItemForm()
              }}
              locationFilter={api.locationFilter}
              setLocationFilter={api.setLocationFilter}
              statusFilter={api.statusFilter}
              setStatusFilter={api.setStatusFilter}
            />
            {api.photoPanelItemId != null && (
              <PhotoModal
                item={api.items.find((i) => i.id === api.photoPanelItemId) ?? null}
                onClose={() => {
                  api.setPhotoPanelItemId(null)
                  api.setPhotoDragOver(null)
                }}
                photoUploading={api.photoUploading}
                photoDragOver={api.photoDragOver}
                setPhotoDragOver={api.setPhotoDragOver}
                onUpload={api.handlePhotoUpload}
                onDeletePhoto={api.handlePhotoDelete}
                bareInputRef={bareInputRef}
                verpaktInputRef={verpaktInputRef}
              />
            )}
          </>
        )}

        {api.toasts.length > 0 && (
          <div
            className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
            role="status"
            aria-live="polite"
          >
            {api.toasts.map((t) => (
              <div
                key={t.id}
                className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
                  t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {t.message}
              </div>
            ))}
          </div>
        )}

        {api.confirmModal && (
          <ConfirmModal
            modal={api.confirmModal}
            onClose={() => api.setConfirmModal(null)}
            deleting={api.deleting}
          />
        )}

        {unsavedTabSwitch && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 id="unsaved-title" className="text-lg font-semibold text-gray-900 mb-2">
                Niet-opgeslagen wijzigingen
              </h3>
              <p className="text-gray-600 mb-6">
                Je hebt wijzigingen in een formulier. Als je van tab wisselt, gaan deze verloren.
                Doorgaan?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUnsavedTabSwitch(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleUnsavedConfirm}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Doorgaan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}

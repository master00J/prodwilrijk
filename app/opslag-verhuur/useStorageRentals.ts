'use client'

import {
  getEffectiveM2,
  getItemRevenue,
  getOverlapDays,
  MS_PER_DAY,
  toUtcDate,
} from '@/lib/opslag-verhuur/revenue'
import type { StorageRentalCustomer, StorageRentalItem, StorageRentalLocation } from '@/types/database'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

export type Toast = { id: number; message: string; type: 'success' | 'error' }
export type ConfirmModalState = {
  title: string
  message: string
  onConfirm: () => void | Promise<void>
}

export type ReportRow = {
  id: number
  or_number: string | null
  customer: string
  customer_description: string | null
  foresco_id: string | null
  description: string
  packing_status: string
  m2: number
  m2_bare: number
  m2_verpakt: number
  price: number
  overlapDays: number
  cost: number
  start: string
  end: string
  location: string
}

export type ReportSummaryResult = {
  error?: string
  totalDays?: number
  totalCost?: number
  averageM2?: number
  occupancyPercent?: number | null
  rows?: ReportRow[]
}

const parseNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const DEBOUNCE_MS = 300

export function useStorageRentals() {
  const [customers, setCustomers] = useState<StorageRentalCustomer[]>([])
  const [locations, setLocations] = useState<StorageRentalLocation[]>([])
  const [items, setItems] = useState<StorageRentalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [itemsTab, setItemsTab] = useState<'actief' | 'gestopt'>('actief')

  const [editingCustomer, setEditingCustomer] = useState<StorageRentalCustomer | null>(null)
  const [customerName, setCustomerName] = useState('')

  const [editingLocation, setEditingLocation] = useState<StorageRentalLocation | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locationCapacity, setLocationCapacity] = useState('')

  const [editingItem, setEditingItem] = useState<StorageRentalItem | null>(null)
  const [itemCustomerId, setItemCustomerId] = useState('')
  const [itemLocationId, setItemLocationId] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemOrNumber, setItemOrNumber] = useState('')
  const [itemCustomerDescription, setItemCustomerDescription] = useState('')
  const [itemForescoId, setItemForescoId] = useState('')
  const [itemPackingStatus, setItemPackingStatus] = useState<'bare' | 'verpakt'>('bare')
  const [itemPackedAt, setItemPackedAt] = useState('')
  const [itemM2, setItemM2] = useState('')
  const [itemM2Bare, setItemM2Bare] = useState('')
  const [itemM2Verpakt, setItemM2Verpakt] = useState('')
  const [itemPricePerM2, setItemPricePerM2] = useState('')
  const [itemStartDate, setItemStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [itemEndDate, setItemEndDate] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [itemActive, setItemActive] = useState(true)

  const [reportCustomerIds, setReportCustomerIds] = useState<string[]>([])
  const [reportOrSearch, setReportOrSearch] = useState('')
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  const [photoPanelItemId, setPhotoPanelItemId] = useState<number | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState<'bare' | 'verpakt' | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)
  const [itemsSearch, setItemsSearch] = useState('')
  const [itemsSearchDebounced, setItemsSearchDebounced] = useState('')
  const [itemsSortCol, setItemsSortCol] = useState<string>('start_date')
  const [itemsSortDir, setItemsSortDir] = useState<'asc' | 'desc'>('desc')
  const [itemsPage, setItemsPage] = useState(1)

  const [savingCustomer, setSavingCustomer] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [stoppingItemId, setStoppingItemId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [customerNameError, setCustomerNameError] = useState('')
  const [locationNameError, setLocationNameError] = useState('')
  const [locationCapacityError, setLocationCapacityError] = useState('')
  const [itemCustomerError, setItemCustomerError] = useState('')
  const [itemM2Error, setItemM2Error] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setItemsSearchDebounced(itemsSearch), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [itemsSearch])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const params = '?include_inactive=true'
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
      showToast('Ophalen mislukt', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ITEMS_PER_PAGE = 25
  const activeItems = useMemo(() => items.filter((item) => item.active !== false), [items])
  const stoppedItems = useMemo(() => items.filter((item) => item.active === false), [items])

  const displayedItems = useMemo(() => {
    const list = itemsTab === 'actief' ? activeItems : stoppedItems
    const q = itemsSearchDebounced.trim().toLowerCase()
    let filtered = q
      ? list.filter(
          (item) =>
            (item.or_number || '').toLowerCase().includes(q) ||
            (item.customer_description || '').toLowerCase().includes(q) ||
            (item.foresco_id || '').toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q) ||
            (item.customer?.name || '').toLowerCase().includes(q) ||
            (item.location?.name || '').toLowerCase().includes(q)
        )
      : list
    const sorted = [...filtered].sort((a, b) => {
      const aVal =
        itemsSortCol === 'customer'
          ? (a.customer?.name || '')
          : itemsSortCol === 'start_date'
            ? (a.start_date || '')
            : itemsSortCol === 'm2'
              ? getEffectiveM2(a)
              : 0
      const bVal =
        itemsSortCol === 'customer'
          ? (b.customer?.name || '')
          : itemsSortCol === 'start_date'
            ? (b.start_date || '')
            : itemsSortCol === 'm2'
              ? getEffectiveM2(b)
              : 0
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return itemsSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return itemsSortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [itemsTab, activeItems, stoppedItems, itemsSearchDebounced, itemsSortCol, itemsSortDir])

  const paginatedItems = useMemo(() => {
    const start = (itemsPage - 1) * ITEMS_PER_PAGE
    return displayedItems.slice(start, start + ITEMS_PER_PAGE)
  }, [displayedItems, itemsPage])
  const totalItemsPages = Math.max(1, Math.ceil(displayedItems.length / ITEMS_PER_PAGE))

  const totalUsedM2 = useMemo(
    () => activeItems.reduce((sum, item) => sum + getEffectiveM2(item), 0),
    [activeItems]
  )
  const totalRevenue = useMemo(
    () => activeItems.reduce((sum, item) => sum + getItemRevenue(item), 0),
    [activeItems]
  )
  const totalCapacityM2 = useMemo(
    () =>
      locations
        .filter((loc) => loc.active !== false)
        .reduce((sum, loc) => sum + Number(loc.capacity_m2 || 0), 0),
    [locations]
  )
  const occupancy = totalCapacityM2 ? (totalUsedM2 / totalCapacityM2) * 100 : null
  const activeCustomersCount = useMemo(
    () => customers.filter((c) => c.active !== false).length,
    [customers]
  )

  const reportSummary = useMemo<ReportSummaryResult | null>(() => {
    const hasCustomerSelection = reportCustomerIds.length > 0
    if (!hasCustomerSelection && (!reportStartDate || !reportEndDate)) return null
    const today = new Date().toISOString().slice(0, 10)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const defaultStart = oneYearAgo.toISOString().slice(0, 10)
    const rangeStart = toUtcDate(reportStartDate || defaultStart)
    const rangeEnd = toUtcDate(reportEndDate || today)
    if (rangeEnd.getTime() < rangeStart.getTime())
      return { error: 'Einddatum moet na startdatum liggen.' }
    const totalDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1
    if (totalDays <= 0) return { error: 'Ongeldige periode.' }
    const selectedIds =
      reportCustomerIds.length > 0
        ? reportCustomerIds.map((id) => Number(id))
        : customers.map((c) => c.id)
    const customerItems = items.filter(
      (item) =>
        item.customer_id != null && selectedIds.includes(item.customer_id)
    )
    const rows: ReportRow[] = customerItems
      .map((item): ReportRow | null => {
        const itemStart = item.start_date ? toUtcDate(item.start_date) : null
        const itemEnd = item.end_date ? toUtcDate(item.end_date) : null
        const overlapDays = getOverlapDays(itemStart, itemEnd, rangeStart, rangeEnd)
        if (overlapDays <= 0) return null
        const overlapStartMs = Math.max((itemStart || rangeStart).getTime(), rangeStart.getTime())
        const overlapEndMs = Math.min((itemEnd || rangeEnd).getTime(), rangeEnd.getTime())
        const price = Number(item.price_per_m2 || 0)
        const m2Bare = Number(item.m2_bare ?? item.m2 ?? 0)
        const m2Verpakt = Number(item.m2_verpakt ?? item.m2 ?? 0)
        const packedAt = item.packed_at ? toUtcDate(item.packed_at) : null
        let cost = 0
        if (price > 0 && item.packing_status === 'verpakt' && packedAt && m2Bare > 0 && m2Verpakt > 0) {
          const splitMs = packedAt.getTime()
          const daysBare =
            splitMs <= overlapStartMs
              ? 0
              : splitMs > overlapEndMs
                ? Math.floor((overlapEndMs - overlapStartMs) / MS_PER_DAY) + 1
                : Math.floor((splitMs - overlapStartMs) / MS_PER_DAY)
          const daysVerpakt =
            splitMs > overlapEndMs
              ? 0
              : splitMs <= overlapStartMs
                ? Math.floor((overlapEndMs - overlapStartMs) / MS_PER_DAY) + 1
                : Math.floor((overlapEndMs - splitMs) / MS_PER_DAY) + 1
          cost = (m2Bare * price * daysBare + m2Verpakt * price * daysVerpakt) / 365
        } else {
          const m2 = item.packing_status === 'verpakt' ? m2Verpakt : m2Bare
          cost = m2 && price ? (m2 * price * overlapDays) / 365 : 0
        }
        const m2Display =
          item.packing_status === 'verpakt' && packedAt
            ? m2Verpakt
            : item.packing_status === 'verpakt'
              ? m2Verpakt
              : m2Bare
        return {
          id: item.id,
          or_number: item.or_number || null,
          customer:
            item.customer?.name ||
            customers.find((c) => c.id === item.customer_id)?.name ||
            '-',
          customer_description: item.customer_description || null,
          foresco_id: item.foresco_id || null,
          description: item.description || '',
          packing_status: item.packing_status || 'bare',
          m2: m2Display,
          m2_bare: m2Bare,
          m2_verpakt: m2Verpakt,
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

    const searchQ = reportOrSearch.trim().toLowerCase()
    const filteredRows = searchQ
      ? rows.filter(
          (row) =>
            (row.or_number || '').toLowerCase().includes(searchQ) ||
            (row.customer || '').toLowerCase().includes(searchQ) ||
            (row.customer_description || '').toLowerCase().includes(searchQ) ||
            (row.foresco_id || '').toLowerCase().includes(searchQ) ||
            (row.description || '').toLowerCase().includes(searchQ)
        )
      : rows
    const totalCost = filteredRows.reduce((sum, row) => sum + row.cost, 0)
    const totalM2Days = filteredRows.reduce((sum, row) => sum + row.m2 * row.overlapDays, 0)
    const averageM2 = totalM2Days / totalDays
    const occupancyPercent = totalCapacityM2 ? (averageM2 / totalCapacityM2) * 100 : null
    return {
      totalDays,
      totalCost,
      averageM2,
      occupancyPercent,
      rows: filteredRows,
    }
  }, [
    reportCustomerIds,
    reportOrSearch,
    reportStartDate,
    reportEndDate,
    items,
    locations,
    totalCapacityM2,
    customers,
  ])

  const resetCustomerForm = () => {
    setEditingCustomer(null)
    setCustomerName('')
    setCustomerNameError('')
  }
  const resetLocationForm = () => {
    setEditingLocation(null)
    setLocationName('')
    setLocationCapacity('')
    setLocationNameError('')
    setLocationCapacityError('')
  }
  const resetItemForm = () => {
    setEditingItem(null)
    setItemCustomerId('')
    setItemLocationId('')
    setItemDescription('')
    setItemOrNumber('')
    setItemCustomerDescription('')
    setItemForescoId('')
    setItemPackingStatus('bare')
    setItemPackedAt('')
    setItemM2('')
    setItemM2Bare('')
    setItemM2Verpakt('')
    setItemPricePerM2('')
    setItemStartDate(new Date().toISOString().slice(0, 10))
    setItemEndDate('')
    setItemNotes('')
    setItemActive(true)
    setItemCustomerError('')
    setItemM2Error('')
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

  const toggleSort = (col: string) => {
    setItemsSortDir(itemsSortCol === col ? (itemsSortDir === 'asc' ? 'desc' : 'asc') : 'desc')
    setItemsSortCol(col)
    setItemsPage(1)
  }

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerNameError('')
    if (!customerName.trim()) {
      setCustomerNameError('Naam is verplicht')
      showToast('Naam is verplicht', 'error')
      return
    }
    setSavingCustomer(true)
    try {
      const payload = { id: editingCustomer?.id, name: customerName.trim() }
      const res = await fetch('/api/storage-rentals/customers', {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'Klant opslaan mislukt', 'error')
        return
      }
      await fetchAll()
      resetCustomerForm()
      showToast('Klant opgeslagen')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocationNameError('')
    setLocationCapacityError('')
    if (!locationName.trim()) {
      setLocationNameError('Naam is verplicht')
      showToast('Naam is verplicht', 'error')
      return
    }
    const cap = parseNumber(locationCapacity)
    if (locationCapacity.trim() !== '' && cap !== null && (cap < 0 || !Number.isFinite(cap))) {
      setLocationCapacityError('Voer een geldig getal in')
      showToast('Capaciteit moet een geldig getal zijn', 'error')
      return
    }
    setSavingLocation(true)
    try {
      const capacityValue = parseNumber(locationCapacity)
      const payload = {
        id: editingLocation?.id,
        name: locationName.trim(),
        capacity_m2: capacityValue,
      }
      const res = await fetch('/api/storage-rentals/locations', {
        method: editingLocation ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'Locatie opslaan mislukt', 'error')
        return
      }
      await fetchAll()
      resetLocationForm()
      showToast('Locatie opgeslagen')
    } finally {
      setSavingLocation(false)
    }
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setItemCustomerError('')
    setItemM2Error('')
    if (!itemCustomerId) {
      setItemCustomerError('Klant is verplicht')
      showToast('Klant is verplicht', 'error')
      return
    }
    const m2BareVal = parseNumber(itemM2Bare || itemM2)
    const m2VerpaktVal = parseNumber(itemM2Verpakt || itemM2)
    const m2Val =
      itemPackingStatus === 'verpakt'
        ? (m2VerpaktVal ?? m2BareVal)
        : (m2BareVal ?? m2VerpaktVal)
    if (!m2Val || m2Val <= 0) {
      setItemM2Error('Geef een geldig m² in (bare of verpakt)')
      showToast('Geef een geldig m² in (bare of verpakt)', 'error')
      return
    }
    const priceValue = parseNumber(itemPricePerM2)
    const payload = {
      id: editingItem?.id,
      customer_id: Number(itemCustomerId),
      location_id: itemLocationId ? Number(itemLocationId) : null,
      description: itemDescription.trim() || null,
      or_number: itemOrNumber.trim() || null,
      customer_description: itemCustomerDescription.trim() || null,
      foresco_id: itemForescoId.trim() || null,
      packing_status: itemPackingStatus,
      packed_at: itemPackedAt.trim() || null,
      m2: m2Val,
      m2_bare: m2BareVal ?? m2Val,
      m2_verpakt: m2VerpaktVal ?? m2Val,
      price_per_m2: priceValue,
      start_date: itemStartDate || null,
      end_date: itemEndDate || null,
      notes: itemNotes.trim() || null,
      active: itemActive,
    }
    setSavingItem(true)
    try {
      const res = await fetch('/api/storage-rentals/items', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'Opslag opslaan mislukt', 'error')
        return
      }
      await fetchAll()
      resetItemForm()
      showToast('Opslag opgeslagen')
    } finally {
      setSavingItem(false)
    }
  }

  const handleStopItem = async (item: StorageRentalItem) => {
    const endDate = item.end_date || new Date().toISOString().slice(0, 10)
    setStoppingItemId(item.id)
    try {
      const res = await fetch('/api/storage-rentals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, active: false, end_date: endDate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'Opslag stoppen mislukt', 'error')
        return
      }
      await fetchAll()
      showToast('Opslag gestopt')
    } finally {
      setStoppingItemId(null)
    }
  }

  const handlePhotoUpload = async (
    itemId: number,
    category: 'bare' | 'verpakt',
    files: FileList | null
  ) => {
    if (!files?.length) return
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('itemId', String(itemId))
      fd.append('category', category)
      for (let i = 0; i < files.length; i++) fd.append('photos', files[i])
      const res = await fetch('/api/storage-rentals/items/upload-photo', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload mislukt')
      await fetchAll()
      showToast("Foto's geüpload")
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload mislukt', 'error')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handlePhotoDelete = async (
    item: StorageRentalItem,
    category: 'bare' | 'verpakt',
    photoUrl: string
  ) => {
    const current = category === 'bare' ? (item.photos_bare || []) : (item.photos_verpakt || [])
    const next = current.filter((url) => url !== photoUrl)
    setPhotoUploading(true)
    try {
      const res = await fetch('/api/storage-rentals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          photos_bare: category === 'bare' ? next : item.photos_bare,
          photos_verpakt: category === 'verpakt' ? next : item.photos_verpakt,
        }),
      })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      await fetchAll()
      showToast('Foto verwijderd')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Verwijderen mislukt', 'error')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleDelete = (type: 'customer' | 'location' | 'item', id: number) => {
    setConfirmModal({
      title: 'Verwijderen bevestigen',
      message:
        'Ben je zeker dat je dit wil verwijderen? Deze actie kan niet ongedaan gemaakt worden.',
      onConfirm: async () => {
        setDeleting(true)
        try {
          const res = await fetch(`/api/storage-rentals/${type}s`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          setConfirmModal(null)
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            showToast(err.error || 'Verwijderen mislukt', 'error')
            return
          }
          await fetchAll()
          showToast('Verwijderd')
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  const handleExportReportExcel = () => {
    if (!reportSummary || reportSummary.error || !reportSummary.rows) {
      showToast('Selecteer eerst een geldige periode.', 'error')
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
    showToast('Rapport geëxporteerd')
  }

  const handleExportItemsExcel = () => {
    const list = itemsTab === 'actief' ? activeItems : stoppedItems
    const headers = [
      'OR',
      'Klant',
      'Omschr. klant',
      'Foresco ID',
      'Status',
      'Locatie',
      'Omschrijving',
      'm²',
      'Prijs/m²',
      'Rendement',
      'Start',
      'Einde',
    ]
    const rows = list.map((item) => [
      item.or_number || '-',
      item.customer?.name || '-',
      item.customer_description || '-',
      item.foresco_id || '-',
      item.packing_status || 'bare',
      item.location?.name || '-',
      item.description || '-',
      getEffectiveM2(item).toFixed(2),
      item.price_per_m2 ? Number(item.price_per_m2).toFixed(2) : '-',
      itemsTab === 'gestopt'
        ? getItemRevenue(item).toFixed(2)
        : (getEffectiveM2(item) * Number(item.price_per_m2 || 0)).toFixed(2),
      item.start_date || '-',
      item.end_date || '-',
    ])
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, itemsTab === 'actief' ? 'Actief' : 'Gestopt')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opslag-${itemsTab}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Items geëxporteerd')
  }

  const setItemFormFromItem = (item: StorageRentalItem) => {
    setEditingItem(item)
    setItemCustomerId(item.customer_id ? String(item.customer_id) : '')
    setItemLocationId(item.location_id ? String(item.location_id) : '')
    setItemDescription(item.description || '')
    setItemOrNumber(item.or_number || '')
    setItemCustomerDescription(item.customer_description || '')
    setItemForescoId(item.foresco_id || '')
    setItemPackingStatus(item.packing_status === 'verpakt' ? 'verpakt' : 'bare')
    setItemPackedAt(item.packed_at || '')
    setItemM2Bare(item.m2_bare?.toString() || '')
    setItemM2Verpakt(item.m2_verpakt?.toString() || '')
    setItemM2(item.m2?.toString() || '')
    setItemPricePerM2(item.price_per_m2?.toString() || '')
    setItemStartDate(item.start_date || new Date().toISOString().slice(0, 10))
    setItemEndDate(item.end_date || '')
    setItemNotes(item.notes || '')
    setItemActive(item.active !== false)
  }

  const toggleCustomerActive = async (customer: StorageRentalCustomer) => {
    const res = await fetch('/api/storage-rentals/customers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: customer.id, active: customer.active === false }),
    })
    if (res.ok) {
      await fetchAll()
      showToast(customer.active === false ? 'Klant geactiveerd' : 'Klant gedeactiveerd')
    } else {
      showToast('Actie mislukt', 'error')
    }
  }

  const toggleLocationActive = async (location: StorageRentalLocation) => {
    const res = await fetch('/api/storage-rentals/locations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: location.id, active: location.active === false }),
    })
    if (res.ok) {
      await fetchAll()
      showToast(location.active === false ? 'Locatie geactiveerd' : 'Locatie gedeactiveerd')
    } else {
      showToast('Actie mislukt', 'error')
    }
  }

  return {
    loading,
    fetchAll,
    customers,
    locations,
    items,
    activeItems,
    stoppedItems,
    totalUsedM2,
    totalRevenue,
    totalCapacityM2,
    occupancy,
    activeCustomersCount,
    reportSummary,
    reportCustomerIds,
    setReportCustomerIds,
    reportOrSearch,
    setReportOrSearch,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    handleExportReportExcel,
    editingCustomer,
    setEditingCustomer,
    customerName,
    setCustomerName,
    resetCustomerForm,
    handleCustomerSubmit,
    savingCustomer,
    editingLocation,
    setEditingLocation,
    locationName,
    setLocationName,
    locationCapacity,
    setLocationCapacity,
    resetLocationForm,
    handleLocationSubmit,
    savingLocation,
    editingItem,
    setEditingItem,
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
    savingItem,
    stoppingItemId,
    deleting,
    itemsTab,
    setItemsTab,
    itemsSearch,
    setItemsSearch,
    itemsSortCol,
    itemsSortDir,
    itemsPage,
    setItemsPage,
    toggleSort,
    displayedItems,
    paginatedItems,
    totalItemsPages,
    ITEMS_PER_PAGE,
    handleExportItemsExcel,
    photoPanelItemId,
    setPhotoPanelItemId,
    photoUploading,
    photoDragOver,
    setPhotoDragOver,
    handlePhotoUpload,
    handlePhotoDelete,
    toasts,
    confirmModal,
    setConfirmModal,
    showToast,
    toggleCustomerActive,
    toggleLocationActive,
    getEffectiveM2,
    getItemRevenue,
    customerNameError,
    locationNameError,
    locationCapacityError,
    itemCustomerError,
    itemM2Error,
    setCustomerNameError,
    setLocationNameError,
    setLocationCapacityError,
    setItemCustomerError,
    setItemM2Error,
  }
}

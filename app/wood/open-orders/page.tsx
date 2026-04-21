'use client'

import { useState, useEffect, useRef } from 'react'
import { WoodOrder } from '@/types/database'

// Types voor PDF-import (CMR Summary van Foresco).
interface ForescoPackage {
  pakketnummer: string
  houtsoort: string | null
  dikte: number | null
  breedte: number | null
  exacte_lengte: number | null
  planken_per_pak: number | null
  raw_hint: string | null
}

type ImportRowStatus = 'ready' | 'matched' | 'no_match' | 'skip' | 'saving' | 'done' | 'error' | 'duplicate'

interface ImportRow {
  key: string
  pkg: ForescoPackage
  orderId: number | null
  status: ImportRowStatus
  message: string | null
  candidates: WoodOrder[]
  // Overschrijfbare velden voor registratie
  pakketnummer: string
  exacte_dikte: string
  exacte_breedte: string
  exacte_lengte: string
  planken_per_pak: string
}

// Match een Foresco-pakket tegen de openstaande orders.
// Regels:
//  - Match op houtsoort (case-insensitief) + dikte + breedte.
//  - Bij meerdere kandidaten: kies degene met de kleinste absolute afwijking t.o.v. de
//    gescande lengte (min_lengte vs exacte_lengte). Bij gelijke afwijking: prioriteer
//    orders waar min_lengte <= exacte_lengte en de laagste open_pakken eerst wegboekt.
function matchCandidates(pkg: ForescoPackage, orders: WoodOrder[]): WoodOrder[] {
  if (!pkg.houtsoort || pkg.dikte == null || pkg.breedte == null) return []
  const hs = pkg.houtsoort.toLowerCase()
  const hits = orders.filter(
    (o) =>
      o.open_pakken > 0 &&
      (o.houtsoort || '').toLowerCase() === hs &&
      Number(o.dikte) === Number(pkg.dikte) &&
      Number(o.breedte) === Number(pkg.breedte)
  )
  if (pkg.exacte_lengte == null) return hits
  const target = pkg.exacte_lengte
  return [...hits].sort((a, b) => {
    const da = Math.abs(Number(a.min_lengte) - target)
    const db = Math.abs(Number(b.min_lengte) - target)
    if (da !== db) return da - db
    // Bij gelijke afwijking: eerst orders waarvan min_lengte <= target (exacte lengte
    // is groter of gelijk dan besteld → acceptabel), daarna oplopend open_pakken.
    const aOk = Number(a.min_lengte) <= target ? 0 : 1
    const bOk = Number(b.min_lengte) <= target ? 0 : 1
    if (aOk !== bOk) return aOk - bOk
    return a.open_pakken - b.open_pakken
  })
}

// Editable Cell Component
interface EditableCellProps {
  orderId: number
  field: string
  value: string | number
  editing: boolean
  onEdit: () => void
  onSave: (value: string) => void
  onCancel: () => void
  type?: 'text' | 'number'
  suffix?: string
  placeholder?: string
  className?: string
  multiline?: boolean
}

function EditableCell({
  orderId,
  field,
  value,
  editing,
  onEdit,
  onSave,
  onCancel,
  type = 'text',
  suffix = '',
  placeholder = '',
  className = '',
  multiline = false,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [editValue, setEditValue] = useState(value?.toString() || '')

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  useEffect(() => {
    setEditValue(value?.toString() || '')
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleSave = () => {
    if (editValue !== value?.toString()) {
      onSave(editValue)
    } else {
      onCancel()
    }
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || '')
    onCancel()
  }

  if (editing) {
    if (multiline) {
      return (
        <td className={className}>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </td>
      )
    }
    return (
      <td className={className}>
        <div className="flex items-center gap-1">
          {type === 'number' ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-20 px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </td>
    )
  }

  const displayValue = value || placeholder || '-'
  return (
    <td
      className={`${className} cursor-pointer hover:bg-blue-50 transition-colors`}
      onDoubleClick={onEdit}
      title="Double-click to edit"
    >
      {displayValue}{suffix && displayValue !== '-' ? suffix : ''}
    </td>
  )
}

export default function OpenOrdersPage() {
  const [orders, setOrders] = useState<WoodOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [sendingPdf, setSendingPdf] = useState(false)
  const [autoOrderRunning, setAutoOrderRunning] = useState(false)
  const [deletingOrders, setDeletingOrders] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<WoodOrder | null>(null)
  const [editingCell, setEditingCell] = useState<{ orderId: number; field: string } | null>(null)
  const [bcCodes, setBcCodes] = useState<Record<string, string>>({})
  const [registerData, setRegisterData] = useState({
    pakketnummer: '',
    exacte_dikte: '',
    exacte_breedte: '',
    exacte_lengte: '',
    planken_per_pak: '',
    opmerking: '',
  })

  // PDF-import (CMR Summary van Foresco)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [importingPdf, setImportingPdf] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/wood/open-orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()
      setOrders(data)
      
      // Fetch BC codes for all orders and update orders with BC codes
      if (data.length > 0) {
        const itemsForBcCode = data.map((item: WoodOrder) => ({
          breedte: item.breedte,
          dikte: item.dikte,
          houtsoort: item.houtsoort || ''
        }))
        const bcCodesData = await fetchBcCodes(itemsForBcCode)
        setBcCodes(bcCodesData)
        
        // Update orders with BC codes
        const updatedData = data.map((item: WoodOrder) => {
          const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
          const key = `${item.breedte}-${item.dikte}-${houtsoort}`
          return {
            ...item,
            bc_code: bcCodesData[key] || item.bc_code || ''
          }
        })
        setOrders(updatedData)
      } else {
        setOrders(data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      alert('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchBcCodes = async (items: Array<{ breedte: number; dikte: number; houtsoort: string }>) => {
    try {
      const response = await fetch('/api/wood/bc-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!response.ok) return {}
      const data = await response.json()
      return data.bc_codes || {}
    } catch (error) {
      console.error('Error fetching BC codes:', error)
      return {}
    }
  }

  const handleCellEdit = (orderId: number, field: string) => {
    setEditingCell({ orderId, field })
  }

  const handleCellSave = async (orderId: number, field: string, newValue: string) => {
    try {
      const response = await fetch(`/api/wood/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: newValue }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update field')
      }

      // Update local state
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          const updatedOrder = {
            ...order,
            [field]: ['aantal_pakken', 'dikte', 'breedte', 'min_lengte', 'planken_per_pak'].includes(field)
              ? parseFloat(newValue) || 0
              : newValue
          }
          
          // If dimensions or houtsoort changed, update BC code
          if (['dikte', 'breedte', 'houtsoort'].includes(field)) {
            const houtsoort = updatedOrder.houtsoort ? updatedOrder.houtsoort.toLowerCase() : ''
            const key = `${updatedOrder.breedte}-${updatedOrder.dikte}-${houtsoort}`
            updatedOrder.bc_code = bcCodes[key] || ''
          }
          
          return updatedOrder
        }
        return order
      })
      
      setOrders(updatedOrders)
      setEditingCell(null)
    } catch (error) {
      console.error('Error updating field:', error)
      alert(error instanceof Error ? error.message : 'Failed to update field')
      setEditingCell(null)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
  }

  const handleAutoOrder = async () => {
    if (!confirm('Do you want to run automatic ordering based on target stock? This will create orders for items below target levels.')) {
      return
    }

    setAutoOrderRunning(true)
    try {
      const response = await fetch('/api/wood/auto-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to run auto-order')
      }

      const result = await response.json()
      alert(`Auto-order completed! Created ${result.orders?.length || 0} new orders.`)
      await fetchOrders()
    } catch (error) {
      console.error('Error running auto-order:', error)
      alert(error instanceof Error ? error.message : 'Failed to run auto-order')
    } finally {
      setAutoOrderRunning(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedOrders.size} order(s)? This action cannot be undone.`)) {
      return
    }

    setDeletingOrders(true)
    try {
      const response = await fetch('/api/wood/orders/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedOrders) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete orders')
      }

      alert(`Successfully deleted ${selectedOrders.size} order(s)`)
      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error('Error deleting orders:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete orders')
    } finally {
      setDeletingOrders(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])


  const handleTogglePriority = async (id: number, currentPriority: boolean) => {
    try {
      const response = await fetch('/api/wood/open-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority: !currentPriority }),
      })

      if (!response.ok) throw new Error('Failed to update priority')
      await fetchOrders()
    } catch (error) {
      console.error('Error updating priority:', error)
      alert('Failed to update priority')
    }
  }

  const handleArchive = async (id: number) => {
    if (!confirm('Are you sure you want to archive this order?')) return

    try {
      const response = await fetch('/api/wood/open-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, gearchiveerd: true }),
      })

      if (!response.ok) throw new Error('Failed to archive order')
      await fetchOrders()
    } catch (error) {
      console.error('Error archiving order:', error)
      alert('Failed to archive order')
    }
  }

  const handleOpenRegisterModal = (order: WoodOrder) => {
    setSelectedOrder(order)
    setRegisterData({
      pakketnummer: '',
      exacte_dikte: order.dikte.toString(),
      exacte_breedte: order.breedte.toString(),
      exacte_lengte: order.min_lengte.toString(),
      planken_per_pak: order.planken_per_pak.toString(),
      opmerking: '',
    })
    setShowRegisterModal(true)
  }

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    }
  }

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedOrders(newSelected)
  }

  const handleSendPdf = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order to send.')
      return
    }

    setSendingPdf(true)
    try {
      const filteredData = orders.filter(item => selectedOrders.has(item.id) && item.open_pakken > 0)

      const itemsForBcCode = filteredData.map(item => ({
        breedte: item.breedte,
        dikte: item.dikte,
        houtsoort: item.houtsoort || ''
      }))

      const bcCodes = await fetchBcCodes(itemsForBcCode)

      const updatedData = filteredData.map(item => {
        const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
        const key = `${item.breedte}-${item.dikte}-${houtsoort}`
        return {
          ...item,
          bc_code: bcCodes[key] || ''
        }
      })

      // Sort data: priority first, then by houtsoort, dikte, breedte, lengte
      const sortedData = updatedData.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority ? 1 : -1
        }
        if (a.houtsoort !== b.houtsoort) {
          return a.houtsoort.localeCompare(b.houtsoort)
        }
        const dikteA = parseFloat(a.dikte.toString())
        const dikteB = parseFloat(b.dikte.toString())
        if (dikteA !== dikteB) {
          return dikteA - dikteB
        }
        const breedteA = parseFloat(a.breedte.toString())
        const breedteB = parseFloat(b.breedte.toString())
        if (breedteA !== breedteB) {
          return breedteA - breedteB
        }
        const lengteA = parseFloat(a.min_lengte.toString() || '0')
        const lengteB = parseFloat(b.min_lengte.toString() || '0')
        return lengteA - lengteB
      })

      // Column order for PDF
      const pdfColumnOrder = [
        'dikte',
        'breedte',
        'min_lengte',
        'houtsoort',
        'aantal_pakken',
        'ontvangen_pakken',
        'open_pakken',
        'bc_code',
        'opmerkingen',
        'besteld_op'
      ]

      // Column headers for PDF
      const pdfColumnHeaders = {
        'dikte': 'Dikte',
        'breedte': 'Breedte',
        'min_lengte': 'Lengte',
        'houtsoort': 'Houtsoort',
        'aantal_pakken': 'Besteld',
        'ontvangen_pakken': 'Ontvangen',
        'open_pakken': 'Open',
        'bc_code': 'BC Code',
        'opmerkingen': 'Opmerkingen',
        'besteld_op': 'Besteld Op'
      }

      const response = await fetch('/api/wood/send-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderList: sortedData,
          columnOrder: pdfColumnOrder,
          columnHeaders: pdfColumnHeaders
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send PDF')
      }

      alert('Order successfully sent as PDF!')
      setSelectedOrders(new Set())
    } catch (error) {
      console.error('Error sending email with PDF:', error)
      alert(error instanceof Error ? error.message : 'Failed to send order')
    } finally {
      setSendingPdf(false)
    }
  }

  const handleRegisterPackage = async () => {
    if (!selectedOrder || !registerData.pakketnummer || !registerData.exacte_dikte || 
        !registerData.exacte_breedte || !registerData.exacte_lengte || !registerData.planken_per_pak) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/wood/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          pakketnummer: registerData.pakketnummer,
          houtsoort: selectedOrder.houtsoort,
          exacte_dikte: registerData.exacte_dikte,
          exacte_breedte: registerData.exacte_breedte,
          exacte_lengte: registerData.exacte_lengte,
          planken_per_pak: registerData.planken_per_pak,
          opmerking: registerData.opmerking || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to register package')
      }

      alert('Package registered successfully!')
      await fetchOrders()
      setShowRegisterModal(false)
      setSelectedOrder(null)
      setRegisterData({
        pakketnummer: '',
        exacte_dikte: '',
        exacte_breedte: '',
        exacte_lengte: '',
        planken_per_pak: '',
        opmerking: '',
      })
    } catch (error) {
      console.error('Error registering package:', error)
      alert(error instanceof Error ? error.message : 'Failed to register package')
    }
  }

  // ——— PDF IMPORT (Foresco CMR Summary) ————————————————————————————————
  const handlePdfImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (pdfInputRef.current) pdfInputRef.current.value = ''
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Selecteer een PDF-bestand.')
      return
    }

    setImportingPdf(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string).split(',')[1] || '').trim())
        reader.onerror = () => reject(new Error('PDF lezen mislukt'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/wood/parse-foresco-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: base64 }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `PDF-scan mislukt (${res.status})`)
      }
      const data = (await res.json()) as { packages: ForescoPackage[] }
      const pkgs = Array.isArray(data.packages) ? data.packages : []
      if (pkgs.length === 0) {
        alert('Geen pakketten gevonden in de PDF.')
        return
      }

      const rows: ImportRow[] = pkgs.map((pkg, idx) => {
        const candidates = matchCandidates(pkg, orders)
        const best = candidates[0] ?? null
        return {
          key: `imp-${idx}-${pkg.pakketnummer}`,
          pkg,
          orderId: best?.id ?? null,
          status: best ? 'matched' : 'no_match',
          message: best
            ? null
            : `Geen open order met ${pkg.houtsoort ?? '?'} ${pkg.dikte ?? '?'}x${pkg.breedte ?? '?'}`,
          candidates,
          pakketnummer: pkg.pakketnummer,
          exacte_dikte: pkg.dikte != null ? String(pkg.dikte) : '',
          exacte_breedte: pkg.breedte != null ? String(pkg.breedte) : '',
          exacte_lengte: pkg.exacte_lengte != null ? String(pkg.exacte_lengte) : '',
          planken_per_pak: pkg.planken_per_pak != null ? String(pkg.planken_per_pak) : '',
        }
      })
      setImportRows(rows)
      setShowImportModal(true)
    } catch (err) {
      console.error('PDF-import fout:', err)
      alert(err instanceof Error ? err.message : 'PDF-import mislukt')
    } finally {
      setImportingPdf(false)
    }
  }

  const updateImportRow = (key: string, patch: Partial<ImportRow>) => {
    setImportRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const handleImportSaveAll = async () => {
    const toSave = importRows.filter(
      (r) => r.status !== 'skip' && r.status !== 'done' && r.orderId != null
    )
    if (toSave.length === 0) {
      alert('Geen pakketten om te registreren.')
      return
    }

    setSavingImport(true)
    // Sequentieel afhandelen zodat de telling per order correct bijblijft.
    for (const row of toSave) {
      const order = orders.find((o) => o.id === row.orderId)
      if (!order) {
        updateImportRow(row.key, { status: 'error', message: 'Order niet meer beschikbaar' })
        continue
      }
      updateImportRow(row.key, { status: 'saving', message: null })
      try {
        const res = await fetch('/api/wood/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            pakketnummer: row.pakketnummer,
            houtsoort: order.houtsoort,
            exacte_dikte: row.exacte_dikte,
            exacte_breedte: row.exacte_breedte,
            exacte_lengte: row.exacte_lengte,
            planken_per_pak: row.planken_per_pak,
            opmerking: null,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const msg = (data?.error as string) || `Registratie mislukt (${res.status})`
          // "Package number already exists" behandelen we als duplicaat, niet als hard error
          const isDup = /already exists/i.test(msg)
          updateImportRow(row.key, {
            status: isDup ? 'duplicate' : 'error',
            message: msg,
          })
          continue
        }
        updateImportRow(row.key, { status: 'done', message: 'Geregistreerd' })
      } catch (err) {
        updateImportRow(row.key, {
          status: 'error',
          message: err instanceof Error ? err.message : 'Registratie mislukt',
        })
      }
    }
    setSavingImport(false)
    await fetchOrders()
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Open Orders</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchOrders}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            {selectedOrders.size === orders.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleSendPdf}
            disabled={sendingPdf || selectedOrders.size === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {sendingPdf ? 'Sending...' : 'Send PDF'}
          </button>
          <button
            onClick={handleAutoOrder}
            disabled={autoOrderRunning}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {autoOrderRunning ? 'Processing...' : '🤖 Auto-Order'}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={deletingOrders || selectedOrders.size === 0}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {deletingOrders ? 'Deleting...' : '🗑️ Delete Selected'}
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfImportSelect}
            className="hidden"
          />
          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={importingPdf}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Upload een Foresco CMR Summary PDF. De lijnen worden gematcht met open orders en Register Package wordt automatisch voorgesteld."
          >
            {importingPdf ? 'PDF lezen...' : '📄 Import PDF'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Length</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Width</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planks/Pack</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BC Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered On</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.filter(o => o.open_pakken > 0).length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-4 text-center text-gray-500">
                    No open orders found
                  </td>
                </tr>
              ) : (
                orders.filter(o => o.open_pakken > 0).map((order) => {
                  const progress = order.aantal_pakken > 0 
                    ? (order.ontvangen_pakken / order.aantal_pakken) * 100 
                    : 0
                  
                  return (
                    <tr
                      key={order.id}
                      className={order.priority ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleToggleSelect(order.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <EditableCell
                        orderId={order.id}
                        field="houtsoort"
                        value={order.houtsoort}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'houtsoort'}
                        onEdit={() => handleCellEdit(order.id, 'houtsoort')}
                        onSave={(value) => handleCellSave(order.id, 'houtsoort', value)}
                        onCancel={handleCellCancel}
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="min_lengte"
                        value={order.min_lengte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'min_lengte'}
                        onEdit={() => handleCellEdit(order.id, 'min_lengte')}
                        onSave={(value) => handleCellSave(order.id, 'min_lengte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="dikte"
                        value={order.dikte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'dikte'}
                        onEdit={() => handleCellEdit(order.id, 'dikte')}
                        onSave={(value) => handleCellSave(order.id, 'dikte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="breedte"
                        value={order.breedte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'breedte'}
                        onEdit={() => handleCellEdit(order.id, 'breedte')}
                        onSave={(value) => handleCellSave(order.id, 'breedte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="aantal_pakken"
                        value={order.aantal_pakken}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'aantal_pakken'}
                        onEdit={() => handleCellEdit(order.id, 'aantal_pakken')}
                        onSave={(value) => handleCellSave(order.id, 'aantal_pakken', value)}
                        onCancel={handleCellCancel}
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.ontvangen_pakken}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.open_pakken}
                      </td>
                      <EditableCell
                        orderId={order.id}
                        field="planken_per_pak"
                        value={order.planken_per_pak}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'planken_per_pak'}
                        onEdit={() => handleCellEdit(order.id, 'planken_per_pak')}
                        onSave={(value) => handleCellSave(order.id, 'planken_per_pak', value)}
                        onCancel={handleCellCancel}
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="bc_code"
                        value={order.bc_code || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'bc_code'}
                        onEdit={() => handleCellEdit(order.id, 'bc_code')}
                        onSave={(value) => handleCellSave(order.id, 'bc_code', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="locatie"
                        value={order.locatie || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'locatie'}
                        onEdit={() => handleCellEdit(order.id, 'locatie')}
                        onSave={(value) => handleCellSave(order.id, 'locatie', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="opmerkingen"
                        value={order.opmerkingen || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'opmerkingen'}
                        onEdit={() => handleCellEdit(order.id, 'opmerkingen')}
                        onSave={(value) => handleCellSave(order.id, 'opmerkingen', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 text-sm text-gray-500 max-w-xs"
                        multiline
                      />
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.besteld_op).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePriority(order.id, order.priority)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            order.priority
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {order.priority ? 'High' : 'Normal'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenRegisterModal(order)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Register Package
                          </button>
                          <button
                            onClick={() => handleArchive(order.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Package Modal */}
      {showRegisterModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Register Package for Receipt</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p><strong>Order:</strong> {selectedOrder.houtsoort} - {selectedOrder.dikte}x{selectedOrder.breedte}x{selectedOrder.min_lengte}mm</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-medium">Package Number *</label>
                <input
                  type="text"
                  value={registerData.pakketnummer}
                  onChange={(e) => setRegisterData({ ...registerData, pakketnummer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Planks per Package *</label>
                <input
                  type="number"
                  value={registerData.planken_per_pak}
                  onChange={(e) => setRegisterData({ ...registerData, planken_per_pak: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Thickness (mm) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={registerData.exacte_dikte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_dikte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Width (mm) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={registerData.exacte_breedte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_breedte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Length (mm) *</label>
                <input
                  type="number"
                  value={registerData.exacte_lengte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_lengte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Comment (optional)</label>
              <textarea
                value={registerData.opmerking}
                onChange={(e) => setRegisterData({ ...registerData, opmerking: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterPackage}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Register Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Import Modal (Foresco CMR Summary → Register Package batch) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold">PDF Import — Register Packages</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Elk pakket uit de PDF is gematcht met een openstaande order op basis van houtsoort
                  + dikte + breedte. Lengte wordt als tiebreaker gebruikt. Kies een andere order of
                  zet op &quot;Overslaan&quot; als het niet klopt.
                </p>
              </div>
              <button
                onClick={() => !savingImport && setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
                <span>Totaal: <strong>{importRows.length}</strong></span>
                <span>Gematcht: <strong className="text-green-600">{importRows.filter(r => r.status === 'matched' || r.status === 'ready').length}</strong></span>
                <span>Geen match: <strong className="text-amber-600">{importRows.filter(r => r.status === 'no_match').length}</strong></span>
                <span>Opgeslagen: <strong className="text-blue-600">{importRows.filter(r => r.status === 'done').length}</strong></span>
                <span>Fout/duplicaat: <strong className="text-red-600">{importRows.filter(r => r.status === 'error' || r.status === 'duplicate').length}</strong></span>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Pakketnr</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Hout</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">D×B×L (mm)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Planken</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Match met order</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {importRows.map((row) => {
                      const toneClass =
                        row.status === 'done'
                          ? 'bg-emerald-50'
                          : row.status === 'error'
                          ? 'bg-red-50'
                          : row.status === 'duplicate'
                          ? 'bg-amber-50'
                          : row.status === 'no_match'
                          ? 'bg-amber-50'
                          : row.status === 'skip'
                          ? 'bg-gray-100 opacity-60'
                          : ''
                      const selectedOrder = row.orderId ? orders.find((o) => o.id === row.orderId) : null
                      return (
                        <tr key={row.key} className={toneClass}>
                          <td className="px-3 py-2 font-mono text-xs">
                            <input
                              type="text"
                              value={row.pakketnummer}
                              onChange={(e) => updateImportRow(row.key, { pakketnummer: e.target.value })}
                              disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                            />
                          </td>
                          <td className="px-3 py-2">{row.pkg.houtsoort ?? '?'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={row.exacte_dikte}
                                onChange={(e) => updateImportRow(row.key, { exacte_dikte: e.target.value })}
                                disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                                className="w-14 px-1 py-1 border border-gray-300 rounded"
                              />
                              <span>×</span>
                              <input
                                type="number"
                                value={row.exacte_breedte}
                                onChange={(e) => updateImportRow(row.key, { exacte_breedte: e.target.value })}
                                disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                                className="w-14 px-1 py-1 border border-gray-300 rounded"
                              />
                              <span>×</span>
                              <input
                                type="number"
                                value={row.exacte_lengte}
                                onChange={(e) => updateImportRow(row.key, { exacte_lengte: e.target.value })}
                                disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                                className="w-16 px-1 py-1 border border-gray-300 rounded"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={row.planken_per_pak}
                              onChange={(e) => updateImportRow(row.key, { planken_per_pak: e.target.value })}
                              disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-right text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.orderId ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                const newId = v === '' ? null : Number(v)
                                updateImportRow(row.key, {
                                  orderId: newId,
                                  status: newId ? 'matched' : 'no_match',
                                  message: newId ? null : 'Geen order geselecteerd',
                                })
                              }}
                              disabled={row.status === 'done' || row.status === 'saving' || row.status === 'skip'}
                              className="max-w-[280px] px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">— Geen match —</option>
                              {/* Kandidaten (zelfde houtsoort+dikte+breedte), gesorteerd op lengte-afwijking */}
                              {row.candidates.length > 0 && (
                                <optgroup label="Kandidaten (houtsoort+dikte+breedte)">
                                  {row.candidates.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      #{o.id} {o.houtsoort} {o.dikte}×{o.breedte}×{o.min_lengte} — open {o.open_pakken}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {/* Alle overige open orders voor handmatige override */}
                              <optgroup label="Alle open orders">
                                {orders
                                  .filter((o) => o.open_pakken > 0 && !row.candidates.some((c) => c.id === o.id))
                                  .map((o) => (
                                    <option key={o.id} value={o.id}>
                                      #{o.id} {o.houtsoort} {o.dikte}×{o.breedte}×{o.min_lengte} — open {o.open_pakken}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            {selectedOrder && row.pkg.exacte_lengte != null && Number(selectedOrder.min_lengte) !== row.pkg.exacte_lengte && (
                              <div className="text-[10px] text-amber-700 mt-1">
                                Lengte order {selectedOrder.min_lengte} ≠ PDF {row.pkg.exacte_lengte}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  row.status === 'done'
                                    ? 'text-emerald-700 font-semibold'
                                    : row.status === 'error'
                                    ? 'text-red-700 font-semibold'
                                    : row.status === 'duplicate'
                                    ? 'text-amber-700 font-semibold'
                                    : row.status === 'no_match'
                                    ? 'text-amber-700'
                                    : row.status === 'skip'
                                    ? 'text-gray-500'
                                    : row.status === 'saving'
                                    ? 'text-blue-700'
                                    : 'text-gray-700'
                                }
                              >
                                {row.status === 'matched'
                                  ? 'Klaar'
                                  : row.status === 'no_match'
                                  ? 'Geen match'
                                  : row.status === 'saving'
                                  ? 'Opslaan…'
                                  : row.status === 'done'
                                  ? '✓ OK'
                                  : row.status === 'duplicate'
                                  ? 'Duplicaat'
                                  : row.status === 'skip'
                                  ? 'Overgeslagen'
                                  : row.status === 'error'
                                  ? 'Fout'
                                  : row.status}
                              </span>
                              {row.status !== 'done' && row.status !== 'saving' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateImportRow(row.key, {
                                      status: row.status === 'skip' ? (row.orderId ? 'matched' : 'no_match') : 'skip',
                                      message: null,
                                    })
                                  }
                                  className="text-[10px] text-gray-500 hover:text-gray-800 underline"
                                >
                                  {row.status === 'skip' ? 'terug' : 'skip'}
                                </button>
                              )}
                            </div>
                            {row.message && (
                              <div className="text-[10px] text-gray-500 mt-0.5 max-w-[260px] truncate" title={row.message}>
                                {row.message}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => !savingImport && setShowImportModal(false)}
                disabled={savingImport}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                {importRows.every((r) => r.status === 'done') ? 'Sluiten' : 'Annuleren'}
              </button>
              <button
                onClick={handleImportSaveAll}
                disabled={
                  savingImport ||
                  importRows.every((r) => r.status === 'done' || r.status === 'skip' || r.orderId == null)
                }
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:bg-gray-300"
              >
                {savingImport
                  ? 'Bezig…'
                  : `Registreer ${importRows.filter((r) => r.status !== 'skip' && r.status !== 'done' && r.orderId != null).length} pakket(ten)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


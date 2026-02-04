'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { parseProductionOrderXml } from '@/lib/production-order/parse-xml'
import { processSalesOrderExcel } from '@/lib/sales-orders/parse-excel'

export default function ProductionOrderUploadPage() {
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [excelFiles, setExcelFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [excelUploading, setExcelUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingExcel, setIsDraggingExcel] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const excelDropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

  const [latestOrder, setLatestOrder] = useState<{ order: any; lines: any[] } | null>(null)
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({})
  const [orderDetails, setOrderDetails] = useState<{
    order: any
    materials: Array<{ item_number: string; description: string | null; usage_count: number; price: number | null; unit_of_measure: string }>
    totals: { total_material_cost: number; missing_price_count: number }
  } | null>(null)
  const [materialEdits, setMaterialEdits] = useState<Record<string, string>>({})
  const [materialUnitEdits, setMaterialUnitEdits] = useState<Record<string, string>>({})

  const parseFlexibleNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null
    const normalized = String(value).replace(/\s/g, '').replace(',', '.')
    const parsed = parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const fetchLatestOrder = useCallback(async () => {
    try {
      const [latestRes, detailsRes] = await Promise.all([
        fetch('/api/production-orders/latest-for-time'),
        fetch('/api/production-order-time/order-details'),
      ])
      if (!latestRes.ok) return
      const latestData = await latestRes.json()
      setLatestOrder(latestData)
      setPriceEdits({})

      if (detailsRes.ok && latestData?.order?.order_number) {
        const detailsData = await detailsRes.json()
        const orders = detailsData.orders || []
        const match = orders.find((o: any) => o.order?.order_number === latestData.order.order_number)
        setOrderDetails(match || null)
        setMaterialEdits({})
        setMaterialUnitEdits({})
      } else {
        setOrderDetails(null)
      }
    } catch {
      setLatestOrder(null)
      setOrderDetails(null)
    }
  }, [])

  useEffect(() => {
    void fetchLatestOrder()
  }, [fetchLatestOrder])

  const handleXmlFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const xml = arr.filter((f) => f.name.toLowerCase().endsWith('.xml'))
    if (xml.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer XML bestanden (.xml)' })
      return
    }
    setXmlFile(xml[0])
    setMessage(null)
  }, [])

  const handleExcelFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const excel = arr.filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    if (excel.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer Excel bestanden (.xlsx, .xls)' })
      return
    }
    setExcelFiles((prev) => [...prev, ...excel])
    setMessage(null)
  }, [])

  const handleXmlDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])
  const handleXmlDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])
  const handleXmlDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (e.dataTransfer.files?.length) handleXmlFiles(e.dataTransfer.files)
    },
    [handleXmlFiles]
  )

  const handleExcelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingExcel(true)
  }, [])
  const handleExcelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingExcel(false)
  }, [])
  const handleExcelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingExcel(false)
      if (e.dataTransfer.files?.length) handleExcelFiles(e.dataTransfer.files)
    },
    [handleExcelFiles]
  )

  const handleExcelUpload = async () => {
    if (excelFiles.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer Excel bestanden' })
      return
    }
    setExcelUploading(true)
    setMessage(null)
    try {
      const allItems: Array<{ item_number: string; price: number; description: string }> = []
      for (const file of excelFiles) {
        const items = await processSalesOrderExcel(file)
        allItems.push(...items)
      }
      if (allItems.length === 0) {
        throw new Error('Geen geldige items in Excel. Omschrijving moet itemnummer tussen haakjes bevatten.')
      }
      const res = await fetch('/api/sales-orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allItems }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload mislukt')
      setMessage({ type: 'success', text: `${data.insertedRows || allItems.length} verkooporderprijzen geüpload.` })
      setExcelFiles([])
      if (excelInputRef.current) excelInputRef.current.value = ''
      fetchLatestOrder()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Excel upload mislukt' })
    } finally {
      setExcelUploading(false)
    }
  }

  const handleXmlUpload = async () => {
    if (!xmlFile) {
      setMessage({ type: 'error', text: 'Selecteer een XML bestand' })
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const parsed = await parseProductionOrderXml(xmlFile)
      if (!parsed.lines || parsed.lines.length === 0) {
        throw new Error('Geen productieorder lijnen gevonden in XML.')
      }
      const res = await fetch('/api/production-orders/upload-for-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload mislukt')
      setMessage({
        type: 'success',
        text: `Productieorder ${result.order_number} geüpload met ${result.line_count} lijnen.`,
      })
      setXmlFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchLatestOrder()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'XML upload mislukt' })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveMaterialPrices = async () => {
    if (!orderDetails?.materials?.length) return
    const items = orderDetails.materials
      .map((material: any) => {
        const rawValue = materialEdits[material.item_number]
        const unitEdit = materialUnitEdits[material.item_number]
        if (rawValue === undefined && unitEdit === undefined) return null
        const parsed =
          rawValue !== undefined
            ? parseFlexibleNumber(rawValue)
            : parseFlexibleNumber(material.price)
        if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null
        return {
          item_number: material.item_number,
          price: parsed,
          description: material.description || null,
          unit_of_measure: unitEdit !== undefined ? unitEdit : material.unit_of_measure || 'stuks',
        }
      })
      .filter(Boolean)
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'Geen geldige prijswijzigingen om op te slaan.' })
      return
    }
    try {
      const res = await fetch('/api/material-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt')
      setMessage({ type: 'success', text: 'Materiaalprijzen opgeslagen.' })
      setMaterialEdits({})
      setMaterialUnitEdits({})
      fetchLatestOrder()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Opslaan mislukt' })
    }
  }

  const handleSavePrices = async () => {
    if (!latestOrder?.order) return
    const linePrices: Record<number, number | null> = {}
    for (const line of latestOrder.lines) {
      const val = priceEdits[line.id] ?? (line.sales_price != null ? String(line.sales_price) : '')
      const trimmed = String(val).trim()
      if (trimmed === '') {
        linePrices[line.id] = null
      } else {
        const parsed = parseFloat(String(val).replace(',', '.'))
        if (!isNaN(parsed) && parsed >= 0) linePrices[line.id] = parsed
      }
    }
    if (Object.keys(linePrices).length === 0) return

    try {
      const res = await fetch('/api/production-orders/lines/sales-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: latestOrder.order.order_number, prices: linePrices }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt')
      setMessage({ type: 'success', text: 'Verkoopprijzen opgeslagen.' })
      fetchLatestOrder()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Opslaan mislukt' })
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Productieorder upload (tijdregistratie)</h1>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          <p className="font-medium mb-1">Tijdregistratie-flow</p>
          <p>
            Upload productieorder XML (verplicht) en optioneel Excel met verkooporderprijzen. Nadien kun je verkoopprijzen
            per lijn en materiaalprijzen (grondstoffen) invullen. De materiaalkost berekening gebruikt dezelfde logica als
            admin/sales-orders: stuks, m² en m³ met afmetingen uit de XML.
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">1. Verkooporder Excel (optioneel)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload Excel met verkoopprijzen. Prijzen worden gekoppeld aan productieorderlijnen via itemnummer.
            </p>
            <div
              ref={excelDropZoneRef}
              onDragOver={handleExcelDragOver}
              onDragLeave={handleExcelDragLeave}
              onDrop={handleExcelDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center mb-4 ${
                isDraggingExcel ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <p className="text-sm text-gray-600">Sleep Excel (.xlsx) hierheen</p>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={(e) => e.target.files?.length && handleExcelFiles(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
              >
                Selecteer Excel
              </button>
            </div>
            {excelFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {excelFiles.map((f, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setExcelFiles((p) => p.filter((_, j) => j !== i))}
                      className="text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleExcelUpload}
              disabled={excelUploading || excelFiles.length === 0}
              className="w-full py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60"
            >
              {excelUploading ? 'Uploaden...' : 'Excel uploaden'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">2. Productieorder XML (verplicht)</h2>
            <p className="text-sm text-gray-500 mb-4">Upload de productieorder XML.</p>
            <div
              ref={dropZoneRef}
              onDragOver={handleXmlDragOver}
              onDragLeave={handleXmlDragLeave}
              onDrop={handleXmlDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center mb-4 ${
                isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <p className="text-sm text-gray-600">Sleep XML hierheen</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                onChange={(e) => e.target.files?.[0] && handleXmlFiles([e.target.files[0]])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm"
              >
                Selecteer XML
              </button>
            </div>
            {xmlFile && <p className="text-sm mb-4">Geselecteerd: {xmlFile.name}</p>}
            <button
              type="button"
              onClick={handleXmlUpload}
              disabled={uploading || !xmlFile}
              className="w-full py-2 bg-amber-600 text-white rounded-lg disabled:opacity-60"
            >
              {uploading ? 'Uploaden...' : 'XML uploaden'}
            </button>
          </div>
        </div>

        {latestOrder?.order && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              3. Verkoopprijzen – {latestOrder.order.order_number}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Vul verkoopprijzen in per lijn. Bij Excel-upload worden matchende prijzen vooraf ingevuld.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Omschrijving</th>
                    <th className="py-2 pr-4">Aantal</th>
                    <th className="py-2 pr-4">Verkoopprijs €</th>
                  </tr>
                </thead>
                <tbody>
                  {latestOrder.lines.map((line: any) => (
                    <tr key={line.id} className="border-t">
                      <td className="py-2 pr-4 font-medium">{line.item_number || '-'}</td>
                      <td className="py-2 pr-4">{line.description || '-'}</td>
                      <td className="py-2 pr-4">{line.quantity}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={
                            priceEdits[line.id] ??
                            (line.sales_price != null ? String(line.sales_price) : '')
                          }
                          onChange={(e) =>
                            setPriceEdits((p) => ({ ...p, [line.id]: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1 w-28"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleSavePrices}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Verkoopprijzen opslaan
            </button>
          </div>
        )}

        {orderDetails?.order && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mt-6">
            <h2 className="text-xl font-semibold mb-4">
              4. Materiaalprijzen – {orderDetails.order.order_number}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Vul prijzen in voor grondstoffen zonder prijs. Zelfde berekening als admin/sales-orders (stuks, m², m³).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500">Totale materiaalkost</div>
                <div className="text-lg font-semibold">
                  € {Number(orderDetails.totals?.total_material_cost || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500">Ontbrekende prijzen</div>
                <div className="text-lg font-semibold">{orderDetails.totals?.missing_price_count || 0}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4">Itemnummer</th>
                    <th className="py-2 pr-4">Omschrijving</th>
                    <th className="py-2 pr-4">Prijs / eenheid</th>
                    <th className="py-2 pr-4">Eenheid</th>
                    <th className="py-2 pr-4">Gebruik</th>
                  </tr>
                </thead>
                <tbody>
                  {(orderDetails.materials || []).map((material: any) => (
                    <tr key={material.item_number} className="border-t">
                      <td className="py-2 pr-4 font-medium">{material.item_number}</td>
                      <td className="py-2 pr-4">{material.description || '-'}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00000"
                          value={
                            materialEdits[material.item_number] ??
                            (material.price != null ? String(material.price) : '')
                          }
                          onChange={(e) =>
                            setMaterialEdits((p) => ({ ...p, [material.item_number]: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1 w-32"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={materialUnitEdits[material.item_number] ?? material.unit_of_measure ?? 'stuks'}
                          onChange={(e) =>
                            setMaterialUnitEdits((p) => ({ ...p, [material.item_number]: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="stuks">stuks</option>
                          <option value="m2">m²</option>
                          <option value="m3">m³</option>
                        </select>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{material.usage_count || 0}x</td>
                    </tr>
                  ))}
                  {(!orderDetails.materials || orderDetails.materials.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-3 text-gray-500">
                        Geen grondstoffen gevonden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleSaveMaterialPrices}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Materiaalprijzen opslaan
            </button>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}

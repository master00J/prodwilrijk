'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import AdminGuard from '@/components/AdminGuard'

export default function SalesOrdersUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [latestProductionOrder, setLatestProductionOrder] = useState<any>(null)
  const [materialEdits, setMaterialEdits] = useState<Record<string, string>>({})
  const [materialUnitEdits, setMaterialUnitEdits] = useState<Record<string, string>>({})

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const extractItemNumber = (description: string): string | null => {
    if (!description) return null
    
    // Extract item number from description like "860X470X220 KIST ISPM15 MPXM (1094139873)"
    // Pattern: text between parentheses at the end
    const match = description.match(/\(([^)]+)\)\s*$/)
    if (match && match[1]) {
      return match[1].trim()
    }
    return null
  }

  const parseFlexibleNumber = (value: string | null | undefined): number | null => {
    if (value === null || value === undefined) return null
    const normalized = String(value).replace(/\s/g, '').replace(',', '.')
    const parsed = parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const detectSalesOrderColumns = (rows: any[][]) => {
    const sampleRows = rows.slice(0, 200)
    const maxCols = sampleRows.reduce((max, row) => Math.max(max, row?.length || 0), 0)
    const descriptionScores = new Array(maxCols).fill(0)

    sampleRows.forEach((row) => {
      if (!row) return
      for (let col = 0; col < maxCols; col += 1) {
        const value = row[col]
        if (!value) continue
        const itemNumber = extractItemNumber(String(value))
        if (itemNumber) descriptionScores[col] += 1
      }
    })

    let descriptionIndex: number | null = null
    let bestDescriptionScore = 0
    descriptionScores.forEach((score, col) => {
      if (score > bestDescriptionScore) {
        bestDescriptionScore = score
        descriptionIndex = col
      }
    })

    let priceIndex: number | null = null
    let bestPairedScore = -1
    let bestNumericScore = -1
    for (let col = 0; col < maxCols; col += 1) {
      if (col === descriptionIndex) continue
      let numericScore = 0
      let pairedScore = 0
      sampleRows.forEach((row) => {
        if (!row) return
        const value = row[col]
        const price = parseFlexibleNumber(value)
        if (price === null) return
        numericScore += 1
        if (descriptionIndex !== null) {
          const descriptionValue = row[descriptionIndex]
          const itemNumber = descriptionValue ? extractItemNumber(String(descriptionValue)) : null
          if (itemNumber) pairedScore += 1
        }
      })
      if (pairedScore > bestPairedScore || (pairedScore === bestPairedScore && numericScore > bestNumericScore)) {
        bestPairedScore = pairedScore
        bestNumericScore = numericScore
        priceIndex = col
      }
    }

    return {
      descriptionIndex: descriptionIndex ?? 10,
      priceIndex: priceIndex ?? 0,
      detected: descriptionIndex !== null && priceIndex !== null,
    }
  }

  const processFile = async (file: File): Promise<Array<{ item_number: string; price: number; description: string }>> => {
    // Read file as array buffer
    const data = await readFileAsArrayBuffer(file)
    
    // Parse Excel file
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Read raw data to access specific columns
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]
    
    const { descriptionIndex, priceIndex, detected } = detectSalesOrderColumns(jsonData)
    if (!detected) {
      console.warn('Kon kolommen niet betrouwbaar detecteren, val terug op A en K.')
    }

    const validItems: Array<{ item_number: string; price: number; description: string }> = []
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      
      // Skip empty rows
      if (!row || row.length === 0) continue
      
      const priceValue = row[priceIndex]
      const price = parseFlexibleNumber(priceValue)
      
      const description = row[descriptionIndex] ? String(row[descriptionIndex]).trim() : null
      
      if (!description || price === null || isNaN(price) || price < 0) {
        continue
      }
      
      // Extract item number from description
      const itemNumber = extractItemNumber(description)
      
      if (!itemNumber) {
        console.warn(`Geen itemnummer gevonden in omschrijving: ${description}`)
        continue
      }
      
      validItems.push({
        item_number: itemNumber,
        price: price,
        description: description,
      })
    }

    return validItems
  }

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const excelFiles = fileArray.filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    )
    
    if (excelFiles.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer alleen Excel bestanden (.xlsx of .xls)' })
      return
    }

    setSelectedFiles(prev => [...prev, ...excelFiles])
    setMessage(null)
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer ten minste één bestand' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Process all files and combine items
      const allItems: Array<{ item_number: string; price: number; description: string }> = []
      
      for (const file of selectedFiles) {
        try {
          const items = await processFile(file)
          allItems.push(...items)
        } catch (error: any) {
          console.error(`Error processing file ${file.name}:`, error)
          throw new Error(`Fout bij verwerken van ${file.name}: ${error.message}`)
        }
      }

      if (allItems.length === 0) {
        throw new Error('Geen geldige data gevonden in de Excel bestanden. Controleer of de omschrijving een itemnummer tussen haakjes bevat en dat er een prijskolom aanwezig is.')
      }

      console.log(`Found ${allItems.length} valid items from ${selectedFiles.length} file(s)`)

      // Send to API
      const response = await fetch('/api/sales-orders/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: allItems }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Fout bij uploaden data')
      }

      setMessage({
        type: 'success',
        text: `Succesvol ${result.insertedRows || allItems.length} verkooporders geüpload van ${selectedFiles.length} bestand(en)!`,
      })
      
      // Reset
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('Error during upload:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Fout bij uploaden Excel bestanden',
      })
    } finally {
      setUploading(false)
    }
  }

  const fetchLatestProductionOrder = useCallback(async () => {
    try {
      const response = await fetch('/api/production-orders/latest')
      if (!response.ok) return
      const data = await response.json()
      setLatestProductionOrder(data)
    } catch (error) {
      console.error('Error fetching production order:', error)
    }
  }, [])

  const handleSaveMaterialPrices = async () => {
    if (!latestProductionOrder?.materials?.length) return
    const items = latestProductionOrder.materials
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
      setXmlMessage({ type: 'error', text: 'Geen geldige prijswijzigingen om op te slaan.' })
      return
    }

    try {
      const response = await fetch('/api/material-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Fout bij opslaan prijzen')
      }
      setMaterialEdits({})
      setMaterialUnitEdits({})
      fetchLatestProductionOrder()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Fout bij opslaan prijzen' })
    }
  }

  useEffect(() => {
    fetchLatestProductionOrder()
  }, [fetchLatestProductionOrder])

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Verkooporders Upload</h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Instructies:</h2>
          <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
            <li>Upload een Excel bestand met verkooporders</li>
            <li>De prijskolom en omschrijvingskolom worden automatisch herkend</li>
            <li>De omschrijving moet een itemnummer tussen haakjes bevatten</li>
            <li>Voorbeeld omschrijving: &quot;860X470X220 KIST ISPM15 MPXM (1094139873)&quot;</li>
          </ul>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Drag and Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <div className="space-y-4">
              <div className="text-4xl">📁</div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Sleep bestanden hierheen of klik om te selecteren
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Je kunt meerdere Excel bestanden tegelijk selecteren
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <label
                  htmlFor="file"
                  className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-medium transition-colors"
                >
                  Selecteer Bestanden
                </label>
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Geselecteerde bestanden ({selectedFiles.length}):
              </h3>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">📄</span>
                      <span className="text-sm font-medium text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm"
                      disabled={uploading}
                    >
                      ✕ Verwijderen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {uploading ? 'Uploaden...' : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} bestand(en)` : 'Verkooporders'}`}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4">Laatste productieorder (materiaalprijzen)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Productieorders voor prepack/materiaalkost worden via Admin → Productieorder upload geüpload.
          </p>

          {latestProductionOrder?.order && (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Productieorder</div>
                  <div className="text-lg font-semibold">{latestProductionOrder.order.order_number}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Verkooporder: {latestProductionOrder.order.sales_order_number || '-'}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Lijnen & materialen</div>
                  <div className="text-lg font-semibold">
                    {latestProductionOrder.totals?.line_count || 0} lijnen ·{' '}
                    {latestProductionOrder.totals?.component_count || 0} componenten
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ontbrekende prijzen: {latestProductionOrder.totals?.missing_price_count || 0}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Totale materiaalkost</div>
                  <div className="text-lg font-semibold">
                    € {Number(latestProductionOrder.totals?.total_material_cost || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Grondstoffen prijzen</h3>
                  <button
                    type="button"
                    onClick={handleSaveMaterialPrices}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Prijzen opslaan
                  </button>
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
                      {(latestProductionOrder.materials || []).map((material: any) => (
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
                                (material.price !== null && material.price !== undefined
                                  ? String(material.price)
                                  : '')
                              }
                              onChange={(e) =>
                                setMaterialEdits((prev) => ({
                                  ...prev,
                                  [material.item_number]: e.target.value,
                                }))
                              }
                              className="border border-gray-300 rounded px-2 py-1 w-32"
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={materialUnitEdits[material.item_number] ?? material.unit_of_measure ?? 'stuks'}
                              onChange={(e) =>
                                setMaterialUnitEdits((prev) => ({
                                  ...prev,
                                  [material.item_number]: e.target.value,
                                }))
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
                      {(!latestProductionOrder.materials || latestProductionOrder.materials.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-3 text-gray-500">
                            Geen grondstoffen gevonden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Materiaalkost per lijn</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">Lijn</th>
                        <th className="py-2 pr-4">Omschrijving</th>
                        <th className="py-2 pr-4">Aantal</th>
                        <th className="py-2 pr-4">Kost per stuk</th>
                        <th className="py-2 pr-4">Totale kost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestProductionOrder.lines || []).map((line: any) => (
                        <tr key={`${line.id}-${line.line_no}`} className="border-t">
                          <td className="py-2 pr-4">{line.item_number || line.item_no || '-'}</td>
                          <td className="py-2 pr-4">{line.description || '-'}</td>
                          <td className="py-2 pr-4">{line.quantity || 0}</td>
                          <td className="py-2 pr-4">€ {Number(line.cost_per_item || 0).toFixed(2)}</td>
                          <td className="py-2 pr-4">€ {Number(line.total_cost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(!latestProductionOrder.lines || latestProductionOrder.lines.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-3 text-gray-500">
                            Geen lijnen gevonden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

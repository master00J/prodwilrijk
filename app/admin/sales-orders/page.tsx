'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import AdminGuard from '@/components/AdminGuard'

export default function SalesOrdersUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

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

  const processFile = async (file: File): Promise<Array<{ item_number: string; price: number; description: string }>> => {
    // Read file as array buffer
    const data = await readFileAsArrayBuffer(file)
    
    // Parse Excel file
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Read raw data to access specific columns
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]
    
    // Process rows: Column A (index 0) = price, Column K (index 10) = description
    const validItems: Array<{ item_number: string; price: number; description: string }> = []
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      
      // Skip empty rows
      if (!row || row.length === 0) continue
      
      // Get price from column A (index 0)
      const priceValue = row[0]
      const price = priceValue ? parseFloat(String(priceValue)) : null
      
      // Get description from column K (index 10)
      const description = row[10] ? String(row[10]).trim() : null
      
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
        throw new Error('Geen geldige data gevonden in de Excel bestanden. Controleer of kolom A prijzen bevat en kolom K omschrijvingen met itemnummers tussen haakjes.')
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

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Verkooporders Upload</h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Instructies:</h2>
          <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
            <li>Upload een Excel bestand met verkooporders</li>
            <li>Kolom A moet de prijs bevatten</li>
            <li>Kolom K moet de omschrijving bevatten met itemnummer tussen haakjes</li>
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
      </div>
    </AdminGuard>
  )
}

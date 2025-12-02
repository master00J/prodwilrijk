'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

export default function WMSImportPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [importStats, setImportStats] = useState<{
    total: number
    fromToday: number
    inserted: number
    skipped: number
    errors: number
  } | null>(null)

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    const fileInput = event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement
    const file = fileInput?.files?.[0]

    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' })
      return
    }

    setUploading(true)
    setMessage(null)
    setImportStats(null)

    try {
      // Read file as array buffer (same as old code)
      const data = await readFileAsArrayBuffer(file)
      
      // Parse file with XLSX - it automatically detects format (Excel, CSV, TSV, etc.)
      // This is the same approach as the old code
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        throw new Error('No data found in the file. Please check that the file contains data rows.')
      }

      // Detect column names from first row - do this once for performance
      const firstRow = jsonData[0] as Record<string, any>
      let allKeys = Object.keys(firstRow)
      
      // Clean column names (remove quotes)
      const cleanKeys = allKeys.map(key => {
        let cleaned = key.trim()
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1).trim()
        }
        return cleaned
      })
      
      // Create a mapping from cleaned keys to original keys
      const keyMapping: Record<string, string> = {}
      allKeys.forEach((origKey, idx) => {
        keyMapping[cleanKeys[idx]] = origKey
      })
      
      // Debug: log available columns
      console.log('Available columns (original):', allKeys)
      console.log('Available columns (cleaned):', cleanKeys)
      
      // Find the date column name efficiently (check both original and cleaned keys)
      let dateColumnName: string | null = null
      const dateKeyVariations = ['laatste status verandering', 'laatste status', 'status verandering']
      
      for (const cleanKey of cleanKeys) {
        const lowerKey = cleanKey.toLowerCase()
        if (lowerKey.includes('laatste') && lowerKey.includes('status') && lowerKey.includes('verandering')) {
          dateColumnName = keyMapping[cleanKey] || cleanKey
          break
        }
      }
      
      // Fallback: try other variations
      if (!dateColumnName) {
        for (const cleanKey of cleanKeys) {
          const lowerKey = cleanKey.toLowerCase()
          if ((lowerKey.includes('status') && lowerKey.includes('verandering')) || 
              dateKeyVariations.some(v => lowerKey.includes(v))) {
            dateColumnName = keyMapping[cleanKey] || cleanKey
            break
          }
        }
      }

      // Map and validate the data - looking for WMS status 30 format
      // Expected columns: Item, Pallet, Qty, and "Laatste status verandering" (column I) for date filtering
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      // Pre-compile regex for date parsing
      const dateRegex = /^(\d{4})-(\d{2})-(\d{2})/
      
      const mappedData: Array<{
        item_number: string
        po_number: string
        amount: number
        wms_line_id: string
        status_date: string | null
        raw_date?: string
      }> = []
      
      // Process rows efficiently - single pass
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, any>
        
        // Get basic fields - handle quoted strings and empty values
        const getFieldValue = (key: string): string | null => {
          // Try various key formats: original key, quoted key, cleaned key from mapping
          const possibleKeys = [
            key,
            `"${key}"`,
            `'${key}'`,
            keyMapping?.[key],
            ...allKeys.filter(k => k.toLowerCase().includes(key.toLowerCase()))
          ].filter(Boolean)
          
          for (const possibleKey of possibleKeys) {
            let value = row[possibleKey]
            if (value !== null && value !== undefined && value !== '') {
              const str = String(value).trim()
              // Remove surrounding quotes if present
              if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
                return str.slice(1, -1).trim()
              }
              return str || null
            }
          }
          return null
        }
        
        // Try both original and cleaned column names
        const itemNumber = getFieldValue('Item') || getFieldValue('Item Number') || getFieldValue('Itemnumber') || getFieldValue('Artikelnummer')
        const poNumber = getFieldValue('Pallet') || getFieldValue('PO Number') || getFieldValue('PO') || getFieldValue('Palletnummer')
        const amountStr = getFieldValue('Qty') || getFieldValue('Quantity') || getFieldValue('Amount') || getFieldValue('Aantal')
        const amount = amountStr ? Number(String(amountStr).replace(/"/g, '')) : 0
        
        // Validate required fields
        if (!itemNumber || !poNumber || !amount || isNaN(amount) || amount <= 0) {
          continue
        }
        
        // Get date from detected column
        let statusDate: string | null = null
        let rawDate: string | undefined
        if (dateColumnName && row[dateColumnName]) {
          try {
            let dateStr = String(row[dateColumnName]).trim()
            // Remove surrounding quotes if present
            if ((dateStr.startsWith('"') && dateStr.endsWith('"')) || (dateStr.startsWith("'") && dateStr.endsWith("'"))) {
              dateStr = dateStr.slice(1, -1).trim()
            }
            rawDate = dateStr
            
            // WMS format: "2025-11-28 10:18:48.0" - extract date part (before space)
            const datePart = dateStr.split(' ')[0]
            
            // Match YYYY-MM-DD format
            const match = datePart.match(dateRegex)
            if (match) {
              statusDate = match[0] // Already in YYYY-MM-DD format
            } else {
              // Try to parse as date
              const parsedDate = new Date(datePart + 'T00:00:00')
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear()
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
                const day = String(parsedDate.getDate()).padStart(2, '0')
                statusDate = `${year}-${month}-${day}`
              }
            }
          } catch (e) {
            // Date parsing failed, continue without date
          }
        }
        
        // Filter: only import items with today's date in "Laatste status verandering"
        // Skip items without a valid date or with a date that's not today
        if (!statusDate || statusDate !== today) {
          continue // Skip items not from today or without valid date
        }
        
        // Generate unique line identifier
        const wmsLineIdRaw = row['Line ID'] || row['Line_ID'] || row['ID'] || row['WMS_ID'] || 
                            row['Status30_ID'] || row['LineId'] || row['wms_line_id'] ||
                            poNumber || // Use Pallet as fallback
                            `${itemNumber}_${poNumber}_${amount}_${i}`
        
        // Clean wms_line_id (remove quotes)
        let wmsLineId = String(wmsLineIdRaw).trim()
        if ((wmsLineId.startsWith('"') && wmsLineId.endsWith('"')) || (wmsLineId.startsWith("'") && wmsLineId.endsWith("'"))) {
          wmsLineId = wmsLineId.slice(1, -1).trim()
        }

        mappedData.push({
          item_number: String(itemNumber).trim(),
          po_number: String(poNumber).trim(),
          amount: Number(amount),
          wms_line_id: wmsLineId,
          status_date: statusDate,
          raw_date: rawDate,
        })
      }

      if (mappedData.length === 0) {
        const availableColumns = allKeys.join(', ')
        throw new Error(
          `No valid data found in the file. ` +
          `Please check that the file contains Item, Pallet, and Qty columns. ` +
          `Available columns: ${availableColumns}`
        )
      }

      // Send to API
      const response = await fetch('/api/wms-import/status-30', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mappedData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data')
      }

      const totalRows = jsonData.length
      const fromToday = mappedData.length
      const filteredByDate = totalRows - fromToday
      
      setImportStats({
        total: totalRows,
        fromToday: fromToday,
        inserted: result.inserted || 0,
        skipped: result.skipped || 0,
        errors: result.errors || 0,
      })

      let messageText = `Import completed! ${result.inserted || 0} new items added, ${result.skipped || 0} duplicates skipped.`
      if (filteredByDate > 0) {
        messageText += ` ${filteredByDate} items skipped (not from today).`
      }
      
      setMessage({
        type: 'success',
        text: messageText,
      })
      
      // Reset file input
      fileInput.value = ''
    } catch (error: any) {
      console.error('Error uploading file:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Failed to upload and process file',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">WMS Status 30 Import</h1>
      <p className="text-gray-600 mb-6">
        Import items from WMS status 30. Duplicate lines (based on WMS Line ID) will be automatically skipped.
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleFileUpload}>
          <div className="mb-4">
            <label className="block mb-2 font-medium text-lg">
              Select Excel File (Status 30)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.do,.csv,.tsv"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
          >
            {uploading ? 'Importing...' : 'Import Status 30 Items'}
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {importStats && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Import Statistics:</h3>
            <ul className="space-y-1 text-sm">
              <li>Total rows in file: <strong>{importStats.total}</strong></li>
              <li>Rows from today: <strong className="text-blue-600">{importStats.fromToday}</strong></li>
              <li>New items inserted: <strong className="text-green-600">{importStats.inserted}</strong></li>
              <li>Duplicates skipped: <strong className="text-orange-600">{importStats.skipped}</strong></li>
              {importStats.errors > 0 && (
                <li>Errors: <strong className="text-red-600">{importStats.errors}</strong></li>
              )}
              {importStats.total - importStats.fromToday > 0 && (
                <li>Filtered out (not today): <strong className="text-gray-600">{importStats.total - importStats.fromToday}</strong></li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Excel File Format:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li><strong>Required columns:</strong> Item (or Item Number), Pallet (or PO Number), Qty (or Quantity/Amount)</li>
            <li><strong>Date column:</strong> &quot;Laatste status verandering&quot; (column I) - only items with today&apos;s date will be imported</li>
            <li><strong>Optional column:</strong> Line ID (or Line_ID, ID, WMS_ID) - if not present, Pallet number will be used as unique ID</li>
            <li>First row should contain column headers</li>
            <li>Each row represents one item from WMS status 30</li>
            <li>Only items with today&apos;s date in &quot;Laatste status verandering&quot; will be imported</li>
            <li>Duplicate lines (same WMS Line ID) will be automatically skipped</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


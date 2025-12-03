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

      // Detect column names from first row - same approach as prepack page
      const firstRow = jsonData[0] as Record<string, any>
      const allKeys = Object.keys(firstRow)
      
      // Debug: log available columns
      console.log('Available columns:', allKeys)
      
      // Find the date column name efficiently
      let dateColumnName: string | null = null
      
      // Try exact match first
      for (const key of allKeys) {
        if (key === 'Laatste status verandering' || key === 'laatste status verandering' || key === 'LAATSTE STATUS VERANDERING') {
          dateColumnName = key
          console.log('Found date column (exact match):', dateColumnName)
          break
        }
      }
      
      // Try partial match
      if (!dateColumnName) {
        for (const key of allKeys) {
          const lowerKey = key.toLowerCase().trim()
          if (lowerKey.includes('laatste') && lowerKey.includes('status') && lowerKey.includes('verandering')) {
            dateColumnName = key
            console.log('Found date column (partial match):', dateColumnName)
            break
          }
        }
      }
      
      // Fallback: try other variations
      if (!dateColumnName) {
        for (const key of allKeys) {
          const lowerKey = key.toLowerCase().trim()
          if ((lowerKey.includes('status') && lowerKey.includes('verandering')) || 
              lowerKey === 'laatste status verandering') {
            dateColumnName = key
            console.log('Found date column (fallback):', dateColumnName)
            break
          }
        }
      }
      
      // Fallback: if column name not found, try to use column by index (column I = 9th column, index 8)
      if (!dateColumnName && allKeys.length >= 9) {
        // Try the 9th column (index 8) as fallback since "Laatste status verandering" is typically column I
        const potentialDateColumn = allKeys[8]
        console.log('Trying column by index (9th column) as fallback:', potentialDateColumn)
        // Check if it looks like a date column by checking if it contains date-like values
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as Record<string, any>
          const firstRowValue = String(firstRow[potentialDateColumn] || '').trim()
          // If it looks like a date (contains YYYY-MM-DD pattern), use it
          if (dateRegex.test(firstRowValue)) {
            dateColumnName = potentialDateColumn
            console.log('Using column by index as date column:', dateColumnName)
          }
        }
      }
      
      if (!dateColumnName) {
        console.warn('Date column not found! Available columns:', allKeys)
        console.warn('Looking for column containing: "laatste", "status", "verandering"')
      } else {
        console.log('Using date column:', dateColumnName)
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
        
        // Filter: only process items with status 30
        const status = row['Status'] || row['status'] || row['STATUS']
        const statusValue = status ? String(status).trim() : ''
        if (statusValue !== '30') {
          console.log('Skipping row - not status 30:', { status: statusValue, row })
          continue
        }
        
        // Get basic fields - same approach as prepack page
        const itemNumber = row['Item'] || row['Item Number'] || row['Itemnumber'] || row['Artikelnummer']
        const poNumber = row['Pallet'] || row['PO Number'] || row['PO'] || row['Palletnummer']
        const amountRaw = row['Qty'] || row['Quantity'] || row['Amount'] || row['Aantal']
        const amount = amountRaw ? Number(amountRaw) : 0
        
        // Validate required fields
        if (!itemNumber || !poNumber || !amount || isNaN(amount) || amount <= 0) {
          console.log('Skipping row - missing or invalid fields:', { itemNumber, poNumber, amount, amountRaw, row })
          continue
        }
        
        // Get date from detected column
        let statusDate: string | null = null
        let rawDate: string | undefined
        if (dateColumnName) {
          const dateValue = row[dateColumnName]
          if (dateValue) {
            try {
              const dateStr = String(dateValue).trim()
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
              console.warn('Date parsing failed for row:', { dateValue, error: e, row })
            }
          }
        } else {
          console.warn('No date column found, cannot filter by date. Row:', row)
        }
        
        // Filter: only import items with today's date in "Laatste status verandering"
        // Skip items without a valid date or with a date that's not today
        if (!statusDate || statusDate !== today) {
          console.log('Skipping row - date filter:', { statusDate, today, dateColumnName, rowDate: row[dateColumnName || ''] })
          continue // Skip items not from today or without valid date
        }
        
        // Generate unique line identifier
        const wmsLineId = row['Line ID'] || row['Line_ID'] || row['ID'] || row['WMS_ID'] || 
                         row['Status30_ID'] || row['LineId'] || row['wms_line_id'] ||
                         String(poNumber).trim() || // Use Pallet as fallback
                         `${itemNumber}_${poNumber}_${amount}_${i}`

        mappedData.push({
          item_number: String(itemNumber).trim(),
          po_number: String(poNumber).trim(),
          amount: Number(amount),
          wms_line_id: String(wmsLineId).trim(),
          status_date: statusDate,
          raw_date: rawDate,
        })
      }

      if (mappedData.length === 0) {
        const availableColumns = allKeys.join(', ')
        const totalRows = jsonData.length
        let errorMessage = `No valid data found in the file after filtering. ` +
          `Total rows in file: ${totalRows}. ` +
          `Please check that the file contains: ` +
          `1) Status column with value "30", ` +
          `2) Item, Pallet, and Qty columns, ` +
          `3) Items with today's date (${today}) in "Laatste status verandering". ` +
          `Available columns: ${availableColumns}. `
        
        if (!dateColumnName) {
          errorMessage += `ERROR: Date column "Laatste status verandering" was not found in the file! `
        }
        
        errorMessage += `Check browser console for detailed filtering information.`
        
        throw new Error(errorMessage)
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
            <li><strong>Required columns:</strong> Status (must be &quot;30&quot;), Item (or Item Number), Pallet (or PO Number), Qty (or Quantity/Amount)</li>
            <li><strong>Status filter:</strong> Only items with Status = &quot;30&quot; will be processed</li>
            <li><strong>Date column:</strong> &quot;Laatste status verandering&quot; (column I) - only items with today&apos;s date will be imported</li>
            <li><strong>Optional column:</strong> Line ID (or Line_ID, ID, WMS_ID) - if not present, Pallet number will be used as unique ID</li>
            <li>First row should contain column headers</li>
            <li>Each row represents one item from WMS status 30</li>
            <li>Only items with Status = &quot;30&quot; AND today&apos;s date in &quot;Laatste status verandering&quot; will be imported</li>
            <li>Duplicate lines (same WMS Line ID) will be automatically skipped</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


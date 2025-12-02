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
      // Read file as array buffer
      const data = await readFileAsArrayBuffer(file)
      
      // Parse Excel file
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      console.log('Parsed JSON data:', jsonData)

      // Map and validate the data - looking for WMS status 30 format
      // Expected columns: Item, Pallet, Qty, and "Laatste status verandering" (column I) for date filtering
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const mappedData = jsonData
        .map((row: any, index: number) => {
          const itemNumber = row['Item'] || row['Item Number'] || row['Itemnumber'] || row['Artikelnummer']
          const poNumber = row['Pallet'] || row['PO Number'] || row['PO'] || row['Palletnummer']
          const amount = row['Qty'] || row['Quantity'] || row['Amount'] || row['Aantal']
          
          // Get date from "Laatste status verandering" column (column I)
          const lastStatusChange = row['Laatste status verandering'] || row['Last Status Change'] || row['Status Change']
          
          // Parse the date - WMS format appears to be "YYYY-MM-DD HH:mm:ss.S"
          let statusDate: string | null = null
          if (lastStatusChange) {
            try {
              // Try to parse the date string
              const dateStr = lastStatusChange.toString().trim()
              // Extract date part (before the space)
              const datePart = dateStr.split(' ')[0]
              // Parse and format as YYYY-MM-DD
              const parsedDate = new Date(datePart)
              if (!isNaN(parsedDate.getTime())) {
                statusDate = parsedDate.toISOString().split('T')[0]
              }
            } catch (e) {
              console.warn('Could not parse date:', lastStatusChange)
            }
          }
          
          // Try to find a unique line identifier from WMS
          // Use Pallet number as unique identifier (it's in the checkbox value in the export)
          const wmsLineId = row['Line ID'] || row['Line_ID'] || row['ID'] || row['WMS_ID'] || 
                           row['Status30_ID'] || row['LineId'] || row['wms_line_id'] ||
                           poNumber?.toString().trim() || // Use Pallet as fallback
                           `${itemNumber}_${poNumber}_${amount}_${index}`

          return {
            item_number: itemNumber?.toString().trim(),
            po_number: poNumber?.toString().trim(),
            amount: amount ? Number(amount) : null,
            wms_line_id: wmsLineId?.toString().trim(),
            status_date: statusDate,
            raw_date: lastStatusChange?.toString().trim(),
          }
        })
        .filter((item) => {
          // Filter: must have valid data
          if (!item.item_number || !item.po_number || !item.amount || item.amount <= 0) {
            return false
          }
          
          // Filter: only import items with today's date in "Laatste status verandering"
          if (item.status_date && item.status_date !== today) {
            console.log(`Skipping item ${item.item_number} - date ${item.status_date} is not today (${today})`)
            return false
          }
          
          // If no date found, still include it (might be missing in some exports)
          return true
        })

      if (mappedData.length === 0) {
        throw new Error('No valid data found in the Excel file. Please check that the file contains Item, Pallet, and Qty columns.')
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
              accept=".xlsx,.xls"
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
            <li><strong>Date column:</strong> "Laatste status verandering" (column I) - only items with today's date will be imported</li>
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


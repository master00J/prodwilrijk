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

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  // Custom parser for .do files with multiline HTML content
  const parseDoFile = (content: string): Record<string, any>[] => {
    const results: Record<string, any>[] = []
    
    // Split by lines that start with "30" followed by a tab (data rows)
    // The pattern is: "30"\t"ItemNumber"\t... at the start of a real data line
    const lines = content.split('\n')
    
    // Get header from first line
    const headerLine = lines[0]
    const headers = headerLine.split('\t').map(h => h.replace(/^"|"$/g, '').trim())
    
    console.log('Parsed headers:', headers)
    
    // Find all lines that start with "30" (status 30 records)
    // These are the actual data rows - everything else is HTML continuation
    let currentRecord: string[] | null = null
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      
      // Check if this line starts a new record (starts with "30" followed by tab)
      if (line.match(/^"30"\t/)) {
        // Save previous record if exists
        if (currentRecord) {
          const record: Record<string, any> = {}
          for (let j = 0; j < headers.length && j < currentRecord.length; j++) {
            record[headers[j]] = currentRecord[j]
          }
          results.push(record)
        }
        
        // Start new record - split by tab and clean up quotes
        currentRecord = line.split('\t').map(cell => cell.replace(/^"|"$/g, '').trim())
      }
      // If line doesn't start a new record, it's part of the HTML in "Acties" column
      // We can ignore it since we don't need the Acties column
    }
    
    // Don't forget the last record
    if (currentRecord) {
      const record: Record<string, any> = {}
      for (let j = 0; j < headers.length && j < currentRecord.length; j++) {
        record[headers[j]] = currentRecord[j]
      }
      results.push(record)
    }
    
    console.log(`Parsed ${results.length} records from .do file`)
    return results
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
      let jsonData: Record<string, any>[]
      
      // Check if it's a .do file - use custom parser
      if (file.name.toLowerCase().endsWith('.do')) {
        console.log('Detected .do file, using custom parser')
        const textContent = await readFileAsText(file)
        jsonData = parseDoFile(textContent)
      } else {
        // For Excel/CSV files, use XLSX library
        const data = await readFileAsArrayBuffer(file)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      }

      if (jsonData.length === 0) {
        throw new Error('No data found in the file. Please check that the file contains data rows.')
      }

      // Detect column names from first row
      const firstRow = jsonData[0] as Record<string, any>
      const allKeys = Object.keys(firstRow)
      
      console.log('Available columns:', allKeys)
      console.log('First row sample:', firstRow)
      
      // Find the date column name - "Laatste status verandering"
      let dateColumnName: string | null = null
      
      for (const key of allKeys) {
        const lowerKey = key.toLowerCase().trim()
        if (lowerKey === 'laatste status verandering' || 
            (lowerKey.includes('laatste') && lowerKey.includes('status'))) {
          dateColumnName = key
          console.log('Found date column:', dateColumnName)
          break
        }
      }
      
      if (!dateColumnName) {
        console.warn('Date column not found! Available columns:', allKeys)
        throw new Error(`Date column "Laatste status verandering" not found. Available columns: ${allKeys.join(', ')}`)
      }

      // Today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0]
      console.log('Filtering for today:', today)
      
      // Pre-compile regex for date parsing
      const dateRegex = /^(\d{4})-(\d{2})-(\d{2})/
      
      const mappedData: Array<{
        item_number: string
        po_number: string
        amount: number
        wms_line_id: string
        status_date: string | null
      }> = []
      
      let totalStatus30 = 0
      
      // Process rows
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, any>
        
        // All rows from .do parser should be status 30, but double-check for other formats
        const status = row['Status'] || row['status'] || row['STATUS']
        const statusValue = status ? String(status).trim() : ''
        if (statusValue !== '30') {
          continue
        }
        
        totalStatus30++
        
        // Get basic fields
        const itemNumber = row['Item'] || row['Item Number'] || row['Itemnumber']
        const poNumber = row['Pallet'] || row['PO Number'] || row['Palletnummer']
        const amountRaw = row['Qty'] || row['Quantity'] || row['Amount']
        const amount = amountRaw ? Number(amountRaw) : 0
        
        // Validate required fields
        if (!itemNumber || !poNumber || !amount || isNaN(amount) || amount <= 0) {
          console.log('Skipping row - missing fields:', { itemNumber, poNumber, amount })
          continue
        }
        
        // Get date from "Laatste status verandering" column
        let statusDate: string | null = null
        const dateValue = row[dateColumnName]
        
        if (dateValue) {
          const dateStr = String(dateValue).trim()
          // Format: "2025-12-03 08:52:45.0" - extract YYYY-MM-DD
          const match = dateStr.match(dateRegex)
          if (match) {
            statusDate = match[0]
          }
        }
        
        // Filter: only import items with today's date
        if (!statusDate || statusDate !== today) {
          console.log('Skipping - not today:', { statusDate, today, item: itemNumber })
          continue
        }
        
        // Use Pallet as unique identifier
        const wmsLineId = String(poNumber).trim()

        mappedData.push({
          item_number: String(itemNumber).trim(),
          po_number: String(poNumber).trim(),
          amount: Number(amount),
          wms_line_id: wmsLineId,
          status_date: statusDate,
        })
      }

      console.log(`Found ${mappedData.length} items from today out of ${totalStatus30} status 30 items`)

      if (mappedData.length === 0) {
        throw new Error(
          `No items found with today's date (${today}) in "Laatste status verandering". ` +
          `Total status 30 items in file: ${totalStatus30}. ` +
          `Please check that the file contains items with today's date.`
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

      setImportStats({
        total: totalStatus30,
        fromToday: mappedData.length,
        inserted: result.inserted || 0,
        skipped: result.skipped || 0,
        errors: result.errors || 0,
      })

      setMessage({
        type: 'success',
        text: `Import completed! ${result.inserted || 0} new items added, ${result.skipped || 0} duplicates skipped.`,
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
        Import items from WMS status 30. Only items with today&apos;s date in &quot;Laatste status verandering&quot; will be imported.
        Duplicate lines (based on Pallet number) will be automatically skipped.
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleFileUpload}>
          <div className="mb-4">
            <label className="block mb-2 font-medium text-lg">
              Select File (Status 30)
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
              <li>Total status 30 items in file: <strong>{importStats.total}</strong></li>
              <li>Items from today: <strong className="text-blue-600">{importStats.fromToday}</strong></li>
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
          <h3 className="font-semibold mb-2">File Format:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li><strong>Supported formats:</strong> .do (WMS export), .xlsx, .xls, .csv, .tsv</li>
            <li><strong>Required columns:</strong> Status, Item, Pallet, Qty</li>
            <li><strong>Date filter:</strong> &quot;Laatste status verandering&quot; - only items with today&apos;s date are imported</li>
            <li>Duplicate pallets will be automatically skipped</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

export default function AirtecPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

    try {
      // Read file as array buffer
      const data = await readFileAsArrayBuffer(file)
      
      // Parse Excel file
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      console.log('Parsed JSON data:', jsonData)

      // Map and validate the data for Airtec
      const filteredData = jsonData.reduce((acc: any[], row: any) => {
        // Try different possible column names
        const beschrijving = row['Beschrijving'] || row['Description'] || row['Omschrijving'] || null
        const itemNumber = row['Item Number'] || row['Artikelnummer'] || row['Item'] || row['Itemnumber'] || row['Itemnummer'] || null
        const lotNumber = row['Lot Number'] || row['Partijnummer'] || row['Lot'] || row['Lotnumber'] || row['Lotnummer'] || null
        const datumOpgestuurd = row['Datum Opgestuurd'] || row['Datum opsturen?'] || row['Date Sent'] || row['Datum'] || null
        const kistnummer = row['Kistnummer'] || row['Box Number'] || row['Kist'] || row['Box'] || null
        const divisie = row['Divisie'] || row['Division'] || row['Afdeling'] || null
        const quantity = row['Qty'] || row['Quantity'] || row['Aantal'] || row['Amount'] || 1

        // At minimum, we need item_number or beschrijving
        if (itemNumber || beschrijving) {
          acc.push({
            beschrijving: beschrijving ? String(beschrijving).trim() : null,
            item_number: itemNumber ? String(itemNumber).trim() : null,
            lot_number: lotNumber ? String(lotNumber).trim() : null,
            datum_opgestuurd: datumOpgestuurd ? parseDate(datumOpgestuurd) : null,
            kistnummer: kistnummer ? String(kistnummer).trim().slice(-3) : null, // Last 3 characters
            divisie: divisie ? String(divisie).trim() : null,
            quantity: quantity ? Number(quantity) || 1 : 1,
          })
        } else {
          console.warn('Missing required fields (item_number or beschrijving) in row:', row)
        }

        return acc
      }, [])

      if (filteredData.length === 0) {
        throw new Error('No valid data found in the Excel file. Please check that the file contains at least Item Number or Description columns.')
      }

      // Send to API
      const response = await fetch('/api/airtec/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filteredData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload data')
      }

      setMessage({
        type: 'success',
        text: `Successfully uploaded ${result.insertedRows || filteredData.length} items! Redirecting to View Airtec...`,
      })
      
      // Reset file input
      fileInput.value = ''
      
      // Redirect to view-airtec after 2 seconds
      setTimeout(() => {
        window.location.href = '/view-airtec'
      }, 2000)
    } catch (error: any) {
      console.error('Error during upload:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Failed to upload Excel file',
      })
    } finally {
      setUploading(false)
    }
  }

  const parseDate = (dateValue: any): string | null => {
    if (!dateValue) return null
    
    // If it's already a string in ISO format
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      return dateValue
    }
    
    // If it's a number (Excel date serial number)
    if (typeof dateValue === 'number') {
      // Excel dates start from 1900-01-01
      const excelEpoch = new Date(1900, 0, 1)
      const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000)
      return date.toISOString()
    }
    
    // If it's a string date, try to parse it
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }
    
    return null
  }

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          resolve(e.target.result)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Airtec - Excel Upload</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Multiple Items</h2>
        <p className="text-gray-600 mb-6">
          Upload an Excel file (.xlsx or .xls) with Airtec item data. Required columns: <strong>Item Number</strong> or <strong>Description</strong>.
          Optional columns: <strong>Lot Number</strong>, <strong>Date Sent</strong>, <strong>Box Number (Kistnummer)</strong>, <strong>Division</strong>, <strong>Quantity</strong>.
        </p>

        <form onSubmit={handleFileUpload}>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
              disabled={uploading}
            />
            <button
              type="submit"
              disabled={uploading}
              className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg min-w-[120px]"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Excel File Format:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li><strong>Required:</strong> <strong>Item Number</strong> (or Item/Itemnumber/Itemnummer) OR <strong>Description</strong> (or Beschrijving/Omschrijving)</li>
            <li><strong>Optional:</strong> <strong>Lot Number</strong> (or Lot/Lotnumber/Lotnummer), <strong>Date Sent</strong> (or Datum Opgestuurd/Datum), <strong>Box Number</strong> (or Kistnummer/Kist/Box), <strong>Division</strong> (or Divisie/Afdeling), <strong>Quantity</strong> (or Qty/Aantal/Amount)</li>
            <li>First row should contain column headers</li>
            <li>Each row represents one item to add</li>
            <li>Box Number (Kistnummer) will use the last 3 characters</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


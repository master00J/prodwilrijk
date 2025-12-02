'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

export default function PrepackPage() {
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

      // Map and validate the data
      const filteredData = jsonData.reduce((acc: any[], row: any) => {
        const itemNumber = row['Item'] || row['Item Number'] || row['Itemnumber']
        const poNumber = row['Pallet'] || row['PO Number'] || row['PO']
        const amount = row['Qty'] || row['Quantity'] || row['Amount']

        if (itemNumber && poNumber && amount) {
          acc.push({
            item_number: String(itemNumber),
            po_number: String(poNumber),
            amount: Number(amount) || 1,
          })
        } else {
          console.warn('Missing required fields in row:', row)
        }

        return acc
      }, [])

      if (filteredData.length === 0) {
        throw new Error('No valid data found in the Excel file. Please check that the file contains Item, Pallet, and Qty columns.')
      }

      // Send to API
      const response = await fetch('/api/prepack/upload', {
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
        text: `Successfully uploaded ${result.insertedRows || filteredData.length} items! Redirecting to View Prepack...`,
      })
      
      // Reset file input
      fileInput.value = ''
      
      // Redirect to view-prepack after 2 seconds
      setTimeout(() => {
        window.location.href = '/view-prepack'
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
      <h1 className="text-3xl font-bold mb-6">Prepack - Excel Upload</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Multiple Items</h2>
        <p className="text-gray-600 mb-6">
          Upload an Excel file (.xlsx or .xls) with columns: <strong>Item</strong>, <strong>Pallet</strong>, and <strong>Qty</strong>
        </p>

        <form onSubmit={handleFileUpload}>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={uploading}
            />
            <button
              type="submit"
              disabled={uploading}
              className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg min-w-[120px]"
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
            <li>Column names: <strong>Item</strong> (or Item Number), <strong>Pallet</strong> (or PO Number), <strong>Qty</strong> (or Quantity/Amount)</li>
            <li>First row should contain column headers</li>
            <li>Each row represents one item to add</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import AdminGuard from '@/components/AdminGuard'

export default function SalesOrdersUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    const fileInput = event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement
    const file = fileInput?.files?.[0]

    if (!file) {
      setMessage({ type: 'error', text: 'Selecteer een bestand' })
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
      
      // Read raw data to access specific columns
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]
      
      console.log('Parsed Excel data (first 5 rows):', jsonData.slice(0, 5))

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

      if (validItems.length === 0) {
        throw new Error('Geen geldige data gevonden in het Excel bestand. Controleer of kolom A prijzen bevat en kolom K omschrijvingen met itemnummers tussen haakjes.')
      }

      console.log(`Found ${validItems.length} valid items`)

      // Send to API
      const response = await fetch('/api/sales-orders/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: validItems }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Fout bij uploaden data')
      }

      setMessage({
        type: 'success',
        text: `Succesvol ${result.insertedRows || validItems.length} verkooporders geüpload!`,
      })
      
      // Reset file input
      fileInput.value = ''
    } catch (error: any) {
      console.error('Error during upload:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Fout bij uploaden Excel bestand',
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

        <form onSubmit={handleFileUpload} className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
              Selecteer Excel Bestand
            </label>
            <input
              type="file"
              id="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {uploading ? 'Uploaden...' : 'Upload Verkooporders'}
          </button>
        </form>
      </div>
    </AdminGuard>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileType = formData.get('fileType') as string
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Log file upload
    const { data: uploadLog, error: logError } = await supabaseAdmin
      .from('grote_inpak_file_uploads')
      .insert({
        file_type: fileType,
        file_name: file.name,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single()

    if (logError) {
      console.error('Error logging upload:', logError)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let processedData: any[] = []
    let error: string | null = null

    try {
      if (fileType === 'pils') {
        // Parse PILS CSV
        const csvText = buffer.toString('utf-8')
        processedData = await parsePILSCSV(csvText)
      } else if (fileType === 'erp') {
        // Parse ERP Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        processedData = await parseERPExcel(workbook)
      } else if (fileType === 'stock') {
        // Parse Stock files (can be CSV or Excel)
        if (file.name.endsWith('.csv')) {
          const csvText = buffer.toString('utf-8')
          processedData = await parseStockCSV(csvText)
        } else {
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          processedData = await parseStockExcel(workbook)
        }
      } else if (fileType === 'forecast') {
        // Parse Forecast CSV
        const csvText = buffer.toString('utf-8')
        processedData = await parseForecastCSV(csvText)
      } else if (fileType === 'packed') {
        // Parse Packed Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        processedData = await parsePackedExcel(workbook)
      }

      // Update upload log
      if (uploadLog) {
        await supabaseAdmin
          .from('grote_inpak_file_uploads')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', uploadLog.id)
      }

      return NextResponse.json({
        success: true,
        data: processedData,
        count: processedData.length,
      })
    } catch (parseError: any) {
      error = parseError.message || 'Error parsing file'
      
      // Update upload log with error
      if (uploadLog) {
        await supabaseAdmin
          .from('grote_inpak_file_uploads')
          .update({
            status: 'error',
            error_message: error,
          })
          .eq('id', uploadLog.id)
      }

      return NextResponse.json(
        { error, success: false },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Error processing file' },
      { status: 500 }
    )
  }
}

// PILS CSV Parser - Improved with better delimiter detection and error handling
async function parsePILSCSV(csvText: string): Promise<any[]> {
  // Try to detect delimiter (comma, semicolon, or tab)
  const firstLine = csvText.split('\n')[0]
  let delimiter = ','
  if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';'
  } else if (firstLine.includes('\t')) {
    delimiter = '\t'
  }

  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or has no data rows')
  }

  // Parse header - handle quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  
  // Find key column indices
  const findColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => 
        h.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(h.toLowerCase())
      )
      if (index >= 0) return index
    }
    return -1
  }

  const caseLabelIdx = findColumnIndex(['case', 'label', 'case_label', 'case label', 'case_label', 'CASE LABEL', 'CASE_LABEL'])
  const caseTypeIdx = findColumnIndex(['type', 'case_type', 'case type', 'CASE TYPE', 'CASE_TYPE'])
  const itemNumberIdx = findColumnIndex(['item', 'item_number', 'item number', 'artikel', 'ITEM NUMBER', 'ITEM_NUMBER'])
  const arrivalDateIdx = findColumnIndex(['arrival', 'date', 'arrival_date', 'datum', 'arrival date', 'ARRIVAL DATE', 'ARRIVAL_DATE', 'DATUM', 'Datum'])
  const locationIdx = findColumnIndex(['location', 'locatie', 'productielocatie', 'productie', 'LOCATIE', 'PRODUCTIELOCATIE'])
  const stockLocationIdx = findColumnIndex(['stock', 'stock_location', 'voorraad', 'stock location', 'STOCK LOCATION', 'STOCK_LOCATION'])

  const data: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
    
    if (values.length > 0 && values[0]) {
      const row: any = {}
      
      // Map known columns
      if (caseLabelIdx >= 0) row.case_label = values[caseLabelIdx] || ''
      if (caseTypeIdx >= 0) row.case_type = values[caseTypeIdx] || ''
      if (itemNumberIdx >= 0) row.item_number = values[itemNumberIdx] || ''
      if (arrivalDateIdx >= 0) row.arrival_date = values[arrivalDateIdx] || ''
      if (locationIdx >= 0) row.productielocatie = values[locationIdx] || ''
      if (stockLocationIdx >= 0) row.stock_location = values[stockLocationIdx] || ''
      
      // Also store all original columns for flexibility
      // This ensures we can access columns by their original names or by index
      headers.forEach((header, index) => {
        if (!row[header]) {
          row[header] = values[index] || ''
        }
        // Also store by column letter (A, B, C, etc.) for Excel-like access
        const columnLetter = String.fromCharCode(65 + index) // A=0, B=1, etc.
        if (index < 26) {
          row[columnLetter] = values[index] || ''
        }
      })
      
      data.push(row)
    }
  }
  
  if (data.length === 0) {
    throw new Error('No valid data rows found in CSV file')
  }
  
  return data
}

// ERP Excel Parser - Improved with flexible column mapping
async function parseERPExcel(workbook: XLSX.WorkBook): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })
  
  if (data.length === 0) {
    throw new Error('Excel file appears to be empty or has no data rows')
  }

  // Get all possible column name variations
  const findValue = (row: any, possibleNames: string[]): string => {
    for (const name of possibleNames) {
      // Try exact match first
      if (row[name] !== undefined && row[name] !== '') {
        return String(row[name])
      }
      // Try case-insensitive match
      const key = Object.keys(row).find(k => 
        k.toLowerCase() === name.toLowerCase() || 
        k.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(k.toLowerCase())
      )
      if (key && row[key]) {
        return String(row[key])
      }
    }
    return ''
  }

  return data.map((row: any) => {
    return {
      item_number: findValue(row, ['Item Number', 'item_number', 'Item', 'Artikel', 'ARTIKEL', 'ItemNr']),
      erp_code: findValue(row, ['ERP Code', 'erp_code', 'ERP', 'ERPCode', 'ERP_CODE']),
      description: findValue(row, ['Description', 'description', 'Omschrijving', 'DESCRIPTION', 'Desc']),
      // Store all original data for flexibility
      ...row,
    }
  }).filter(row => row.item_number || row.erp_code) // Only include rows with at least item_number or erp_code
}

// Stock CSV Parser
async function parseStockCSV(csvText: string): Promise<any[]> {
  const lines = csvText.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  
  const data: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length === headers.length && values[0]) {
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      data.push({
        item_number: row['Item Number'] || row['item_number'] || row['Item'] || '',
        location: row['Location'] || row['location'] || '',
        quantity: parseInt(row['Quantity'] || row['quantity'] || '0', 10),
        erp_code: row['ERP Code'] || row['erp_code'] || '',
      })
    }
  }
  
  return data
}

// Stock Excel Parser
async function parseStockExcel(workbook: XLSX.WorkBook): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })
  
  return data.map((row: any) => ({
    item_number: row['Item Number'] || row['item_number'] || row['Item'] || '',
    location: row['Location'] || row['location'] || '',
    quantity: parseInt(row['Quantity'] || row['quantity'] || '0', 10),
    erp_code: row['ERP Code'] || row['erp_code'] || '',
  }))
}

// Forecast CSV Parser
async function parseForecastCSV(csvText: string): Promise<any[]> {
  const lines = csvText.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  
  const data: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length === headers.length && values[0]) {
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      data.push({
        item_number: row['Item Number'] || row['item_number'] || row['Item'] || '',
        forecast_date: row['Date'] || row['date'] || row['Forecast Date'] || '',
        forecast_quantity: parseInt(row['Quantity'] || row['quantity'] || '0', 10),
      })
    }
  }
  
  return data
}

// Packed Excel Parser
async function parsePackedExcel(workbook: XLSX.WorkBook): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })
  
  return data.map((row: any) => ({
    case_label: row['Case Label'] || row['case_label'] || row['Case'] || '',
    packed_date: row['Date'] || row['date'] || row['Packed Date'] || new Date().toISOString().split('T')[0],
  }))
}


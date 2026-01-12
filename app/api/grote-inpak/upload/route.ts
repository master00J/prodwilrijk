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
  
  // First, get headers to identify column positions
  const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })[0] as any[]
  const headers = headerRow || []
  
  // Convert to JSON with headers
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })
  
  // Also get raw data to access by column index (for column C)
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
  
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

  return data.map((row: any, index: number) => {
    // ERP LINK file structure: Kolom A = kistnummer, Kolom B = ERP code
    // First try to get from raw data by column index (most reliable)
    let kistnummer = ''
    let erp_code = ''
    
    if (rawData && rawData[index + 1]) {
      // rawData[0] is header row, so data starts at index 1
      const rowData = rawData[index + 1]
      // Kolom A (index 0) = kistnummer
      if (rowData && rowData.length > 0) {
        kistnummer = String(rowData[0] || '').trim()
      }
      // Kolom B (index 1) = ERP code
      if (rowData && rowData.length > 1) {
        erp_code = String(rowData[1] || '').trim()
      }
    }
    
    // Fallback: try to find by column names (for flexibility)
    if (!kistnummer) {
      kistnummer = findValue(row, [
        'kistnummer', 'Kistnummer', 'KISTNUMMER', 'Kist Nummer', 'Kist_Nummer',
        'Case Number', 'case_number', 'CaseNumber', 'CASE_NUMBER',
        'Case', 'case', 'CASE', 'A' // Also try column letter A
      ])
    }
    
    if (!erp_code) {
      erp_code = findValue(row, [
        'ERP Code', 'erp_code', 'ERP', 'ERPCode', 'ERP_CODE',
        'B' // Also try column letter B
      ])
    }
    
    // Find productielocatie - this is typically in column C (3rd column, index 2)
    // Try to find it by column name first
    let productielocatie = findValue(row, [
      'Productielocatie', 'productielocatie', 'Productie Locatie', 'ProductieLocatie', 'PRODUCTIELOCATIE',
      'Production Location', 'production_location', 'ProductionLocation',
      'Locatie', 'locatie', 'LOCATIE', 'Location', 'location',
      'Fabriek', 'fabriek', 'FABRIEK', 'Factory', 'factory',
      'Plant', 'plant', 'PLANT'
    ])
    
    // If not found by name, try to get column C from raw data (3rd column, index 2)
    if (!productielocatie && rawData && rawData[index + 1]) {
      const rowData = rawData[index + 1]
      if (rowData && rowData.length > 2) {
        productielocatie = String(rowData[2] || '').trim() // Column C is index 2
      }
    }
    
    // Also try direct access by column letter C
    if (!productielocatie && row['C']) {
      productielocatie = String(row['C'] || '').trim()
    }
    
    // Normalize productielocatie - only accept Wilrijk or Genk
    if (productielocatie) {
      const normalized = productielocatie.toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        productielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        productielocatie = 'Genk'
      } else {
        // If it's not Wilrijk or Genk (e.g., PAC3PL, BouwPakket), set to empty
        productielocatie = ''
      }
    }
    
    return {
      kistnummer: kistnummer,
      erp_code: erp_code, // Kolom B = ERP code (this matches with stock file kolom A)
      item_number: findValue(row, ['Item Number', 'item_number', 'Item', 'Artikel', 'ARTIKEL', 'ItemNr', 'ItemNr.', 'Item Nr']),
      description: findValue(row, ['Description', 'description', 'Omschrijving', 'DESCRIPTION', 'Desc']),
      productielocatie: productielocatie,
      // Store all original data for flexibility
      ...row,
    }
  }).filter(row => row.kistnummer || row.erp_code) // Include rows with kistnummer or erp_code
}

// Stock CSV Parser
// Stock files: Kolom A = ERP code, Kolom C = quantity, Locatie uit bestandsnaam
async function parseStockCSV(csvText: string, location?: string): Promise<any[]> {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    return []
  }
  
  const data: any[] = []
  // Start from row 2 (skip header row 1)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length >= 3 && values[0]) {
      // Kolom A (index 0) = ERP code
      const erpCode = values[0].trim()
      // Kolom C (index 2) = quantity
      const quantity = parseInt(values[2] || '0', 10)
      
      if (erpCode && quantity > 0) {
        data.push({
          erp_code: erpCode,
          location: location || '',
          quantity: quantity,
        })
      }
    }
  }
  
  return data
}

// Stock Excel Parser
// Stock files: Kolom A = ERP code, Kolom C = quantity, Locatie uit bestandsnaam
async function parseStockExcel(workbook: XLSX.WorkBook, location?: string): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Read by Excel column letters: A = ERP code, C = quantity
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  
  const results: any[] = []
  
  // First, try to detect header row by checking first few rows
  // Look for common header patterns like "ERP Code", "Quantity", "Aantal", "No.", "Inventory", etc.
  let startRow = 0
  const headerKeywords = ['erp', 'code', 'quantity', 'aantal', 'qty', 'stock', 'voorraad', 'no.', 'inventory', 'consumption']
  
  for (let checkRow = 0; checkRow < Math.min(5, range.e.r + 1); checkRow++) {
    const rowCells: string[] = []
    for (let c = 0; c < Math.min(5, range.e.c + 1); c++) {
      const cell = XLSX.utils.encode_cell({ r: checkRow, c })
      const cellValue = worksheet[cell]
      if (cellValue) {
        rowCells.push(String(cellValue.v || '').toLowerCase())
      }
    }
    
    // Check if this row contains header keywords
    const isHeaderRow = rowCells.some(cell => 
      headerKeywords.some(keyword => cell.includes(keyword))
    )
    
    if (isHeaderRow) {
      startRow = checkRow + 1 // Start data from next row
      console.log(`Detected header row at row ${checkRow + 1}, starting data from row ${startRow + 1}`)
      break
    }
  }
  
  // Process data rows
  for (let rowNum = startRow; rowNum <= range.e.r; rowNum++) {
    // Column A (index 0) = May contain "7773 GP008760" format - extract ERP code
    const colA = XLSX.utils.encode_cell({ r: rowNum, c: 0 })
    const colACell = worksheet[colA]
    const colAValue = colACell ? String(colACell.v || '').trim() : ''
    
    // Column B (index 1) = "Consumption Item No." - may contain ERP code as fallback
    const colB = XLSX.utils.encode_cell({ r: rowNum, c: 1 })
    const colBCell = worksheet[colB]
    const colBValue = colBCell ? String(colBCell.v || '').trim() : ''
    
    // Extract ERP code from column A
    // Pattern: "7773 GP008760" -> extract "GP008760"
    // Or just "GP008760" -> use as is
    let erpCode = ''
    
    if (colAValue) {
      // Try to find GP code pattern (GP followed by digits)
      const gpMatch = colAValue.match(/\b(GP\d+)\b/i)
      if (gpMatch) {
        erpCode = gpMatch[1].toUpperCase()
      } else {
        // If no GP pattern found, try to use the last word/part (might be ERP code)
        const parts = colAValue.split(/\s+/)
        if (parts.length > 1) {
          // Use last part if it looks like an ERP code (starts with letters and has digits)
          const lastPart = parts[parts.length - 1]
          if (lastPart.match(/^[A-Z]{2,}\d+/i)) {
            erpCode = lastPart.toUpperCase()
          } else {
            // Fallback: use the whole value if it looks like an ERP code
            if (colAValue.match(/^[A-Z]{2,}\d+/i)) {
              erpCode = colAValue.toUpperCase()
            }
          }
        } else {
          // Single value - use if it looks like ERP code
          if (colAValue.match(/^[A-Z]{2,}\d+/i)) {
            erpCode = colAValue.toUpperCase()
          }
        }
      }
    }
    
    // Fallback to column B if column A didn't yield an ERP code
    if (!erpCode && colBValue) {
      const gpMatchB = colBValue.match(/\b(GP\d+)\b/i)
      if (gpMatchB) {
        erpCode = gpMatchB[1].toUpperCase()
      } else if (colBValue.match(/^[A-Z]{2,}\d+/i)) {
        erpCode = colBValue.toUpperCase()
      }
    }
    
    // Skip empty rows or rows that look like headers
    // Also skip if ERP code is just "NO" (from "No." header)
    if (!erpCode || 
        erpCode.toLowerCase() === 'erp code' || 
        erpCode.toLowerCase() === 'erp_code' || 
        erpCode.toLowerCase() === 'no.' ||
        erpCode.toLowerCase() === 'no' ||
        erpCode.length < 3) { // Skip very short codes that are likely not ERP codes
      continue
    }
    
    // Column C (index 2) = quantity
    const colC = XLSX.utils.encode_cell({ r: rowNum, c: 2 })
    const quantityCell = worksheet[colC]
    let quantity = 0
    
    if (quantityCell) {
      const cellValue = quantityCell.v
      if (typeof cellValue === 'number') {
        quantity = Math.floor(Math.abs(cellValue)) // Use absolute value and floor
      } else if (typeof cellValue === 'string') {
        // Handle European number format: "0," means 0 (comma as decimal separator)
        // Remove spaces first
        let cleanStr = cellValue.replace(/\s/g, '').trim()
        
        // If it ends with just a comma (e.g., "0,"), treat as 0
        if (cleanStr.endsWith(',') && !cleanStr.includes('.')) {
          cleanStr = cleanStr.replace(/,$/, '')
        }
        
        // Replace comma with dot for parsing (European format)
        cleanStr = cleanStr.replace(',', '.')
        
        // Remove any remaining non-numeric characters except minus sign and dot
        cleanStr = cleanStr.replace(/[^\d.-]/g, '')
        
        // Try to parse as float first (in case of decimals), then floor
        const parsed = parseFloat(cleanStr)
        quantity = isNaN(parsed) ? 0 : Math.floor(Math.abs(parsed))
      } else {
        quantity = Math.floor(Math.abs(parseFloat(String(cellValue || '0')) || 0))
      }
    }
    
    // Also check column B (index 1) as fallback for quantity if column C is empty
    if (quantity === 0) {
      const colB = XLSX.utils.encode_cell({ r: rowNum, c: 1 })
      const quantityCellB = worksheet[colB]
      if (quantityCellB) {
        const cellValue = quantityCellB.v
        if (typeof cellValue === 'number') {
          quantity = Math.floor(Math.abs(cellValue))
        } else if (typeof cellValue === 'string') {
          const cleanStr = cellValue.replace(/[,\s]/g, '').trim()
          const parsed = parseFloat(cleanStr)
          quantity = isNaN(parsed) ? 0 : Math.floor(Math.abs(parsed))
        }
      }
    }
    
    // Process rows with ERP code (even if quantity is 0, as it might be valid stock of 0)
    if (erpCode) {
      results.push({
        erp_code: erpCode,
        location: location || '',
        quantity: quantity,
      })
    }
  }
  
  return results
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


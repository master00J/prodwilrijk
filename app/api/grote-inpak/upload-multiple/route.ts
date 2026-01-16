import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'

// Increase body size limit for Vercel
export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileType = formData.get('fileType') as string
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Check total size to prevent 413 errors
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const MAX_SIZE = 4 * 1024 * 1024 // 4MB limit per request
    if (totalSize > MAX_SIZE && files.length > 1) {
      return NextResponse.json(
        { error: `Total file size too large (${Math.round(totalSize / 1024 / 1024)}MB). Please upload files one at a time.` },
        { status: 413 }
      )
    }

    // For stock files, save directly to database instead of returning all data
    // This avoids 413 errors with large files
    // Process each file individually and overwrite stock for that specific location
    if (fileType === 'stock') {
      let totalProcessed = 0
      let filesProcessed = 0
      const errors: string[] = []

      // Process each file individually to avoid 413 errors
      for (const file of files) {
        try {
          // Log file upload
          const { data: uploadLog } = await supabaseAdmin
            .from('grote_inpak_file_uploads')
            .insert({
              file_type: fileType,
              file_name: file.name,
              file_size: file.size,
              status: 'processing',
            })
            .select()
            .single()

          const buffer = Buffer.from(await file.arrayBuffer())
          const location = extractLocationFromFilename(file.name)
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          const processedData = await parseStockExcel(workbook, location, /regels/i.test(file.name))

          if (processedData.length > 0) {
            // Delete existing stock for this specific location first (overwrite behavior)
            // Also delete by erp_code + location to handle any edge cases
            const { error: deleteError, count: deleteCount } = await supabaseAdmin
              .from('grote_inpak_stock')
              .delete({ count: 'exact' })
              .eq('location', location)
              .not('erp_code', 'is', null) // Only delete rows with erp_code (stock file rows)

            if (deleteError) {
              console.error(`Error deleting existing stock for ${location}:`, deleteError)
              errors.push(`${file.name}: Error deleting existing stock for ${location}: ${deleteError.message}`)
            } else {
              console.log(`Deleted ${deleteCount || 0} existing stock records for location ${location} (overwriting with new data)`)
              
              // Remove duplicates by erp_code before inserting (in case Excel has duplicate rows)
              const uniqueData = new Map<string, any>()
              for (const item of processedData) {
                const key = `${item.erp_code}_${item.location}`
                if (uniqueData.has(key)) {
                  // If duplicate, sum the quantities
                  const existing = uniqueData.get(key)
                  existing.quantity += item.quantity
                  existing.stock += item.stock || 0
                  existing.inkoop += item.inkoop || 0
                  existing.productie += item.productie || 0
                  existing.in_transfer += item.in_transfer || 0
                  console.log(`Found duplicate ERP code ${item.erp_code} in ${location}, summing quantities: ${existing.quantity - item.quantity} + ${item.quantity} = ${existing.quantity}`)
                } else {
                  uniqueData.set(key, {
                    ...item,
                    stock: item.stock || 0,
                    inkoop: item.inkoop || 0,
                    productie: item.productie || 0,
                    in_transfer: item.in_transfer || 0,
                  })
                }
              }
              
              const uniqueDataArray = Array.from(uniqueData.values())
              console.log(`Inserting ${uniqueDataArray.length} unique stock items for location ${location} (${processedData.length} total rows parsed)`)
              
              // Insert new stock data for this location
              // Stock files: kolom A = ERP code, kolom C = quantity
              // Use empty string for item_number if column is NOT NULL, otherwise null
              const { error: insertError } = await supabaseAdmin
                .from('grote_inpak_stock')
                .insert(
                  uniqueDataArray.map(item => ({
                    erp_code: item.erp_code,
                    location: item.location,
                    quantity: item.quantity,
                    stock: item.stock || 0,
                    inkoop: item.inkoop || 0,
                    productie: item.productie || 0,
                    in_transfer: item.in_transfer || 0,
                    item_number: '', // Use empty string instead of null to avoid NOT NULL constraint
                  }))
                )

              if (insertError) {
                console.error(`Error saving stock data for ${file.name}:`, insertError)
                errors.push(`${file.name}: ${insertError.message}`)
              } else {
                totalProcessed += uniqueDataArray.length
                filesProcessed++
                console.log(`Successfully saved ${uniqueDataArray.length} stock items for location ${location}`)
              }
            }
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
        } catch (fileError: any) {
          console.error(`Error processing file ${file.name}:`, fileError)
          errors.push(`${file.name}: ${fileError.message}`)
        }
      }

      return NextResponse.json({
        success: true,
        count: totalProcessed,
        filesProcessed,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // For other file types, process normally (but limit response size)
    const allProcessedData: any[] = []
    const MAX_RESPONSE_SIZE = 10000 // Limit to 10k items in response

    for (const file of files) {
      try {
        if (allProcessedData.length >= MAX_RESPONSE_SIZE) {
          console.warn(`Response size limit reached. Processed ${files.length} files but only returning first ${MAX_RESPONSE_SIZE} items.`)
          break
        }

        // Log file upload
        const { data: uploadLog } = await supabaseAdmin
          .from('grote_inpak_file_uploads')
          .insert({
            file_type: fileType,
            file_name: file.name,
            file_size: file.size,
            status: 'processing',
          })
          .select()
          .single()

        const buffer = Buffer.from(await file.arrayBuffer())
        let processedData: any[] = []

        if (fileType === 'stock') {
          // Parse Stock Excel - extract location from filename
          const location = extractLocationFromFilename(file.name)
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          processedData = await parseStockExcel(workbook, location, /regels/i.test(file.name))
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

        allProcessedData.push(...processedData.slice(0, MAX_RESPONSE_SIZE - allProcessedData.length))
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError)
        // Continue with other files even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      data: allProcessedData,
      count: allProcessedData.length,
      filesProcessed: files.length,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Error processing files' },
      { status: 500 }
    )
  }
}

function extractLocationFromFilename(filename: string): string {
  // Extract location from filename like "Stock Genk.xlsx" -> "Genk"
  // Or "Stock Willebroek.xlsx" -> "Willebroek"
  // Or "Stock in Willebroek.xlsx" -> "Willebroek"
  // Or "Stock_Willebroek.xlsx" -> "Willebroek"
  const name = filename.replace(/\.(xlsx|xls)$/i, '').trim()
  
  // Normalize common location names
  const locationMap: { [key: string]: string } = {
    'willebroek': 'Willebroek',
    'wilrijk': 'Wilrijk',
    'wlb': 'Willebroek',
    'pac3pl': 'Willebroek',
    'genk': 'Genk',
  }
  
  // Try to find location in filename (case-insensitive)
  const lowerName = name.toLowerCase()
  
  // Check for common patterns (order matters - check Wilrijk before Willebroek to avoid partial matches)
  if (lowerName.includes('wilrijk')) {
    return 'Wilrijk'
  }
  if (lowerName.includes('willebroek') || lowerName.includes('wlb') || lowerName.includes('pac3pl')) {
    return 'Willebroek'
  }
  if (lowerName.includes('genk')) {
    return 'Genk'
  }
  
  // Try to extract after "Stock" or "Stock in"
  if (lowerName.includes('stock')) {
    const parts = name.split(/\s+/)
    const stockIndex = parts.findIndex(p => p.toLowerCase() === 'stock')
    if (stockIndex >= 0 && stockIndex < parts.length - 1) {
      const locationPart = parts.slice(stockIndex + 1).join(' ').trim()
      // Normalize location name
      const normalized = locationMap[locationPart.toLowerCase()] || locationPart
      if (normalized) return normalized
    }
  }
  
  // Fallback: return filename without extension and "Stock" prefix
  const fallback = name.replace(/^stock\s*(in\s*)?/i, '').trim()
  return locationMap[fallback.toLowerCase()] || fallback || 'Unknown'
}

async function parseStockExcel(workbook: XLSX.WorkBook, location: string, isTransfer: boolean = false): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Read by Excel column letters: A = ERP code, C = quantity
  // Stock files: Kolom A = ERP code, Kolom C = quantity, Locatie uit bestandsnaam
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  
  console.log(`Parsing stock file for location ${location}: Range is ${worksheet['!ref']}, total rows: ${range.e.r + 1}`)
  
  const results: any[] = []
  
  // First, try to detect header row by checking first few rows
  // Look for common header patterns like "ERP Code", "Quantity", "Aantal", "No.", "Inventory", etc.
  let startRow = 0
  let headerRowIndex: number | null = null
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
      headerRowIndex = checkRow
      console.log(`Detected header row at row ${checkRow + 1}, starting data from row ${startRow + 1}`)
      break
    }
  }

  const headerCells: string[] = []
  if (headerRowIndex !== null) {
    for (let c = 0; c <= range.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r: headerRowIndex, c })
      const cellValue = worksheet[cell]
      headerCells.push(cellValue ? String(cellValue.v || '').toLowerCase().trim() : '')
    }
  }

  const findColumnIndex = (names: string[]) => {
    if (!headerCells.length) return -1
    return headerCells.findIndex((cell) => names.some((name) => cell === name || cell.includes(name)))
  }

  const erpCandidateIndices = [
    findColumnIndex(['no.', 'no']),
    findColumnIndex(['production bom no.', 'production bom', 'bom']),
    findColumnIndex(['routing no.', 'routing']),
  ].filter((idx) => idx >= 0)
  
  // Process data rows
  for (let rowNum = startRow; rowNum <= range.e.r; rowNum++) {
    const colA = XLSX.utils.encode_cell({ r: rowNum, c: 0 })
    const colACell = worksheet[colA]
    const colAValue = colACell ? String(colACell.v || '').trim() : ''
    
    const colB = XLSX.utils.encode_cell({ r: rowNum, c: 1 })
    const colBCell = worksheet[colB]
    const colBValue = colBCell ? String(colBCell.v || '').trim() : ''
    
    let erpCode: string | null = null

    for (const idx of erpCandidateIndices) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c: idx })
      const cellValue = worksheet[cell]
      const rawValue = cellValue ? String(cellValue.v || '').trim() : ''
      const normalized = normalizeErpCode(rawValue)
      if (normalized && /^[A-Z]{2,}\d+/.test(normalized)) {
        erpCode = normalized
        break
      }
    }

    if (!erpCode) {
      erpCode = normalizeErpCode(colAValue)
    }

    if (!erpCode && colBValue) {
      erpCode = normalizeErpCode(colBValue)
    }

    if (erpCode && !/^[A-Z]{2,}\d+/.test(erpCode)) {
      erpCode = null
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
    const parseNumericCell = (cell: any): number => {
      if (!cell) return 0
      const cellValue = cell.v
      if (typeof cellValue === 'number') {
        return Math.floor(Math.abs(cellValue))
      }
      if (typeof cellValue === 'string') {
        let cleanStr = cellValue.replace(/\s/g, '').trim()
        if (cleanStr.endsWith(',') && !cleanStr.includes('.')) {
          cleanStr = cleanStr.replace(/,$/, '')
        }
        cleanStr = cleanStr.replace(',', '.')
        cleanStr = cleanStr.replace(/[^\d.-]/g, '')
        const parsed = parseFloat(cleanStr)
        return isNaN(parsed) ? 0 : Math.floor(Math.abs(parsed))
      }
      return Math.floor(Math.abs(parseFloat(String(cellValue || '0')) || 0))
    }

    let stock = 0
    let inkoop = 0
    let productie = 0
    let inTransfer = 0
    let quantity = 0
    
    if (isTransfer) {
      location = 'In transfer'
      const colF = XLSX.utils.encode_cell({ r: rowNum, c: 5 })
      const quantityCell = worksheet[colF]
      inTransfer = parseNumericCell(quantityCell)
    } else {
      const colC = XLSX.utils.encode_cell({ r: rowNum, c: 2 })
      const quantityCell = worksheet[colC]
      stock = parseNumericCell(quantityCell)

      const colI = XLSX.utils.encode_cell({ r: rowNum, c: 8 })
      const inkoopCell = worksheet[colI]
      inkoop = parseNumericCell(inkoopCell)

      const colK = XLSX.utils.encode_cell({ r: rowNum, c: 10 })
      const productieCell = worksheet[colK]
      productie = parseNumericCell(productieCell)
    }

    quantity = stock
    
    // Process rows with ERP code (even if quantity is 0, as it might be valid stock of 0)
    if (erpCode) {
      results.push({
        erp_code: erpCode,
        location: location,
        quantity: quantity,
        stock,
        inkoop,
        productie,
        in_transfer: inTransfer,
      })
      
      // Log first few rows for debugging
      if (results.length <= 10) {
        const quantitySource = isTransfer ? 'col F' : 'col C'
        console.log(`Row ${rowNum + 1}: ERP Code="${erpCode}", Quantity=${quantity}, Location="${location}" (from col A: "${colAValue}", ${quantitySource})`)
      }
    }
  }
  
  console.log(`\n=== STOCK FILE PARSING SUMMARY for ${location} ===`)
  console.log(`Parsed ${results.length} stock items from ${range.e.r + 1} total rows (started at row ${startRow + 1})`)
  if (results.length > 0) {
    const totalQty = results.reduce((sum, r) => sum + r.quantity, 0)
    console.log(`Total quantity: ${totalQty}`)
    
    // Log unique ERP codes count and sample
    const uniqueErpCodes = new Set(results.map(r => r.erp_code))
    console.log(`Unique ERP codes in parsed data: ${uniqueErpCodes.size}`)
    const sampleErpCodes = Array.from(uniqueErpCodes).slice(0, 20)
    console.log(`Sample ERP codes (first 20):`, sampleErpCodes)
    console.log(`Sample items (first 10):`, results.slice(0, 10).map(r => `${r.erp_code}: ${r.quantity}`))
  } else {
    console.warn(`⚠️ No stock items parsed from ${range.e.r + 1} rows. Check if header detection is correct.`)
    // Log first few rows to help debug
    console.log(`First 5 rows (for debugging):`)
    for (let i = 0; i < Math.min(5, range.e.r + 1); i++) {
      const rowCells: string[] = []
      for (let c = 0; c < Math.min(5, range.e.c + 1); c++) {
        const cell = XLSX.utils.encode_cell({ r: i, c })
        const cellValue = worksheet[cell]
        if (cellValue) {
          rowCells.push(String(cellValue.v || ''))
        } else {
          rowCells.push('')
        }
      }
      console.log(`  Row ${i + 1}:`, rowCells)
    }
  }
  console.log(`=== END SUMMARY ===\n`)
  
  return results
}


import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

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
          const processedData = await parseStockExcel(workbook, location)

          if (processedData.length > 0) {
            // Delete existing stock for this specific location first
            const { error: deleteError, count: deleteCount } = await supabaseAdmin
              .from('grote_inpak_stock')
              .delete()
              .eq('location', location)
              .select('*', { count: 'exact', head: true })

            if (deleteError) {
              console.error(`Error deleting existing stock for ${location}:`, deleteError)
              errors.push(`${file.name}: Error deleting existing stock for ${location}: ${deleteError.message}`)
            } else {
              console.log(`Deleted ${deleteCount || 0} existing stock records for location ${location}`)
              
              // Remove duplicates by item_number before inserting (in case Excel has duplicate rows)
              const uniqueData = new Map<string, any>()
              for (const item of processedData) {
                const key = `${item.item_number}_${item.location}`
                if (uniqueData.has(key)) {
                  // If duplicate, sum the quantities
                  const existing = uniqueData.get(key)
                  existing.quantity += item.quantity
                  console.log(`Found duplicate item ${item.item_number} in ${location}, summing quantities: ${existing.quantity - item.quantity} + ${item.quantity} = ${existing.quantity}`)
                } else {
                  uniqueData.set(key, { ...item })
                }
              }
              
              const uniqueDataArray = Array.from(uniqueData.values())
              console.log(`Inserting ${uniqueDataArray.length} unique stock items for location ${location} (${processedData.length} total rows parsed)`)
              
              // Insert new stock data for this location
              const { error: insertError } = await supabaseAdmin
                .from('grote_inpak_stock')
                .insert(
                  uniqueDataArray.map(item => ({
                    item_number: item.item_number,
                    location: item.location,
                    quantity: item.quantity,
                    erp_code: item.erp_code || null,
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
          processedData = await parseStockExcel(workbook, location)
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
    'wilrijk': 'Willebroek', // Wilrijk is the same as Willebroek
    'wlb': 'Willebroek',
    'pac3pl': 'Willebroek',
    'genk': 'Genk',
  }
  
  // Try to find location in filename (case-insensitive)
  const lowerName = name.toLowerCase()
  
  // Check for common patterns (order matters - check Wilrijk before Willebroek to avoid partial matches)
  if (lowerName.includes('wilrijk')) {
    return 'Willebroek' // Wilrijk = Willebroek
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

async function parseStockExcel(workbook: XLSX.WorkBook, location: string): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Read data with header row to get column structure
  // Then read by Excel column letters (A, B, C, etc.)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  
  const results: any[] = []
  
  // Start from row 2 (skip header row 1)
  for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
    // Column A (index 0) = item_number/ERP Code
    const colA = XLSX.utils.encode_cell({ r: rowNum, c: 0 })
    const itemNumberCell = worksheet[colA]
    const itemNumber = itemNumberCell ? String(itemNumberCell.v || '').trim() : ''
    
    // Skip empty rows
    if (!itemNumber) {
      continue
    }
    
    // Column C (index 2) = quantity
    const colC = XLSX.utils.encode_cell({ r: rowNum, c: 2 })
    const quantityCell = worksheet[colC]
    let quantity = 0
    
    if (quantityCell) {
      // Handle different cell types (number, string, etc.)
      const cellValue = quantityCell.v
      if (typeof cellValue === 'number') {
        quantity = Math.floor(cellValue) // Use floor to handle decimals
      } else if (typeof cellValue === 'string') {
        // Remove commas and parse
        const cleanStr = cellValue.replace(/,/g, '').trim()
        quantity = parseInt(cleanStr, 10) || 0
      } else {
        quantity = parseInt(String(cellValue || ''), 10) || 0
      }
    }
    
    // Only process rows with item_number and quantity > 0
    if (itemNumber && quantity > 0) {
      results.push({
        item_number: itemNumber,
        location: location, // Use extracted location from filename
        quantity: quantity,
        erp_code: itemNumber, // Use item_number as erp_code (they're the same in column A)
      })
    }
  }
  
  // Log for debugging
  console.log(`Parsed ${results.length} stock items for location ${location}`)
  if (results.length > 0) {
    console.log(`Sample items:`, results.slice(0, 3).map(r => `${r.item_number}: ${r.quantity}`))
  }
  
  return results
}


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
    if (fileType === 'stock') {
      let totalProcessed = 0
      let filesProcessed = 0
      const errors: string[] = []

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

          // Save directly to database instead of accumulating in memory
          if (processedData.length > 0) {
            // Use upsert to handle duplicates (based on unique constraint)
            const { error: insertError } = await supabaseAdmin
              .from('grote_inpak_stock')
              .upsert(
                processedData.map(item => ({
                  item_number: item.item_number,
                  location: item.location,
                  quantity: item.quantity,
                  erp_code: item.erp_code || null,
                })),
                { onConflict: 'item_number,location' }
              )

            if (insertError) {
              console.error(`Error saving stock data for ${file.name}:`, insertError)
              errors.push(`${file.name}: ${insertError.message}`)
            } else {
              totalProcessed += processedData.length
              filesProcessed++
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
  const name = filename.replace(/\.(xlsx|xls)$/i, '')
  if (name.toLowerCase().includes('stock')) {
    const parts = name.split(/\s+/)
    const stockIndex = parts.findIndex(p => p.toLowerCase() === 'stock')
    if (stockIndex >= 0 && stockIndex < parts.length - 1) {
      return parts.slice(stockIndex + 1).join(' ')
    }
  }
  // Fallback: return filename without extension
  return name.replace(/^stock\s*/i, '').trim() || 'Unknown'
}

async function parseStockExcel(workbook: XLSX.WorkBook, location: string): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })
  
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
    // Stock files use "No." for item_number and "Inventory" for quantity
    // Also check "Consumption Item No." which might be the ERP code or related item
    const itemNumber = findValue(row, [
      'No.', 'no.', 'NO.', 'No', 'no', 'NO',
      'Item Number', 'item_number', 'Item', 'Artikel', 'ARTIKEL', 'ItemNr', 
      'Kistnummer', 'kistnummer', 'KISTNUMMER'
    ])
    
    const quantity = parseInt(findValue(row, [
      'Inventory', 'inventory', 'INVENTORY',
      'Quantity', 'quantity', 'Qty', 'Aantal', 'Stock', 'Voorraad', 'qty'
    ]) || '0', 10)
    
    // Consumption Item No. might be the ERP code or related item number
    const consumptionItemNo = findValue(row, [
      'Consumption Item No.', 'consumption_item_no', 'Consumption Item No',
      'Consumption Item', 'consumption_item', 'CONSUMPTION ITEM NO.'
    ])
    
    const erpCode = findValue(row, [
      'ERP Code', 'erp_code', 'ERP', 'ERPCode', 'ERP_CODE',
      'ERP code', 'erp code'
    ]) || consumptionItemNo // Use Consumption Item No. as fallback for erp_code
    
    return {
      item_number: itemNumber,
      location: location, // Use extracted location from filename
      quantity: quantity,
      erp_code: erpCode || null,
    }
  }).filter(item => item.item_number && item.quantity > 0) // Only include rows with item_number and quantity > 0
}


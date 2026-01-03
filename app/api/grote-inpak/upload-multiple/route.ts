import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

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

    const allProcessedData: any[] = []

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

        allProcessedData.push(...processedData)
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

  return data.map((row: any) => ({
    item_number: findValue(row, ['Item Number', 'item_number', 'Item', 'Artikel', 'ARTIKEL', 'ItemNr', 'Kistnummer', 'kistnummer']),
    location: location, // Use extracted location from filename
    quantity: parseInt(findValue(row, ['Quantity', 'quantity', 'Qty', 'Aantal', 'Stock', 'Voorraad']) || '0', 10),
    erp_code: findValue(row, ['ERP Code', 'erp_code', 'ERP', 'ERPCode', 'ERP_CODE']),
  })).filter(item => item.item_number) // Only include rows with item_number
}


import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { logApiError } from '@/lib/api/log-error'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { getBcMappingLookup } from '@/lib/bc-mapping/server'

export const dynamic = 'force-dynamic'

// Increase body size limit for Vercel
export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileType = formData.get('fileType') as string
    const files = formData.getAll('files') as File[]
    // Tijdens de BC-overgang: 'legacy' = oude BC-omgeving (GP-codes),
    // 'bc36' = nieuwe omgeving (FP-codes). Ze bestaan tegelijk in de DB en
    // worden opgeteld per kist bij het aggregeren.
    const rawSource = (formData.get('bcSource') as string | null)?.trim().toLowerCase()
    const bcSource: 'legacy' | 'bc36' = rawSource === 'bc36' ? 'bc36' : 'legacy'

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Check total size to prevent 413 errors.
    // BC-exports met duizenden items zonder filter kunnen al snel 3-6 MB groot zijn,
    // dus houden we 10 MB ruimte aan. Vercel serverless function body-limit is 4.5 MB
    // voor hobby/pro plans, maar via de formData streaming komt deze limiet pas in
    // beeld bij het uitlezen — bij één grote file per request is dat normaal prima.
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const MAX_SIZE = 10 * 1024 * 1024 // 10 MB totale request
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
      const { data: erpLinkData } = await supabaseAdmin
        .from('grote_inpak_erp_link')
        .select('kistnummer, erp_code')

      // Laad BC item mapping zodat ook nieuwe BC36 codes (FP...) kunnen matchen
      // op ERP LINK entries die nog op oude codes (GP...) staan.
      const bcMapping = await getBcMappingLookup()

      const erpToKist = new Map<string, string>()
      if (erpLinkData && erpLinkData.length > 0) {
        erpLinkData.forEach((row: any) => {
          const normalized = normalizeErpCode(row.erp_code)
          if (!normalized || !row.kistnummer) return
          const kist = String(row.kistnummer).toUpperCase().trim()
          erpToKist.set(normalized, kist)
          if (/^GP\d+$/i.test(normalized)) {
            const numPart = normalized.replace(/^GP/i, '')
            const asNum = parseInt(numPart, 10)
            if (!isNaN(asNum)) erpToKist.set(String(asNum), kist)
          }
          // Indexeer ook op de tegenhanger (oud ↔ nieuw) zodat een stock-file
          // met FP-codes matcht met een ERP LINK entry die GP-code heeft,
          // en omgekeerd.
          const altNew = bcMapping.toNew(normalized)
          if (altNew && altNew.toUpperCase() !== normalized) {
            erpToKist.set(altNew.toUpperCase(), kist)
          }
          const altOld = bcMapping.toOld(normalized)
          if (altOld && altOld.toUpperCase() !== normalized) {
            erpToKist.set(altOld.toUpperCase(), kist)
          }
        })
      }

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
            // Delete existing stock voor deze combinatie (location, bc_source).
            // Tijdens de overgang willen we niet dat een upload uit de ene
            // BC-omgeving de rijen van de andere omgeving overschrijft.
            const { error: deleteError, count: deleteCount } = await supabaseAdmin
              .from('grote_inpak_stock')
              .delete({ count: 'exact' })
              .eq('location', location)
              .eq('bc_source', bcSource)
              .not('erp_code', 'is', null) // Only delete rows with erp_code (stock file rows)

            if (deleteError) {
              console.error(`Error deleting existing stock for ${location}:`, deleteError)
              errors.push(`${file.name}: Error deleting existing stock for ${location}: ${deleteError.message}`)
            } else {
              console.log(`Deleted ${deleteCount || 0} existing stock records for location ${location} / source ${bcSource} (overwriting with new data)`)
              
              // Remove duplicates by erp_code before inserting (in case Excel has duplicate rows)
              const uniqueData = new Map<string, any>()
              for (const item of processedData) {
                const canonErp = normalizeErpCode(item.erp_code) || item.erp_code
                const key = `${canonErp}_${item.location}`
                if (uniqueData.has(key)) {
                  // If duplicate, sum the quantities
                  const existing = uniqueData.get(key)
                  existing.quantity += item.quantity
                  existing.stock += item.stock || 0
                  existing.inkoop += item.inkoop || 0
                  existing.productie += item.productie || 0
                  existing.in_transfer += item.in_transfer || 0
                  console.log(`Found duplicate ERP code ${canonErp} in ${location}, summing quantities: ${existing.quantity - item.quantity} + ${item.quantity} = ${existing.quantity}`)
                } else {
                  let kistnummer: string | null = null
                  const erpCodeStr = String(item.erp_code || '').toUpperCase().trim()
                  if (/^[KCV]/.test(erpCodeStr)) {
                    kistnummer = erpCodeStr.replace(/^V/, 'K')
                  } else {
                    const normalized = normalizeErpCode(item.erp_code)
                    if (normalized && erpToKist.has(normalized)) {
                      kistnummer = erpToKist.get(normalized) || null
                    }
                    // Probeer ook de vertaalde variant via BC-mapping (oud ↔ nieuw).
                    if (!kistnummer && normalized) {
                      const altNew = bcMapping.toNew(normalized)
                      if (altNew && altNew.toUpperCase() !== normalized && erpToKist.has(altNew.toUpperCase())) {
                        kistnummer = erpToKist.get(altNew.toUpperCase()) || null
                      }
                      if (!kistnummer) {
                        const altOld = bcMapping.toOld(normalized)
                        if (altOld && altOld.toUpperCase() !== normalized && erpToKist.has(altOld.toUpperCase())) {
                          kistnummer = erpToKist.get(altOld.toUpperCase()) || null
                        }
                      }
                    }
                    if (!kistnummer && /^\d{4,8}$/.test(String(item.erp_code || ''))) {
                      kistnummer = erpToKist.get(String(item.erp_code)) || null
                    }
                  }
                  uniqueData.set(key, {
                    ...item,
                    erp_code: canonErp,
                    stock: item.stock || 0,
                    inkoop: item.inkoop || 0,
                    productie: item.productie || 0,
                    in_transfer: item.in_transfer || 0,
                    kistnummer,
                  })
                }
              }
              
              const uniqueDataArray = Array.from(uniqueData.values())

              // Pre-filter voor insert: enkel items die uiteindelijk zichtbaar zullen
              // zijn in de /grote-inpak tabs hebben we nodig. Dat zijn items met een
              // geldig kistnummer (K/C/V-prefix). Alle andere items komen uit een
              // ongefilterde BC-export en zouden de DB alleen maar vervuilen — de
              // GET-endpoint filtert ze toch weer weg.
              // Hierdoor kan de gebruiker de volledige BC-items-lijst uploaden
              // (10k+ rijen) zonder dat we die allemaal moeten opslaan.
              const relevantForInsert = uniqueDataArray.filter((item: any) => {
                const kist = item.kistnummer ? String(item.kistnummer).toUpperCase() : ''
                return kist && /^[KCV]/.test(kist)
              })
              const skippedNoLink = uniqueDataArray.length - relevantForInsert.length
              console.log(`Location ${location}: ${processedData.length} rijen geparsed → ${uniqueDataArray.length} uniek → ${relevantForInsert.length} match met ERP LINK (skipped: ${skippedNoLink} zonder kistnummer)`)

              // Insert new stock data for this location
              // Stock files: kolom A = ERP code, kolom C = quantity
              // Use empty string for item_number if column is NOT NULL, otherwise null
              // Negatieve waarden op 0 zetten
              const clamp = (v: any) => Math.max(0, Number(v) || 0)
              // Oude BC (GP): voorraad in die export is niet betrouwbaar tijdens de migratie;
              // enkel "Qty. on Prod. Order" uit de file gebruiken (quantity/stock/inkoop/transfer → 0).
              const stockValuesForInsert = (item: any) =>
                bcSource === 'legacy'
                  ? {
                      quantity: 0,
                      stock: 0,
                      inkoop: 0,
                      productie: clamp(item.productie),
                      in_transfer: 0,
                    }
                  : {
                      quantity: clamp(item.quantity),
                      stock: clamp(item.stock),
                      inkoop: clamp(item.inkoop),
                      productie: clamp(item.productie),
                      in_transfer: clamp(item.in_transfer),
                    }
              const { error: insertError } = relevantForInsert.length === 0
                ? { error: null }
                : await supabaseAdmin
                    .from('grote_inpak_stock')
                    .insert(
                      relevantForInsert.map((item: any) => {
                        const sv = stockValuesForInsert(item)
                        return {
                          erp_code: item.erp_code,
                          kistnummer: item.kistnummer,
                          location: item.location,
                          quantity: sv.quantity,
                          stock: sv.stock,
                          inkoop: sv.inkoop,
                          productie: sv.productie,
                          in_transfer: sv.in_transfer,
                          bc_source: bcSource,
                          item_number: '', // Use empty string instead of null to avoid NOT NULL constraint
                        }
                      })
                    )

              if (insertError) {
                console.error(`Error saving stock data for ${file.name}:`, insertError)
                errors.push(`${file.name}: ${insertError.message}`)
              } else {
                totalProcessed += relevantForInsert.length
                filesProcessed++
                console.log(`Successfully saved ${relevantForInsert.length} stock items for location ${location}`)
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
    logApiError(error, { route: '/api/grote-inpak/upload-multiple', method: 'POST' })
    return NextResponse.json(
      { error: error.message || 'Error processing files' },
      { status: 500 }
    )
  }
}

function extractLocationFromFilename(filename: string): string {
  // Locatie komt uit de bestandsnaam: "Stock Genk.xlsx" → Genk, "Stock Wilrijk.xlsx" → Wilrijk, "Stock Willebroek.xlsx" → Willebroek.
  // Elke file heeft de locatie in de naam, zodat de stock aan de juiste locatie wordt toegewezen (niet uit de Excel-inhoud).
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

/**
 * Verwachte layout Stock Excel. Dezelfde kolomindeling voor alle drie de bestanden;
 * de locatie (Genk / Wilrijk / Willebroek) wordt bepaald door de bestandsnaam (Stock Genk.xlsx, etc.), niet door de inhoud.
 * - Kolom A (index 0): "No." = ERP code (GP-codes, koppeling via ERP LINK naar type kist)
 * - Kolom C (index 2): "Inventory" = aantallen op stock
 * - Kolom K (index 10): "Qty. on Prod. Order" = aantallen in productie (→ kanban "In productie")
 * Overige: B = Consumption Item No., D–H = o.a. Description, I = Qty. on Purch. Order, J = Qty. on Sales Order.
 */
async function parseStockExcel(workbook: XLSX.WorkBook, location: string, isTransfer: boolean = false): Promise<any[]> {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  
  console.log(`Parsing stock file for location ${location}: Range is ${worksheet['!ref']}, total rows: ${range.e.r + 1}`)
  
  const results: any[] = []
  
  // Normaliseer koptekst: kleine letters, spaties samenvoegen (NAV/BC export kan extra spaties hebben)
  const normalizeHeader = (s: string) =>
    String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

  // Zoek de echte headerrij: moet zowel een identifier-kolom (No./Item) als een quantity-kolom bevatten,
  // anders pakken we per ongeluk een titelrij ("Stock Genk") als header.
  const numRowsToCheck = Math.min(6, range.e.r + 1)
  const numColsToScan = Math.min(30, range.e.c + 1)
  let bestHeaderRow = 0
  let bestScore = 0

  for (let checkRow = 0; checkRow < numRowsToCheck; checkRow++) {
    const rowCells: string[] = []
    for (let c = 0; c < numColsToScan; c++) {
      const cell = XLSX.utils.encode_cell({ r: checkRow, c })
      const cellValue = worksheet[cell]
      rowCells.push(normalizeHeader(cellValue ? String(cellValue.v || '') : ''))
    }
    const hasNo = rowCells.some(c => c === 'no.' || c === 'no' || (c.length <= 4 && c.includes('no')))
    const hasItem = rowCells.some(c => /^(no\.?|item|article|code|erp|product|bom|routing|number)$/.test(c) || c.includes('item number') || c.includes('erp code'))
    const hasQty = rowCells.some(c => /inventory|quantity|qty|stock|voorraad|balance|available|on hand/i.test(c))
    const hasProdOrder = rowCells.some(c => /prod\.?\s*order|production\s*order|productie/.test(c))
    const hasPurchOrder = rowCells.some(c => /purch\.?\s*order|purchase\s*order|inkoop/.test(c))
    const score = (hasNo || hasItem ? 2 : 0) + (hasQty ? 2 : 0) + (hasProdOrder ? 1 : 0) + (hasPurchOrder ? 1 : 0)
    if (score > bestScore) {
      bestScore = score
      bestHeaderRow = checkRow
    }
  }

  const headerRowIndex = bestScore >= 2 ? bestHeaderRow : 0
  const startRow = headerRowIndex + 1
  console.log(`Using row ${headerRowIndex + 1} as header (score ${bestScore}), data from row ${startRow + 1}`)

  const headerCells: string[] = []
  for (let c = 0; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: headerRowIndex, c })
    const cellValue = worksheet[cell]
    headerCells.push(cellValue ? normalizeHeader(String(cellValue.v || '')) : '')
  }

  const findColumnIndex = (names: string[]) => {
    if (!headerCells.length) return -1
    return headerCells.findIndex((cell) =>
      names.some((name) => {
        const n = normalizeHeader(name)
        return cell === n || cell.includes(n) || (n.length > 3 && cell.replace(/\s/g, '').includes(n.replace(/\s/g, '')))
      })
    )
  }

  const inventoryIdx = findColumnIndex([
    'inventory',
    'voorraad',
    'stock',
    'quantity',
    'qty',
    'aantal',
    'balance',
    'available',
    'on hand',
    'quantity on hand',
    'in stock',
    'inventory quantity',
    'quantity available',
  ])
  const purchaseIdx = findColumnIndex([
    'qty. on purch. order',
    'qty on purch. order',
    'qty. on purchase order',
    'qty on purchase order',
    'purch. order',
    'purchase order',
    'inkoop',
    'inkooporder',
  ])
  const productionIdx = findColumnIndex([
    'qty. on prod. order',
    'qty on prod. order',
    'qty. on production order',
    'qty on production order',
    '(prod. order)',
    'outstanding qty. (prod. order)',
    'outstd. qty. (prod',
    'prod. order',
    'production order',
    'productie',
    'on prod. order',
    'on prod order',
    'prod order',
    'outstd. prod.',
    'outstanding prod.',
    'in production',
    'manufacturing',
    'prod ord',
    'production qty',
    'qty. on prod order',
    'in bewerking',
    'productieorder',
  ])

  const noIdx = findColumnIndex(['no.', 'no'])
  const erpCandidateIndices = [
    noIdx,
    findColumnIndex(['production bom no.', 'production bom', 'bom']),
    findColumnIndex(['routing no.', 'routing']),
    findColumnIndex(['item', 'article', 'code', 'product', 'erp code', 'erp_code', 'item number', 'item no.', 'item no']),
  ].filter((idx) => idx >= 0)
  // NAV/BC: itemnummer staat vaak in kolom A (index 0); als we geen "No." kolom vonden, kolom 0 toch proberen
  if (noIdx < 0 && !erpCandidateIndices.includes(0)) {
    erpCandidateIndices.unshift(0)
  }

  let quantityColumnIndex = inventoryIdx >= 0 ? inventoryIdx : 2
  console.log(`Column mapping: No./ERP=${noIdx >= 0 ? noIdx : 0}, Inventory=${inventoryIdx >= 0 ? inventoryIdx : 2}(fallback), PurchOrder=${purchaseIdx >= 0 ? purchaseIdx : 8}, ProdOrder=${productionIdx >= 0 ? productionIdx : 10}`)
  if (inventoryIdx < 0 && startRow <= range.e.r) {
    for (const tryCol of [2, 3, 4, 5, 6, 7]) {
      const cell = XLSX.utils.encode_cell({ r: startRow, c: tryCol })
      const val = worksheet[cell]
      const n = val && typeof val.v === 'number' ? val.v : parseFloat(String(val?.v ?? ''))
      if (Number.isFinite(n) && n >= 0) {
        quantityColumnIndex = tryCol
        console.log(`Stock column not found by header; using column index ${tryCol} for quantity (first data row value: ${n})`)
        break
      }
    }
  }
  
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
      const isAlphanumericCode = normalized && (/^[A-Z]{2,}\d+/.test(normalized) || /^C\d+/.test(normalized.toUpperCase()))
      const isNumericItemNo = normalized && /^\d+$/.test(normalized)
      if (normalized && (isAlphanumericCode || isNumericItemNo)) {
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

    if (erpCode) {
      const cleaned = erpCode.toLowerCase()
      if (cleaned === 'erp code' || cleaned === 'erp_code' || cleaned === 'no.' || cleaned === 'no') {
        erpCode = null
      }
    }
    
    // Skip empty rows or rows that look like headers
    // Also skip if ERP code is just "NO" (from "No." header)
    if (!erpCode || erpCode.length < 2) { // Skip very short codes that are likely not ERP codes
      continue
    }
    // Negatieve waarden uit stock files worden op 0 gezet
    // Inventory-kolom kan formaat "aantal, beschrijving" hebben (bv. "5, 9424-6013-82 K") → neem enkel getal vóór de komma
    const parseNumericCell = (cell: any): number => {
      if (!cell) return 0
      const cellValue = cell.v
      let num = 0
      if (typeof cellValue === 'number') {
        num = Math.floor(cellValue)
      } else if (typeof cellValue === 'string') {
        let str = String(cellValue).trim()
        if (str.includes(',')) {
          str = str.split(',')[0].trim()
        }
        let cleanStr = str.replace(/\s+/g, '')
        cleanStr = cleanStr.replace(',', '.')
        cleanStr = cleanStr.replace(/[^\d.-]/g, '')
        const parsed = parseFloat(cleanStr)
        num = isNaN(parsed) ? 0 : Math.floor(parsed)
      } else {
        num = Math.floor(parseFloat(String(cellValue || '0')) || 0)
      }
      return Math.max(0, num)
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
      const purchCol = purchaseIdx >= 0 ? purchaseIdx : 8
      const prodCol = productionIdx >= 0 ? productionIdx : 10

      const colC = XLSX.utils.encode_cell({ r: rowNum, c: quantityColumnIndex })
      const quantityCell = worksheet[colC]
      stock = parseNumericCell(quantityCell)

      const colI = XLSX.utils.encode_cell({ r: rowNum, c: purchCol })
      const inkoopCell = worksheet[colI]
      inkoop = parseNumericCell(inkoopCell)

      const colK = XLSX.utils.encode_cell({ r: rowNum, c: prodCol })
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
      if (results.length <= 5) {
        console.log(`Row ${rowNum + 1}: ERP="${erpCode}", Inventory=${stock}, Productie=${productie}, Location="${location}"`)
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
    console.log(`Sample items (first 10):`, results.slice(0, 10).map(r => `${r.erp_code}: stock=${r.quantity}, productie=${r.productie}`))
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


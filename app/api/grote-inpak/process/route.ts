import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pilsData, erpData, stockData } = body

    if (!pilsData) {
      return NextResponse.json(
        { error: 'PILS data is required' },
        { status: 400 }
      )
    }

    // Process and build overview (ERP is optional)
    const overview = await buildOverview(pilsData, erpData || [], stockData || [])
    const transport = await buildTransport(overview)

    // Save to database
    await saveCasesToDatabase(overview)
    await saveTransportToDatabase(transport)

    // Save stock data if provided
    if (stockData && stockData.length > 0) {
      await saveStockToDatabase(stockData)
    }

    return NextResponse.json({
      success: true,
      overview,
      transport,
      count: overview.length,
    })
  } catch (error: any) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: error.message || 'Error processing data' },
      { status: 500 }
    )
  }
}

async function buildOverview(
  pilsData: any[],
  erpData: any[],
  stockData: any[]
): Promise<any[]> {
  // Create ERP lookup map
  const erpMap = new Map()
  erpData.forEach((item: any) => {
    if (item.item_number) {
      erpMap.set(item.item_number, item)
    }
  })

  // Create stock lookup map - group by item_number and location
  // We need to check if there's stock in Willebroek for each item
  const stockMapByItem = new Map<string, any[]>() // item_number -> array of stock entries
  stockData.forEach((item: any) => {
    if (item.item_number) {
      if (!stockMapByItem.has(item.item_number)) {
        stockMapByItem.set(item.item_number, [])
      }
      stockMapByItem.get(item.item_number)!.push(item)
    }
  })
  
  // Helper function to check if item has stock in Willebroek
  const hasStockInWillebroek = (itemNumber: string): boolean => {
    const stockEntries = stockMapByItem.get(itemNumber) || []
    // Check if any stock entry has location "Willebroek" (case-insensitive)
    return stockEntries.some((entry: any) => {
      const location = String(entry.location || '').toLowerCase()
      return location.includes('willebroek') || location === 'wlb' || location === 'pac3pl'
    })
  }

  // Process PILS data
  const overview: any[] = []
  
  for (const pilsRow of pilsData) {
    // Extract case_label - adjust based on actual PILS structure
    // Try multiple possible column name variations
    const caseLabel = pilsRow['Case Label'] || pilsRow['case_label'] || pilsRow['Case'] || pilsRow['CASE LABEL'] || pilsRow['CASE_LABEL'] || ''
    const caseType = pilsRow['Case Type'] || pilsRow['case_type'] || pilsRow['Type'] || pilsRow['CASE TYPE'] || pilsRow['CASE_TYPE'] || ''
    const itemNumber = pilsRow['Item Number'] || pilsRow['item_number'] || pilsRow['Item'] || pilsRow['ITEM NUMBER'] || pilsRow['ITEM_NUMBER'] || ''
    
    // Extract arrival_date - try all possible variations and format it properly
    // First try known column names
    let arrivalDate = pilsRow['Arrival Date'] || pilsRow['arrival_date'] || pilsRow['Date'] || 
                      pilsRow['ARRIVAL DATE'] || pilsRow['ARRIVAL_DATE'] || pilsRow['Datum'] || 
                      pilsRow['datum'] || pilsRow['DATUM'] || ''
    
    // If not found, try column I (9th column, index 8) - common location for dates in PILS files
    if (!arrivalDate && pilsRow['I']) {
      arrivalDate = pilsRow['I']
    }
    
    // If still not found, try to find any column with YYYYMMDD format (8 digits like 20251218)
    if (!arrivalDate) {
      for (const key in pilsRow) {
        const value = String(pilsRow[key] || '').trim()
        // Check if it's an 8-digit number (YYYYMMDD format)
        if (/^\d{8}$/.test(value)) {
          arrivalDate = value
          break
        }
      }
    }
    
    // Format date if it exists - handle various date formats (including YYYYMMDD)
    if (arrivalDate) {
      arrivalDate = formatDate(arrivalDate)
    }
    
    // Get ERP data first - this contains the productielocatie
    const erpInfo = erpMap.get(itemNumber) || {}
    
    // Productielocatie comes ONLY from ERP LINK file (Wilrijk or Genk)
    // PAC3PL is NOT a productielocatie - it's just a code indicating unit is in Willebroek
    // If no ERP LINK data, productielocatie should be empty
    let productielocatie = erpInfo.productielocatie || ''
    
    // Normalize productielocatie values - only accept Wilrijk or Genk
    if (productielocatie) {
      const normalized = productielocatie.toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        productielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        productielocatie = 'Genk'
      } else {
        // If it's not Wilrijk or Genk, set to empty (could be PAC3PL or other invalid value)
        productielocatie = ''
      }
    }
    
    const locatie = pilsRow['Locatie'] || pilsRow['locatie'] || pilsRow['LOCATIE'] || ''
    const stockLocation = pilsRow['Stock Location'] || pilsRow['stock_location'] || pilsRow['STOCK LOCATION'] || pilsRow['STOCK_LOCATION'] || ''

    // IN WB is only "Ja" if the case (kist) has stock in Willebroek according to stock files
    // We only check the stock files, not the PILS file location
    const inWillebroek = itemNumber ? hasStockInWillebroek(itemNumber) : false

    // Get stock data for this item (all locations)
    const stockEntries = stockMapByItem.get(itemNumber) || []
    const stockInfo = stockEntries.length > 0 ? stockEntries[0] : {} // Use first entry as reference

    // Calculate term based on case type
    const termWerkdagen = calculateTerm(caseType)

    // Calculate deadline
    let deadline: string | null = null
    if (arrivalDate && termWerkdagen > 0) {
      deadline = addBusinessDays(arrivalDate, termWerkdagen)
    }

    // Calculate days overdue
    let dagenTeLaat = 0
    if (deadline) {
      const today = new Date()
      const deadlineDate = new Date(deadline)
      const diffTime = today.getTime() - deadlineDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      dagenTeLaat = diffDays > 0 ? diffDays : 0
    }

    // Calculate days in Willebroek
    let dagenInWillebroek = 0
    if (inWillebroek && arrivalDate) {
      const today = new Date()
      const arrival = new Date(arrivalDate)
      const diffTime = today.getTime() - arrival.getTime()
      dagenInWillebroek = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    }

    overview.push({
      case_label: caseLabel,
      case_type: caseType,
      arrival_date: arrivalDate || null,
      item_number: itemNumber || null,
      productielocatie: productielocatie || null,
      in_willebroek: inWillebroek,
      stock_location: (() => {
        // Get stock location from stock data if available
        const willebroekStock = stockEntries.find((e: any) => {
          const loc = String(e.location || '').toLowerCase()
          return loc.includes('willebroek') || loc === 'wlb' || loc === 'pac3pl'
        })
        return willebroekStock?.location || stockLocation || stockEntries[0]?.location || null
      })(),
      locatie: locatie || null,
      status: null,
      priority: false,
      comment: null,
      term_werkdagen: termWerkdagen,
      deadline: deadline,
      dagen_te_laat: dagenTeLaat,
      dagen_in_willebroek: dagenInWillebroek,
    })
  }

  return overview
}

function calculateTerm(caseType: string): number {
  if (!caseType) return 0
  
  const s = caseType.trim().toUpperCase()
  
  if (s.startsWith('C')) {
    const numberStr = s.substring(1).trim()
    const number = parseInt(numberStr, 10)
    if (!isNaN(number)) {
      if (number >= 100 && number <= 998) {
        return 1 // C kisten 100-998: 1 dag
      } else if (number === 999) {
        return 10 // C kisten 999: 10 dagen
      }
    }
  } else if (s.startsWith('K')) {
    const numberStr = s.substring(1).trim()
    const number = parseInt(numberStr, 10)
    if (!isNaN(number)) {
      if (number >= 1 && number <= 99) {
        return 10 // K kisten 1-99: 10 dagen
      } else if (number >= 100 && number <= 999) {
        return 3 // K kisten 100-999: 3 dagen
      }
    }
  }
  
  return 0
}

function formatDate(dateString: string): string {
  if (!dateString || dateString.trim() === '') return ''
  
  // Try to parse various date formats
  // Handle formats like: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYYMMDD, etc.
  let date: Date | null = null
  
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    date = new Date(dateString)
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(dateString)) {
    const parts = dateString.split(/[\/\-]/)
    if (parts.length === 3) {
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    }
  }
  // Try YYYYMMDD (8 digits, e.g., 20251218)
  else if (/^\d{8}$/.test(dateString.trim())) {
    const cleanDate = dateString.trim()
    const year = cleanDate.substring(0, 4)
    const month = cleanDate.substring(4, 6)
    const day = cleanDate.substring(6, 8)
    // Validate month and day ranges
    const monthNum = parseInt(month, 10)
    const dayNum = parseInt(day, 10)
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      date = new Date(`${year}-${month}-${day}`)
      // Double check the date is valid (handles invalid dates like Feb 30)
      if (date.getFullYear() !== parseInt(year, 10) || 
          date.getMonth() + 1 !== monthNum || 
          date.getDate() !== dayNum) {
        console.warn(`Invalid date: ${dateString} (parsed as ${year}-${month}-${day})`)
        return ''
      }
    } else {
      console.warn(`Invalid date range: ${dateString}`)
      return ''
    }
  }
  // Try default Date parsing
  else {
    date = new Date(dateString)
  }
  
  // Check if date is valid
  if (!date || isNaN(date.getTime())) {
    console.warn(`Invalid date format: ${dateString}`)
    return ''
  }
  
  // Return in YYYY-MM-DD format
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addBusinessDays(startDate: string, days: number): string {
  if (!startDate) return ''
  
  const date = new Date(startDate)
  if (isNaN(date.getTime())) return ''
  
  let count = 0
  
  while (count < days) {
    date.setDate(date.getDate() + 1)
    // Monday = 1, Friday = 5
    if (date.getDay() >= 1 && date.getDay() <= 5) {
      count++
    }
  }
  
  return date.toISOString().split('T')[0]
}

async function buildTransport(overview: any[]): Promise<any[]> {
  return overview
    .filter((case_) => case_.in_willebroek === false)
    .map((case_) => ({
      case_label: case_.case_label,
      transport_needed: true,
      transport_date: null,
      transport_status: null,
    }))
}

async function saveCasesToDatabase(cases: any[]) {
  // Upsert cases (update if exists, insert if not)
  for (const case_ of cases) {
    await supabaseAdmin
      .from('grote_inpak_cases')
      .upsert(case_, {
        onConflict: 'case_label',
        ignoreDuplicates: false,
      })
  }
}

async function saveTransportToDatabase(transport: any[]) {
  // Upsert transport data
  for (const item of transport) {
    await supabaseAdmin
      .from('grote_inpak_transport')
      .upsert(item, {
        onConflict: 'case_label',
        ignoreDuplicates: false,
      })
  }
}

async function saveStockToDatabase(stockData: any[]) {
  // Upsert stock data - use item_number + location as unique key
  for (const item of stockData) {
    await supabaseAdmin
      .from('grote_inpak_stock')
      .upsert({
        item_number: item.item_number,
        location: item.location,
        quantity: item.quantity || 0,
        erp_code: item.erp_code || null,
      }, {
        onConflict: 'item_number,location',
        ignoreDuplicates: false,
      })
  }
}


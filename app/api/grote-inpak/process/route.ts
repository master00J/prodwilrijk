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

    // If no ERP data provided, try to load from database
    let finalErpData = erpData || []
    if (!finalErpData || finalErpData.length === 0) {
      try {
        const { data: dbErpData, error: dbError } = await supabaseAdmin
          .from('grote_inpak_erp_link')
          .select('*')
        
        if (!dbError && dbErpData) {
          // Convert database format to expected format
          finalErpData = dbErpData.map((item: any) => ({
            kistnummer: item.kistnummer,
            erp_code: item.erp_code,
            productielocatie: item.productielocatie,
            description: item.description,
            stapel: item.stapel,
          }))
        }
      } catch (err) {
        console.warn('Could not load ERP LINK from database:', err)
      }
    }

    // Process and build overview (ERP is optional)
    const overview = await buildOverview(pilsData, finalErpData, stockData || [])
    const transport = await buildTransport(overview)

    // Save to database
    await saveCasesToDatabase(overview)
    await saveTransportToDatabase(transport)

    // Remove cases that are no longer present in the latest PILS upload
    await removeMissingCases(overview)

    // Save stock data if provided
    if (stockData && stockData.length > 0) {
      await saveStockToDatabase(stockData)
    }

    // Save backlog snapshot (once per day)
    try {
      const backlogOverdue = overview.filter((item: any) => (item.dagen_te_laat || 0) > 0).length
      const today = new Date().toISOString().split('T')[0]
      await supabaseAdmin
        .from('grote_inpak_backlog_history')
        .upsert(
          { snapshot_date: today, backlog_overdue: backlogOverdue },
          { onConflict: 'snapshot_date' }
        )
    } catch (err) {
      console.warn('Could not save backlog history snapshot:', err)
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
  // Create ERP map - match on kistnummer (which matches case_type from PILS)
  const erpMapByKistnummer = new Map()
  erpData.forEach((item: any) => {
    if (item.kistnummer) {
      // Normalize kistnummer for matching (remove slashes, spaces, convert to uppercase)
      const normalizedKistnummer = String(item.kistnummer).trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '')
      // Store both the normalized version and the original item
      erpMapByKistnummer.set(normalizedKistnummer, item)
      
      // Also store individual parts if kistnummer contains "/" (e.g., "K107/K109")
      if (String(item.kistnummer).includes('/')) {
        const parts = String(item.kistnummer).split('/').map(p => p.trim().toUpperCase())
        parts.forEach(part => {
          if (part && !erpMapByKistnummer.has(part)) {
            erpMapByKistnummer.set(part, item)
          }
        })
      }
    }
  })
  
  // Also create a map by item_number as fallback (for backwards compatibility)
  const erpMapByItemNumber = new Map()
  erpData.forEach((item: any) => {
    if (item.item_number) {
      erpMapByItemNumber.set(item.item_number, item)
    }
  })

  // Create stock lookup maps
  // Stock files: Kolom A = ERP code, Locatie uit bestandsnaam
  // We need to check if kisten (not units!) are in Willebroek
  const stockMapByErpCode = new Map<string, any[]>() // erp_code -> array of stock entries
  const stockMapByKistnummer = new Map<string, any[]>() // kistnummer -> array of stock entries
  
  stockData.forEach((item: any) => {
    // Map by ERP code (primary method)
    if (item.erp_code) {
      const erpCode = String(item.erp_code).trim()
      if (!stockMapByErpCode.has(erpCode)) {
        stockMapByErpCode.set(erpCode, [])
      }
      stockMapByErpCode.get(erpCode)!.push(item)
    }
    
    // Also map by kistnummer if the ERP code is actually a kistnummer (starts with K or C)
    if (item.erp_code) {
      const code = String(item.erp_code).trim().toUpperCase()
      // If code starts with K or C, it's a kistnummer
      if (code.match(/^[KC]/)) {
        // Normalize: V-kisten -> K-kisten
        const kistnummer = code.startsWith('V') ? 'K' + code.substring(1) : code
        if (!stockMapByKistnummer.has(kistnummer)) {
          stockMapByKistnummer.set(kistnummer, [])
        }
        stockMapByKistnummer.get(kistnummer)!.push(item)
      }
    }
  })
  
  // Helper function to check if kist is in Willebroek
  // Check via: 1) kistnummer (direct match), 2) ERP code (via ERP LINK)
  const isKistInWillebroek = (caseType: string, erpCode: string | null): boolean => {
    // Normalize case_type for matching
    let normalizedCaseType = String(caseType || '').trim().toUpperCase()
    // V-kisten -> K-kisten for matching
    if (normalizedCaseType.startsWith('V')) {
      normalizedCaseType = 'K' + normalizedCaseType.substring(1)
    }
    
    // Method 1: Direct match via kistnummer
    const kistStockEntries = stockMapByKistnummer.get(normalizedCaseType) || []
    const hasKistInWB = kistStockEntries.some((entry: any) => {
      const location = String(entry.location || '').toLowerCase()
      return location.includes('willebroek') || location === 'wlb'
    })
    if (hasKistInWB) return true
    
    // Method 2: Match via ERP code (if available)
    if (erpCode) {
      const erpStockEntries = stockMapByErpCode.get(String(erpCode).trim()) || []
      const hasErpInWB = erpStockEntries.some((entry: any) => {
        const location = String(entry.location || '').toLowerCase()
        return location.includes('willebroek') || location === 'wlb'
      })
      if (hasErpInWB) return true
    }
    
    return false
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
    
    // Match ERP data by case_type (from PILS) with kistnummer (from ERP LINK)
    // Normalize case_type for matching (remove spaces, slashes, convert to uppercase)
    let normalizedCaseType = String(caseType || '').trim().toUpperCase().replace(/\s+/g, '')
    
    // If case_type starts with "V" (vaszak), replace with "K" for matching
    // V154 should match K154 in ERP LINK (same kist, but with vaszak)
    if (normalizedCaseType.startsWith('V')) {
      normalizedCaseType = 'K' + normalizedCaseType.substring(1)
    }
    
    let erpInfo = erpMapByKistnummer.get(normalizedCaseType) || {}
    
    // If no exact match, try partial matching (e.g., "K107/K109" should match "K107" or "K109")
    if (!erpInfo.productielocatie && normalizedCaseType) {
      // Try to find any kistnummer that contains the case_type or vice versa
      for (const [kistnummer, erpItem] of erpMapByKistnummer.entries()) {
        const normalizedKistnummer = String(kistnummer).replace(/\s+/g, '').replace(/\//g, '')
        // Check if case_type is part of kistnummer (e.g., "K107" in "K107/K109")
        if (normalizedKistnummer.includes(normalizedCaseType) || normalizedCaseType.includes(normalizedKistnummer)) {
          erpInfo = erpItem
          break
        }
      }
    }
    
    // If still no match found, try to match on item_number as fallback
    if (!erpInfo.productielocatie && itemNumber) {
      erpInfo = erpMapByItemNumber.get(itemNumber) || {}
    }
    
    // Productielocatie comes ONLY from ERP LINK file (Wilrijk or Genk)
    // PAC3PL is NOT a productielocatie - it's just a code indicating unit is in Willebroek
    // If no ERP LINK data matches, productielocatie should be empty (unknown case type)
    let productielocatie = erpInfo.productielocatie || ''
    
    // Normalize productielocatie values - only accept Wilrijk or Genk
    if (productielocatie) {
      const normalized = productielocatie.toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        productielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        productielocatie = 'Genk'
      } else {
        // If it's not Wilrijk or Genk, set to empty (could be PAC3PL, BouwPakket, or other invalid value)
        productielocatie = ''
      }
    }
    
    // Get ERP code from ERP LINK (for stock matching)
    const erpCode = erpInfo.erp_code || null
    
    const locatie = pilsRow['Locatie'] || pilsRow['locatie'] || pilsRow['LOCATIE'] || ''
    const stockLocation = pilsRow['Stock Location'] || pilsRow['stock_location'] || pilsRow['STOCK LOCATION'] || pilsRow['STOCK_LOCATION'] || ''

    // IN WB (In Willebroek) determination for KISTEN (not units!):
    // PAC3PL in PILS file means UNIT is in Willebroek, but says nothing about the KIST
    // We determine in_willebroek ONLY from stock files via ERP code link:
    // case_type → erp_code (via ERP LINK) → stock location (via stock files)
    // OR: case_type (kistnummer) → stock location (direct match)
    const inWillebroek = isKistInWillebroek(caseType, erpCode)
    
    // Get stock location from stock files (if kist is in Willebroek)
    let stockLocationFromStock: string | null = null
    if (inWillebroek) {
      // Find stock entry in Willebroek
      let normalizedCaseType = String(caseType || '').trim().toUpperCase()
      if (normalizedCaseType.startsWith('V')) {
        normalizedCaseType = 'K' + normalizedCaseType.substring(1)
      }
      
      const kistStockEntries = stockMapByKistnummer.get(normalizedCaseType) || []
      const wbEntry = kistStockEntries.find((entry: any) => {
        const location = String(entry.location || '').toLowerCase()
        return location.includes('willebroek') || location === 'wlb'
      })
      
      if (wbEntry) {
        stockLocationFromStock = wbEntry.location || 'Willebroek'
      } else if (erpCode) {
        const erpStockEntries = stockMapByErpCode.get(String(erpCode).trim()) || []
        const wbErpEntry = erpStockEntries.find((entry: any) => {
          const location = String(entry.location || '').toLowerCase()
          return location.includes('willebroek') || location === 'wlb'
        })
        if (wbErpEntry) {
          stockLocationFromStock = wbErpEntry.location || 'Willebroek'
        }
      }
    }

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

    // Get stapel from ERP LINK (default 1)
    const stapel = erpInfo.stapel ? parseInt(String(erpInfo.stapel), 10) : 1
    
    overview.push({
      case_label: caseLabel,
      case_type: caseType,
      arrival_date: arrivalDate || null,
      item_number: itemNumber || null,
      productielocatie: productielocatie || null,
      in_willebroek: inWillebroek,
      stock_location: stockLocationFromStock || stockLocation || null,
      locatie: locatie || null,
      status: null,
      priority: false,
      comment: null,
      erp_code: erpCode || null,
      stapel: stapel >= 1 ? stapel : 1,
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
    // Skip invalid dates like "00000000"
    if (cleanDate === '00000000') {
      return ''
    }
    const year = cleanDate.substring(0, 4)
    const month = cleanDate.substring(4, 6)
    const day = cleanDate.substring(6, 8)
    // Validate month and day ranges
    const monthNum = parseInt(month, 10)
    const dayNum = parseInt(day, 10)
    const yearNum = parseInt(year, 10)
    // Check if year is reasonable (e.g., between 2000 and 2100)
    if (yearNum < 2000 || yearNum > 2100) {
      return ''
    }
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      date = new Date(`${year}-${month}-${day}`)
      // Double check the date is valid (handles invalid dates like Feb 30)
      if (date.getFullYear() !== parseInt(year, 10) || 
          date.getMonth() + 1 !== monthNum ||
          date.getDate() !== dayNum) {
        return ''
      }
    } else {
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
  // Transport nodig: ALLE Genk cases (ongeacht of ze al in Willebroek zijn)
  // Dit omdat de transportplanning ook cases toont die al in Willebroek zijn voor overzicht
  return overview
    .filter((case_) => case_.productielocatie === 'Genk')
    .map((case_) => ({
      case_label: case_.case_label,
      transport_needed: !case_.in_willebroek, // Transport nodig als niet in Willebroek
      transport_date: null,
      transport_status: null,
      bestemming: 'Willebroek', // Alle Genk cases gaan naar Willebroek
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
  // Upsert stock data - use erp_code + location as unique key
  // Stock files: Kolom A = ERP code, Kolom C = quantity, Locatie uit bestandsnaam
  for (const item of stockData) {
    await supabaseAdmin
      .from('grote_inpak_stock')
      .upsert({
        erp_code: item.erp_code,
        location: item.location,
        quantity: item.quantity || 0,
        item_number: '', // Use empty string instead of null to avoid NOT NULL constraint
      }, {
        onConflict: 'erp_code,location',
        ignoreDuplicates: false,
      })
  }
}

async function removeMissingCases(currentOverview: any[]) {
  const currentLabels = new Set(
    currentOverview
      .map((row: any) => String(row.case_label || '').trim())
      .filter((label: string) => label.length > 0)
  )

  if (currentLabels.size === 0) {
    return
  }

  const { data, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('case_label')

  if (error) {
    throw error
  }

  const toDelete = (data || [])
    .map((row: any) => String(row.case_label || '').trim())
    .filter((label: string) => label.length > 0 && !currentLabels.has(label))

  const chunkSize = 500
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize)
    const { error: deleteError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .delete()
      .in('case_label', chunk)

    if (deleteError) {
      throw deleteError
    }
  }
}

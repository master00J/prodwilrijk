import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stockData } = body

    if (!stockData || !Array.isArray(stockData)) {
      return NextResponse.json(
        { error: 'Stock data array is required' },
        { status: 400 }
      )
    }

    // Upsert stock data (update if exists, insert if not)
    // Use item_number + location as unique key
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

    return NextResponse.json({
      success: true,
      count: stockData.length,
    })
  } catch (error: any) {
    console.error('Error saving stock:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving stock data' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemNumber = searchParams.get('item_number')
    const location = searchParams.get('location')

    let query = supabaseAdmin
      .from('grote_inpak_stock')
      .select('*')
      .order('item_number', { ascending: true })

    if (itemNumber) {
      query = query.eq('item_number', itemNumber)
    }

    if (location) {
      query = query.eq('location', location)
    }

    const { data: stockData, error } = await query

    if (error) {
      throw error
    }

    // Load ERP LINK data to match ERP codes with kistnummers
    // ERP LINK file: kolom A = kistnummer, kolom B = erp_code
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')

    // Create mappings: ERP code -> kistnummer and kistnummer -> ERP code
    const erpCodeToKistnummer = new Map<string, string>()
    const kistnummerToErpCode = new Map<string, string>()
    const validErpCodes = new Set<string>() // Only used for filtering if ERP LINK data exists
    
    if (erpLinkData && erpLinkData.length > 0) {
      erpLinkData.forEach((erp: any) => {
        // Normalize ERP code: uppercase, trim, remove spaces
        if (erp.erp_code) {
          const normalizedErpCode = String(erp.erp_code).toUpperCase().trim().replace(/\s+/g, '')
          validErpCodes.add(normalizedErpCode)
          erpCodeToKistnummer.set(normalizedErpCode, erp.kistnummer)
          
          if (erp.kistnummer) {
            const normalizedKistnummer = String(erp.kistnummer).toUpperCase().trim()
            kistnummerToErpCode.set(normalizedKistnummer, normalizedErpCode)
          }
        }
      })
      console.log(`Loaded ${erpLinkData.length} ERP LINK entries, ${validErpCodes.size} valid ERP codes`)
    } else {
      console.warn('No ERP LINK data found - showing all stock items')
    }
    
    // Filter stock data: if ERP LINK data exists, only show items with matching ERP codes
    // If no ERP LINK data, show all stock items
    const filteredStockData = stockData?.filter((item: any) => {
      // If no ERP LINK data, show all items with ERP codes
      if (validErpCodes.size === 0) {
        return !!item.erp_code // Show items that have an ERP code
      }
      
      // If ERP LINK data exists, only show items with matching ERP codes
      if (!item.erp_code) {
        return false // Skip items without ERP code
      }
      
      // Normalize ERP code from stock file (same normalization as in ERP LINK)
      const normalizedStockErpCode = String(item.erp_code).toUpperCase().trim().replace(/\s+/g, '')
      
      // Only include if this ERP code exists in ERP LINK
      return validErpCodes.has(normalizedStockErpCode)
    }) || []
    
    console.log(`Stock data: ${stockData?.length || 0} total items -> ${filteredStockData.length} items shown (ERP LINK filtering: ${validErpCodes.size > 0 ? 'enabled' : 'disabled'})`)

    // Aggregate by kistnummer (from ERP LINK) if available, otherwise by ERP code
    const aggregated = filteredStockData.reduce((acc: any, item: any) => {
      if (!item.erp_code) {
        return acc // Skip items without ERP code
      }
      
      // Normalize ERP code: uppercase, trim, remove spaces
      const normalizedErpCode = String(item.erp_code).toUpperCase().trim().replace(/\s+/g, '')
      
      // Try to find kistnummer via ERP code from ERP LINK
      let kistnummer = erpCodeToKistnummer.get(normalizedErpCode) || null
      
      // Use kistnummer as key if available, otherwise use ERP code
      const key = kistnummer || `ERP_${normalizedErpCode}`
      
      if (!acc[key]) {
        // Get erp_code from ERP LINK if kistnummer exists, otherwise use item's ERP code
        const erpCodeFromLink = kistnummer ? (kistnummerToErpCode.get(kistnummer.toUpperCase().trim()) || item.erp_code) : item.erp_code
        
        acc[key] = {
          kistnummer: kistnummer, // Can be null if not in ERP LINK
          erp_code: erpCodeFromLink,
          locations: [], // Will store { location: string, quantity: number } objects
          locationMap: new Map<string, number>(), // Temporary map to aggregate quantities per location
          total_quantity: 0,
        }
      }
      
      // Aggregate quantities per location using a map to avoid duplicates
      const currentQty = acc[key].locationMap.get(item.location) || 0
      acc[key].locationMap.set(item.location, currentQty + (item.quantity || 0))
      acc[key].total_quantity += item.quantity || 0
      return acc
    }, {})

    // Convert locationMap to locations array for each aggregated item
    const aggregatedArray = aggregated ? Object.values(aggregated) : []
    aggregatedArray.forEach((item: any) => {
      if (item.locationMap && item.locationMap instanceof Map) {
        // Convert map to array of { location, quantity } objects
        const locationEntries = Array.from(item.locationMap.entries()) as [string, number][]
        item.locations = locationEntries.map(([location, quantity]) => ({
          location,
          quantity,
        }))
        // Sort locations alphabetically
        item.locations.sort((a: any, b: any) => a.location.localeCompare(b.location))
        // Remove temporary locationMap
        delete item.locationMap
      }
    })
    
    // Sort aggregated items: items with kistnummer first, then by kistnummer/ERP code
    aggregatedArray.sort((a: any, b: any) => {
      // Items with kistnummer come first
      if (a.kistnummer && !b.kistnummer) return -1
      if (!a.kistnummer && b.kistnummer) return 1
      
      // Sort by kistnummer if both have it, otherwise by ERP code
      const keyA = a.kistnummer || a.erp_code || ''
      const keyB = b.kistnummer || b.erp_code || ''
      return keyA.localeCompare(keyB)
    })
    
    // Use all aggregated items (no filtering)
    const filteredAggregated = aggregatedArray
    
    // Get all unique locations from the filtered stock data for the dropdown
    const allLocations = Array.from(new Set(filteredStockData.map((item: any) => item.location).filter(Boolean) || [])).sort()

    return NextResponse.json({ 
      data: filteredStockData, 
      aggregated: filteredAggregated,
      count: filteredStockData.length,
      allLocations: allLocations // Include all locations for the dropdown
    })
  } catch (error: any) {
    console.error('Error fetching stock:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    )
  }
}


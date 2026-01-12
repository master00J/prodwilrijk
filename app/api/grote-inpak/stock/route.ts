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

    // Load ERP LINK data - only show stock items that have an ERP code in ERP LINK
    // ERP LINK file: kolom B = erp_code, kolom A = kistnummer
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')

    // Create a Set of valid ERP codes from ERP LINK (kolom B)
    // Only stock items with these ERP codes should be shown
    const validErpCodes = new Set<string>()
    const erpCodeToKistnummer = new Map<string, string>()
    const kistnummerToErpCode = new Map<string, string>()
    
    if (erpLinkData && erpLinkData.length > 0) {
      erpLinkData.forEach((erp: any) => {
        // Normalize ERP code: uppercase, trim, remove spaces
        if (erp.erp_code) {
          const normalizedErpCode = String(erp.erp_code).toUpperCase().trim().replace(/\s+/g, '')
          validErpCodes.add(normalizedErpCode) // Add to set of valid ERP codes
          erpCodeToKistnummer.set(normalizedErpCode, erp.kistnummer)
          
          if (erp.kistnummer) {
            const normalizedKistnummer = String(erp.kistnummer).toUpperCase().trim()
            kistnummerToErpCode.set(normalizedKistnummer, normalizedErpCode)
          }
        }
      })
      console.log(`Loaded ${erpLinkData.length} ERP LINK entries, ${validErpCodes.size} valid ERP codes`)
    } else {
      console.warn('No ERP LINK data found - no stock items will be shown')
      // Return empty result if no ERP LINK data
      return NextResponse.json({ 
        data: [], 
        aggregated: [],
        count: 0,
        allLocations: []
      })
    }
    
    // Filter stock data: only include items with ERP codes that exist in ERP LINK
    const filteredStockData = stockData?.filter((item: any) => {
      if (!item.erp_code) {
        return false // Skip items without ERP code
      }
      
      // Normalize ERP code from stock file (same normalization as in ERP LINK)
      const normalizedStockErpCode = String(item.erp_code).toUpperCase().trim().replace(/\s+/g, '')
      
      // Only include if this ERP code exists in ERP LINK
      return validErpCodes.has(normalizedStockErpCode)
    }) || []
    
    console.log(`Filtered stock data: ${stockData?.length || 0} total items -> ${filteredStockData.length} items with valid ERP codes`)

    // Aggregate by kistnummer (from ERP LINK)
    // Only process items that are already filtered (have valid ERP codes)
    const aggregated = filteredStockData.reduce((acc: any, item: any) => {
      // Find kistnummer via erp_code (all items here have valid ERP codes from ERP LINK)
      // Normalize ERP code: uppercase, trim, remove spaces (same as in ERP LINK mapping)
      let kistnummer = null
      if (item.erp_code) {
        const normalizedErpCode = String(item.erp_code).toUpperCase().trim().replace(/\s+/g, '')
        kistnummer = erpCodeToKistnummer.get(normalizedErpCode)
      }

      // All items should have a kistnummer since they have valid ERP codes
      // But if somehow kistnummer is missing, skip the item
      if (!kistnummer) {
        console.warn(`No kistnummer found for ERP code ${item.erp_code} - skipping`)
        return acc
      }
      
      // Use kistnummer as key for aggregation
      const key = kistnummer
      
      if (!acc[key]) {
        // Get erp_code from ERP LINK based on kistnummer
        const erpCodeFromLink = kistnummerToErpCode.get(kistnummer.toUpperCase().trim()) || item.erp_code
        
        acc[key] = {
          kistnummer: kistnummer,
          erp_code: erpCodeFromLink, // Use erp_code from ERP LINK
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
    
    // All aggregated items should have kistnummer (they all have valid ERP codes)
    const filteredAggregated = aggregatedArray.filter((item: any) => 
      item.kistnummer !== null && item.kistnummer !== undefined
    )
    
    filteredAggregated.sort((a: any, b: any) => {
      // Sort by kistnummer
      const keyA = a.kistnummer || ''
      const keyB = b.kistnummer || ''
      return keyA.localeCompare(keyB)
    })
    
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


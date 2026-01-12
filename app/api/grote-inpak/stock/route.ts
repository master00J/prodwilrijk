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
      console.error('Error fetching stock from database:', error)
      throw error
    }

    console.log(`Fetched ${stockData?.length || 0} stock items from database`)

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
          let normalizedErpCode = String(erp.erp_code).toUpperCase().trim().replace(/\s+/g, '')
          
          // Extract GP code if embedded (e.g., "7773 GP008760" -> "GP008760")
          const gpMatch = normalizedErpCode.match(/\b(GP\d+)\b/)
          if (gpMatch) {
            normalizedErpCode = gpMatch[1]
          }
          
          validErpCodes.add(normalizedErpCode)
          erpCodeToKistnummer.set(normalizedErpCode, erp.kistnummer)
          
          if (erp.kistnummer) {
            const normalizedKistnummer = String(erp.kistnummer).toUpperCase().trim()
            kistnummerToErpCode.set(normalizedKistnummer, normalizedErpCode)
          }
        }
      })
      console.log(`Loaded ${erpLinkData.length} ERP LINK entries, ${validErpCodes.size} valid ERP codes`)
      
      // Debug: log some sample ERP codes from ERP LINK
      const sampleErpCodes = Array.from(validErpCodes).slice(0, 10)
      console.log(`Sample ERP codes from ERP LINK:`, sampleErpCodes)
      
      // Debug: log some sample kistnummer mappings
      const sampleKistnummers = Array.from(kistnummerToErpCode.entries()).slice(0, 5)
      console.log(`Sample kistnummer -> ERP code mappings:`, sampleKistnummers)
    } else {
      console.warn('No ERP LINK data found - showing all stock items')
    }
    
    // Filter stock data: Like old code (build_overview.py line 822-848)
    // 1. Accept all stock items first
    // 2. Determine kistnummer: if code starts with K/C use directly, else map via ERP LINK
    // 3. Only keep items where kistnummer starts with K or C (like old code line 848)
    let errorCount = 0 // Track ERROR entries
    
    // First, process all stock items and determine kistnummer for each (like old code line 822-838)
    const processedStockData = stockData?.map((item: any) => {
      // Check if erp_code is actually a kistnummer (starts with K or C)
      // In stock files, kolom A can contain either ERP code OR kistnummer
      let kistnummer: string | null = null
      
      if (item.erp_code) {
        const erpCodeStr = String(item.erp_code).toUpperCase().trim()
        // If it starts with K or C, it's a kistnummer (like old code line 823-827)
        if (erpCodeStr.match(/^[KC]\d+/)) {
          kistnummer = erpCodeStr
        }
      }
      
      // Also check item_number for kistnummer
      if (!kistnummer && item.item_number) {
        const itemNumStr = String(item.item_number).toUpperCase().trim()
        if (itemNumStr.match(/^[KC]\d+/)) {
          kistnummer = itemNumStr
        }
      }
      
      // If not a kistnummer yet, try to map via ERP LINK (like old code line 829-838)
      if (!kistnummer && item.erp_code && validErpCodes.size > 0) {
        // Normalize ERP code
        let normalizedStockErpCode = String(item.erp_code).toUpperCase().trim().replace(/\s+/g, '')
        
        // Extract GP code if embedded (e.g., "7773 GP008760" -> "GP008760")
        const gpMatch = normalizedStockErpCode.match(/\b(GP\d+)\b/)
        if (gpMatch) {
          normalizedStockErpCode = gpMatch[1]
        }
        
        // Skip ERROR entries
        if (normalizedStockErpCode.includes('ERROR')) {
          errorCount++
          return null
        }
        
        // Map ERP code to kistnummer via ERP LINK (like old code line 835)
        kistnummer = erpCodeToKistnummer.get(normalizedStockErpCode) || null
      }
      
      // Return item with determined kistnummer
      return {
        ...item,
        determined_kistnummer: kistnummer,
      }
    }).filter((item: any) => item !== null) || []
    
    // Debug: log first few mapping attempts (after processedStockData is created)
    if (processedStockData.length > 0 && processedStockData.length <= 10) {
      processedStockData.slice(0, 5).forEach((item: any) => {
        console.log(`Mapping result: ERP code "${item.erp_code}" -> kistnummer: ${item.determined_kistnummer || 'NOT FOUND'}`)
      })
    }
    
    // Filter: Only keep items where kistnummer starts with K or C (like old code line 848)
    // TEMPORARY: If no items match, show all items with ERP codes for debugging
    let filteredStockData = processedStockData.filter((item: any) => {
      const kistnummer = item.determined_kistnummer
      if (!kistnummer) {
        return false // Skip items without kistnummer
      }
      
      // Only keep if kistnummer starts with K or C (like old code: out[out["kistnummer"].str.match(r"^[KkCc]", na=False)])
      return kistnummer.match(/^[KC]/) !== null
    })
    
    // TEMPORARY DEBUG: If no items after filtering, show all items with ERP codes
    if (filteredStockData.length === 0 && processedStockData.length > 0) {
      console.warn('⚠️ DEBUG MODE: No items matched kistnummer filter. Showing all items with ERP codes for debugging.')
      filteredStockData = processedStockData.filter((item: any) => {
        // Show items that have an ERP code (even if not mapped to kistnummer)
        return item.erp_code && !String(item.erp_code).toUpperCase().includes('ERROR')
      })
      // For debug mode, use ERP code as kistnummer temporarily
      filteredStockData.forEach((item: any) => {
        if (!item.determined_kistnummer && item.erp_code) {
          item.determined_kistnummer = `DEBUG_${item.erp_code}`
        }
      })
    }
    
    console.log(`Processed ${processedStockData.length} stock items, ${filteredStockData.length} items have kistnummer starting with K or C`)
    
    // Debug: log some sample items that were filtered out
    if (processedStockData.length > filteredStockData.length) {
      const filteredOut = processedStockData.filter((item: any) => {
        const kistnummer = item.determined_kistnummer
        return !kistnummer || !kistnummer.match(/^[KC]/)
      })
      console.log(`Filtered out ${filteredOut.length} items (no kistnummer or doesn't start with K/C)`)
      if (filteredOut.length > 0) {
        const sample = filteredOut.slice(0, 5)
        console.log(`Sample filtered out items:`, sample.map((item: any) => ({
          erp_code: item.erp_code,
          item_number: item.item_number,
          determined_kistnummer: item.determined_kistnummer
        })))
      }
    }
    
    // Update items: set kistnummer from determined_kistnummer and remove temp field
    filteredStockData.forEach((item: any) => {
      if (item.determined_kistnummer) {
        item.kistnummer = item.determined_kistnummer
      }
      delete item.determined_kistnummer
    })
    
    // If we have ERP LINK data but no matches, log a warning
    if (validErpCodes.size > 0 && filteredStockData.length === 0 && stockData && stockData.length > 0) {
      console.warn(`WARNING: ${stockData.length} stock items found, but NONE match the ${validErpCodes.size} ERP codes in ERP LINK.`)
      console.warn(`This suggests the stock files contain old/different ERP codes than the ERP LINK file.`)
      console.warn(`Consider re-uploading the stock files or updating the ERP LINK file.`)
    }
    
    if (errorCount > 0) {
      console.warn(`Found ${errorCount} entries with ERROR in ERP code. These should be cleaned up from the database.`)
    }
    
    console.log(`Stock data: ${stockData?.length || 0} total items -> ${filteredStockData.length} items shown (ERP LINK filtering: ${validErpCodes.size > 0 ? 'enabled' : 'disabled'})`)
    
    // Debug: log some sample ERP codes and check for matches
    if (stockData && stockData.length > 0) {
      const sampleErpCodes = stockData.slice(0, 10).map((item: any) => item.erp_code).filter(Boolean)
      console.log(`Sample ERP codes from stock (first 10):`, sampleErpCodes)
      
      // Check how many stock ERP codes match with ERP LINK
      if (validErpCodes.size > 0) {
        const sampleValidCodes = Array.from(validErpCodes).slice(0, 10)
        console.log(`Sample valid ERP codes from ERP LINK (first 10):`, sampleValidCodes)
        
        // Count matches with detailed logging
        const matchingCodes: string[] = []
        const nonMatchingCodes: string[] = []
        
        sampleErpCodes.forEach(code => {
          let normalized = String(code).toUpperCase().trim().replace(/\s+/g, '')
          // Extract GP code if embedded
          const gpMatch = normalized.match(/\b(GP\d+)\b/)
          if (gpMatch) {
            normalized = gpMatch[1]
          }
          
          if (validErpCodes.has(normalized)) {
            matchingCodes.push(code)
          } else {
            nonMatchingCodes.push(code)
          }
        })
        
        console.log(`Matching codes in sample: ${matchingCodes.length} out of ${sampleErpCodes.length}`)
        if (matchingCodes.length > 0) {
          console.log(`Matching codes:`, matchingCodes)
        }
        if (nonMatchingCodes.length > 0) {
          console.log(`Non-matching codes:`, nonMatchingCodes)
        }
        
        // Check for ERROR1 entries
        const errorEntries = stockData.filter((item: any) => 
          item.erp_code && String(item.erp_code).toUpperCase().includes('ERROR')
        )
        if (errorEntries.length > 0) {
          console.warn(`Found ${errorEntries.length} entries with ERROR in ERP code. These should be cleaned up.`)
        }
      }
    }

    // Aggregate by kistnummer (all items in filteredStockData should have kistnummer now)
    const aggregated = filteredStockData.reduce((acc: any, item: any) => {
      // All items in filteredStockData should have a kistnummer (starts with K or C)
      const kistnummer = item.kistnummer || null
      
      if (!kistnummer) {
        return acc // Skip items without kistnummer (shouldn't happen after filtering)
      }
      
      // Use kistnummer as key for aggregation
      const key = kistnummer
      
      if (!acc[key]) {
        // Get erp_code from ERP LINK if kistnummer exists, otherwise use item's ERP code
        let erpCodeFromLink = item.erp_code || null
        if (kistnummer) {
          const erpFromKist = kistnummerToErpCode.get(kistnummer.toUpperCase().trim())
          if (erpFromKist) {
            erpCodeFromLink = erpFromKist
          }
        }
        
        acc[key] = {
          kistnummer: kistnummer,
          erp_code: erpCodeFromLink || item.erp_code || null,
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


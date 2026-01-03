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

    // Load ERP LINK data to match item_number/erp_code with kistnummer
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')

    // Create maps for matching - match item_number from stock with kistnummer from ERP LINK
    // In stock files, "No." is the item_number (e.g., 100003, 100005)
    // In ERP LINK, we have kistnummer (e.g., K003, K004) and erp_code (e.g., GP006311)
    // We need to match stock item_number with kistnummer
    // Strategy: 
    // 1. Match via erp_code (if stock has erp_code or Consumption Item No.)
    // 2. Match item_number directly with kistnummer (e.g., 100003 -> K003, by extracting last 3 digits)
    // 3. Match item_number with kistnummer number part (e.g., 100003 -> 003 -> K003)
    
    const erpCodeToKistnummer = new Map<string, string>()
    const itemNumberToKistnummer = new Map<string, string>() // For direct item_number -> kistnummer matching
    
    if (erpLinkData) {
      erpLinkData.forEach((erp: any) => {
        if (erp.erp_code) {
          erpCodeToKistnummer.set(String(erp.erp_code).toUpperCase().trim(), erp.kistnummer)
        }
        
        if (erp.kistnummer) {
          const normalizedKistnummer = String(erp.kistnummer).toUpperCase().trim()
          // Store kistnummer as-is (e.g., "K003")
          itemNumberToKistnummer.set(normalizedKistnummer, erp.kistnummer)
          
          // Extract number part from kistnummer (e.g., "003" from "K003")
          const kistnummerNumber = normalizedKistnummer.replace(/^[KCV]/, '')
          if (kistnummerNumber) {
            // Store number part (e.g., "003")
            itemNumberToKistnummer.set(kistnummerNumber, erp.kistnummer)
            // Store with leading zeros removed (e.g., "3")
            const kistnummerNumberNoZeros = String(parseInt(kistnummerNumber, 10))
            if (kistnummerNumberNoZeros !== kistnummerNumber) {
              itemNumberToKistnummer.set(kistnummerNumberNoZeros, erp.kistnummer)
            }
            // Store with "100" prefix (e.g., "100003" for "K003")
            itemNumberToKistnummer.set(`100${kistnummerNumber}`, erp.kistnummer)
            // Store with "100" prefix and no leading zeros (e.g., "1003" for "K003")
            itemNumberToKistnummer.set(`100${kistnummerNumberNoZeros}`, erp.kistnummer)
          }
        }
      })
    }

    // Aggregate by kistnummer (from ERP LINK) instead of item_number
    // If no kistnummer found, use item_number as fallback
    const aggregated = stockData?.reduce((acc: any, item: any) => {
      // Try to find kistnummer via erp_code first
      let kistnummer = null
      if (item.erp_code) {
        kistnummer = erpCodeToKistnummer.get(String(item.erp_code).toUpperCase().trim())
      }
      
      // If no kistnummer found, try to match item_number directly with kistnummer
      // Stock files have "No." which is item_number (e.g., 100003, 100005)
      // We need to extract the last 3 digits and match with kistnummer (e.g., 100003 -> 003 -> K003)
      if (!kistnummer && item.item_number) {
        const normalizedItemNumber = String(item.item_number).trim()
        
        // Try exact match first
        kistnummer = itemNumberToKistnummer.get(normalizedItemNumber.toUpperCase())
        
        // Try extracting last 3 digits (e.g., "100003" -> "003")
        if (!kistnummer && normalizedItemNumber.length >= 3) {
          const last3Digits = normalizedItemNumber.slice(-3)
          kistnummer = itemNumberToKistnummer.get(last3Digits)
          
          // Try with leading zeros removed (e.g., "003" -> "3")
          if (!kistnummer) {
            const last3DigitsNoZeros = String(parseInt(last3Digits, 10))
            kistnummer = itemNumberToKistnummer.get(last3DigitsNoZeros)
          }
        }
        
        // Try extracting last 2 digits (e.g., "10013" -> "13")
        if (!kistnummer && normalizedItemNumber.length >= 2) {
          const last2Digits = normalizedItemNumber.slice(-2)
          kistnummer = itemNumberToKistnummer.get(last2Digits)
        }
        
        // Try via erp_code map as fallback
        if (!kistnummer) {
          kistnummer = erpCodeToKistnummer.get(normalizedItemNumber.toUpperCase())
        }
      }

      // Use kistnummer if found, otherwise use item_number as fallback
      const key = kistnummer || item.item_number || 'UNKNOWN'
      
      if (!acc[key]) {
        acc[key] = {
          kistnummer: kistnummer || null,
          item_number: item.item_number,
          erp_code: item.erp_code,
          locations: [],
          total_quantity: 0,
        }
      }
      acc[key].locations.push({
        location: item.location,
        quantity: item.quantity || 0,
      })
      acc[key].total_quantity += item.quantity || 0
      return acc
    }, {})

    // Sort aggregated data by kistnummer (or item_number if no kistnummer)
    // Filter: only show items that have a kistnummer (matched with ERP LINK)
    const aggregatedArray = aggregated ? Object.values(aggregated) : []
    const filteredAggregated = aggregatedArray.filter((item: any) => item.kistnummer !== null && item.kistnummer !== undefined)
    
    filteredAggregated.sort((a: any, b: any) => {
      const keyA = a.kistnummer || ''
      const keyB = b.kistnummer || ''
      return keyA.localeCompare(keyB)
    })

    // Also filter raw stock data to only include items with kistnummer
    const filteredStockData = stockData?.filter((item: any) => {
      // Check if this item has a matching kistnummer
      let hasKistnummer = false
      if (item.erp_code) {
        hasKistnummer = erpCodeToKistnummer.has(String(item.erp_code).toUpperCase().trim())
      }
      if (!hasKistnummer && item.item_number) {
        const normalizedItemNumber = String(item.item_number).trim()
        // Check various matching strategies
        if (normalizedItemNumber.length >= 3) {
          const last3Digits = normalizedItemNumber.slice(-3)
          hasKistnummer = itemNumberToKistnummer.has(last3Digits) || 
                         itemNumberToKistnummer.has(String(parseInt(last3Digits, 10)))
        }
        if (!hasKistnummer && normalizedItemNumber.length >= 2) {
          const last2Digits = normalizedItemNumber.slice(-2)
          hasKistnummer = itemNumberToKistnummer.has(last2Digits)
        }
        if (!hasKistnummer) {
          hasKistnummer = itemNumberToKistnummer.has(normalizedItemNumber.toUpperCase()) ||
                          erpCodeToKistnummer.has(normalizedItemNumber.toUpperCase())
        }
      }
      return hasKistnummer
    }) || []

    return NextResponse.json({ 
      data: filteredStockData, 
      aggregated: filteredAggregated,
      count: filteredStockData.length 
    })
  } catch (error: any) {
    console.error('Error fetching stock:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    )
  }
}


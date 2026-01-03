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

  // Create stock lookup map
  const stockMap = new Map()
  stockData.forEach((item: any) => {
    if (item.item_number) {
      stockMap.set(item.item_number, item)
    }
  })

  // Process PILS data
  const overview: any[] = []
  
  for (const pilsRow of pilsData) {
    // Extract case_label - adjust based on actual PILS structure
    const caseLabel = pilsRow['Case Label'] || pilsRow['case_label'] || pilsRow['Case'] || ''
    const caseType = pilsRow['Case Type'] || pilsRow['case_type'] || pilsRow['Type'] || ''
    const itemNumber = pilsRow['Item Number'] || pilsRow['item_number'] || pilsRow['Item'] || ''
    const arrivalDate = pilsRow['Arrival Date'] || pilsRow['arrival_date'] || pilsRow['Date'] || ''
    const productielocatie = pilsRow['Productielocatie'] || pilsRow['productielocatie'] || pilsRow['Location'] || ''
    const locatie = pilsRow['Locatie'] || pilsRow['locatie'] || ''
    const stockLocation = pilsRow['Stock Location'] || pilsRow['stock_location'] || ''

    // Check if in Willebroek (PAC3PL)
    const inWillebroek = locatie?.toUpperCase() === 'PAC3PL' || stockLocation?.toUpperCase() === 'PAC3PL'

    // Get ERP data
    const erpInfo = erpMap.get(itemNumber) || {}

    // Get stock data
    const stockInfo = stockMap.get(itemNumber) || {}

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
      stock_location: stockLocation || stockInfo.location || null,
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

function addBusinessDays(startDate: string, days: number): string {
  const date = new Date(startDate)
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


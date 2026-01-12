import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transportData, stockData, planDate } = body

    if (!transportData || !Array.isArray(transportData)) {
      return NextResponse.json(
        { error: 'Transport data is required' },
        { status: 400 }
      )
    }

    // Calculate next business day if not provided
    const nextBusinessDay = planDate ? new Date(planDate) : getNextBusinessDay(new Date())
    
    // Generate Excel file
    const excelBuffer = await generateTransportPlanningExcel(
      transportData,
      stockData || [],
      nextBusinessDay
    )

    // Return as Response with buffer
    // Uint8Array is a valid BodyInit type, but TypeScript needs explicit cast
    return new Response(excelBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Transportplanning_${formatDateForFilename(nextBusinessDay)}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating transport planning:', error)
    return NextResponse.json(
      { error: error.message || 'Error generating transport planning' },
      { status: 500 }
    )
  }
}

function getNextBusinessDay(today: Date): Date {
  const d = new Date(today)
  d.setDate(d.getDate() + 1)
  
  // If Saturday, move to Monday
  if (d.getDay() === 6) {
    d.setDate(d.getDate() + 2)
  }
  // If Sunday, move to Monday
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1)
  }
  
  return d
}

function formatDateNL(date: Date): string {
  const maanden = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ]
  const dagen = [
    'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'
  ]
  
  const dagNaam = dagen[date.getDay() === 0 ? 6 : date.getDay() - 1]
  const dag = date.getDate()
  const maand = maanden[date.getMonth()]
  
  return `${dagNaam} ${dag} ${maand}`
}

function formatDateForFilename(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}`
}

async function generateTransportPlanningExcel(
  transportData: any[],
  stockData: any[],
  planDate: Date
): Promise<Uint8Array> {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Prepare data for aggregation
  const dateStr = formatDateNL(planDate)
  
  // Build stock maps by kistnummer (case_type)
  // Stock data can have kistnummer directly, or we need to match via erp_code
  const wlbStockMap = new Map<string, number>()
  const genkStockMap = new Map<string, number>()
  
  // Also create erp_code to case_type map from transport data for matching
  const erpCodeToCaseType = new Map<string, string>()
  transportData.forEach((item: any) => {
    if (item.erp_code && item.case_type) {
      erpCodeToCaseType.set(String(item.erp_code).trim().toUpperCase(), item.case_type)
    }
  })
  
  if (stockData && stockData.length > 0) {
    stockData.forEach((item: any) => {
      const location = String(item.location || '').toLowerCase()
      let kistnummer = item.kistnummer || item.case_type || ''
      
      // If no kistnummer, try to match via erp_code
      if (!kistnummer && item.erp_code) {
        kistnummer = erpCodeToCaseType.get(String(item.erp_code).trim().toUpperCase()) || ''
      }
      
      if (kistnummer) {
        // Normalize kistnummer (V -> K)
        let normalized = String(kistnummer).trim().toUpperCase()
        if (normalized.startsWith('V')) {
          normalized = 'K' + normalized.substring(1)
        }
        
        if (location.includes('willebroek') || location === 'wlb') {
          const current = wlbStockMap.get(normalized) || 0
          wlbStockMap.set(normalized, current + (item.quantity || item.stock || 0))
        }
        if (location.includes('genk')) {
          const current = genkStockMap.get(normalized) || 0
          genkStockMap.set(normalized, current + (item.quantity || item.stock || 0))
        }
      }
    })
  }
  
  // Aggregate transport data per case_type
  function aggregateForDestination(destinationKeyword: string) {
    const filtered = transportData.filter((item: any) => {
      const bestemming = String(item.bestemming || 'Willebroek').toLowerCase()
      return bestemming.includes(destinationKeyword.toLowerCase())
    })
    
    if (filtered.length === 0) {
      return []
    }
    
    // Group by case_type
    const grouped = new Map<string, any>()
    
    filtered.forEach((item: any) => {
      const caseType = item.case_type || ''
      if (!caseType) return
      
      if (!grouped.has(caseType)) {
        grouped.set(caseType, {
          case_type: caseType,
          erp_code: item.erp_code || '',
          count: 0,
          stapel: item.stapel || 1,
        })
      }
      
      const group = grouped.get(caseType)!
      group.count++
      if (item.erp_code && !group.erp_code) {
        group.erp_code = item.erp_code
      }
    })
    
    // Calculate adjusted counts (subtract Willebroek stock if destination is Willebroek)
    const result: any[] = []
    
    grouped.forEach((group, caseType) => {
      let count = group.count
      
      // Normalize case_type for stock matching (V -> K)
      let normalizedCaseType = String(caseType).trim().toUpperCase()
      if (normalizedCaseType.startsWith('V')) {
        normalizedCaseType = 'K' + normalizedCaseType.substring(1)
      }
      
      // Subtract Willebroek stock if destination is Willebroek
      if (destinationKeyword.toLowerCase() === 'willebroek') {
        const wlbStock = wlbStockMap.get(normalizedCaseType) || 0
        count = Math.max(0, count - wlbStock)
      }
      
      // Round up to multiple of stapel
      const stapel = group.stapel || 1
      const adjusted = Math.ceil(count / stapel) * stapel
      
      // Only include if count > 0
      if (adjusted > 0) {
        const genkStock = genkStockMap.get(normalizedCaseType) || 0
        result.push({
          TO: '',
          'BC CODE': group.erp_code || '',
          OMSCHRIJVING: caseType,
          AANTAL: `${adjusted}st`,
          'STOCK GENK': genkStock > 0 ? String(genkStock) : 'Geen stock',
          GELADEN: '',
          OPMERKING: '',
        })
      }
    })
    
    // Sort by case_type
    result.sort((a, b) => a.OMSCHRIJVING.localeCompare(b.OMSCHRIJVING))
    
    return result
  }
  
  const willebroekData = aggregateForDestination('Willebroek')
  const wilrijkData = aggregateForDestination('Wilrijk')
  
  // Build worksheet data
  const wsData: any[][] = []
  
  // VRACHT 1 - WILLEBROEK
  wsData.push([dateStr, '', '', '', '', '', ''])
  wsData.push(['VRACHT 1 - WILLEBROEK', '', '', '', '', '', ''])
  wsData.push(['TO', 'BC CODE', 'OMSCHRIJVING', 'AANTAL', 'STOCK GENK', 'GELADEN', 'OPMERKING'])
  
  willebroekData.forEach((row) => {
    wsData.push([
      row.TO,
      row['BC CODE'],
      row.OMSCHRIJVING,
      row.AANTAL,
      row['STOCK GENK'],
      row.GELADEN,
      row.OPMERKING,
    ])
  })
  
  // Extra regel voor Genk elke donderdag
  if (planDate.getDay() === 4) { // Thursday
    wsData.push([
      '',
      '101944',
      'Grote OSB platen',
      '2 pakken',
      '',
      '',
      '',
    ])
  }
  
  // Spacer
  wsData.push(['', '', '', '', '', '', ''])
  
  // VRACHT 2 - WILRIJK
  wsData.push([dateStr, '', '', '', '', '', ''])
  wsData.push(['VRACHT 2 - WILRIJK', '', '', '', '', '', ''])
  wsData.push(['TO', 'BC CODE', 'OMSCHRIJVING', 'AANTAL', 'STOCK GENK', 'GELADEN', 'OPMERKING'])
  
  // Houtlijst vaste regel
  wsData.push(['', '', 'Houtlijst', '', '', '', ''])
  
  // Extra regels voor Wilrijk elke woensdag
  if (planDate.getDay() === 3) { // Wednesday
    wsData.push(['', 'GP005642', 'SPIE876', '3 bak', '', '', ''])
    wsData.push(['', 'GP005639', 'SPIE221', '3 bak', '', '', ''])
    wsData.push(['', 'GP005640', 'SPIE222', '3 bak', '', '', ''])
  }
  
  wilrijkData.forEach((row) => {
    wsData.push([
      row.TO,
      row['BC CODE'],
      row.OMSCHRIJVING,
      row.AANTAL,
      row['STOCK GENK'],
      row.GELADEN,
      row.OPMERKING,
    ])
  })
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // TO
    { wch: 18 }, // BC CODE
    { wch: 28 }, // OMSCHRIJVING
    { wch: 10 }, // AANTAL
    { wch: 12 }, // STOCK GENK
    { wch: 10 }, // GELADEN
    { wch: 24 }, // OPMERKING
  ]
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Transportplanning')
  
  // Generate buffer as array (XLSX returns number[] with type: 'array')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  
  // Convert number[] to Uint8Array
  return new Uint8Array(buffer)
}


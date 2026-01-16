import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

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
    
    const filteredTransport = (transportData || []).filter((item: any) => {
      const isGenk = String(item.productielocatie || '').toLowerCase().includes('genk')
      const needsTransport = item.transport_needed === true || item.in_willebroek === false
      return isGenk && needsTransport
    })

    // Generate Excel file
    const excelBuffer = await generateTransportPlanningExcel(
      filteredTransport,
      stockData || [],
      nextBusinessDay
    )

    // Return as Response with buffer
    // Uint8Array is a valid BodyInit type, but TypeScript needs explicit cast
    return new Response(excelBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${formatDateForFilename(nextBusinessDay)}.xlsx"`,
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
    'zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'
  ]
  
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const dagNaam = dagen[date.getDay()]
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
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Transportplanning')

  ws.columns = [
    { width: 18 },
    { width: 18 },
    { width: 28 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 24 },
  ]

  const borderThin = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  }

  const titleStyle = {
    font: { bold: true },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFF00' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: borderThin,
  }

  const headerStyle = {
    font: { bold: true },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D9D9D9' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: borderThin,
  }

  const cellStyle = {
    border: borderThin,
    alignment: { vertical: 'middle' as const },
  }

  const cellCenterStyle = {
    border: borderThin,
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  }

  // Build stock maps by kistnummer (case_type)
  const wlbStockMap = new Map<string, number>()
  const genkStockMap = new Map<string, number>()

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

      if (!kistnummer && item.erp_code) {
        kistnummer = erpCodeToCaseType.get(String(item.erp_code).trim().toUpperCase()) || ''
      }

      if (kistnummer) {
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

  function aggregateForDestination(destinationKeyword: string) {
    const filtered = transportData.filter((item: any) => {
      const bestemming = String(item.bestemming || 'Willebroek').toLowerCase()
      return bestemming.includes(destinationKeyword.toLowerCase())
    })

    if (filtered.length === 0) {
      return []
    }

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

    const result: any[] = []

    grouped.forEach((group, caseType) => {
      let count = group.count

      let normalizedCaseType = String(caseType).trim().toUpperCase()
      if (normalizedCaseType.startsWith('V')) {
        normalizedCaseType = 'K' + normalizedCaseType.substring(1)
      }

      if (destinationKeyword.toLowerCase() === 'willebroek') {
        const wlbStock = wlbStockMap.get(normalizedCaseType) || 0
        count = Math.max(0, count - wlbStock)
      }

      const stapel = group.stapel || 1
      const adjusted = Math.ceil(count / stapel) * stapel

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

    result.sort((a, b) => a.OMSCHRIJVING.localeCompare(b.OMSCHRIJVING))
    return result
  }

  const willebroekData = aggregateForDestination('Willebroek')
  const wilrijkData = aggregateForDestination('Wilrijk')

  const dateStr = formatDateNL(planDate)
  const headers = ['TO', 'BC CODE', 'OMSCHRIJVING', 'AANTAL', 'STOCK GENK', 'GELADEN', 'OPMERKING']

  let rowIndex = 1

  const writeMergedRow = (value: string) => {
    ws.mergeCells(rowIndex, 1, rowIndex, 7)
    const cell = ws.getCell(rowIndex, 1)
    cell.value = value
    cell.style = titleStyle
    rowIndex += 1
  }

  const writeHeaderRow = () => {
    const row = ws.addRow(headers)
    row.eachCell((cell) => {
      cell.style = headerStyle
    })
    rowIndex += 1
  }

  const writeDataRow = (values: any[]) => {
    const row = ws.addRow(values)
    row.eachCell((cell, colNumber) => {
      if ([2, 4, 5, 6].includes(colNumber)) {
        cell.style = cellCenterStyle
      } else {
        cell.style = cellStyle
      }
    })
    rowIndex += 1
  }

  // Vracht 1 - Willebroek
  writeMergedRow(dateStr)
  writeMergedRow('VRACHT 1 - WILLEBROEK')
  writeHeaderRow()
  willebroekData.forEach((row) => {
    writeDataRow([
      row.TO,
      row['BC CODE'],
      row.OMSCHRIJVING,
      row.AANTAL,
      row['STOCK GENK'],
      row.GELADEN,
      row.OPMERKING,
    ])
  })

  if (planDate.getDay() === 4) {
    writeDataRow(['', '101944', 'Grote OSB platen', '2 pakken', '', '', ''])
  }

  // Spacer
  ws.addRow(['', '', '', '', '', '', ''])
  rowIndex += 1

  // Vracht 2 - Wilrijk
  writeMergedRow(dateStr)
  writeMergedRow('VRACHT 2 - WILRIJK')
  writeHeaderRow()
  writeDataRow(['', '', 'Houtlijst', '', '', '', ''])

  if (planDate.getDay() === 3) {
    writeDataRow(['', 'GP005642', 'SPIE876', '3 bak', '', '', ''])
    writeDataRow(['', 'GP005639', 'SPIE221', '3 bak', '', '', ''])
    writeDataRow(['', 'GP005640', 'SPIE222', '3 bak', '', '', ''])
  }

  wilrijkData.forEach((row) => {
    writeDataRow([
      row.TO,
      row['BC CODE'],
      row.OMSCHRIJVING,
      row.AANTAL,
      row['STOCK GENK'],
      row.GELADEN,
      row.OPMERKING,
    ])
  })

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
mport { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

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
    
    const filteredTransport = (transportData || []).filter((item: any) => {
      const isGenk = String(item.productielocatie || '').toLowerCase().includes('genk')
      const needsTransport = item.transport_needed === true || item.in_willebroek === false
      return isGenk && needsTransport
    })

    // Generate Excel file
    const excelBuffer = await generateTransportPlanningExcel(
      filteredTransport,
      stockData || [],
      nextBusinessDay
    )

    // Return as Response with buffer
    // Uint8Array is a valid BodyInit type, but TypeScript needs explicit cast
    return new Response(excelBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${formatDateForFilename(nextBusinessDay)}.xlsx"`,
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
    'zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'
  ]
  
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const dagNaam = dagen[date.getDay()]
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
  
  // Apply formatting to match the original Excel files
  // Find row indices for date/title rows and headers
  let currentRow = 0
  
  // VRACHT 1 - WILLEBROEK section
  // Row 0: Date (yellow background, merged)
  const dateRow1 = currentRow
  ws['!merges'] = ws['!merges'] || []
  ws['!merges'].push({ s: { r: dateRow1, c: 0 }, e: { r: dateRow1, c: 6 } })
  const dateCell1 = XLSX.utils.encode_cell({ r: dateRow1, c: 0 })
  if (ws[dateCell1]) {
    ws[dateCell1].s = {
      font: { bold: true, sz: 12 },
      fill: { fgColor: { rgb: 'FFFF00' } }, // Yellow background
      alignment: { horizontal: 'left', vertical: 'center' }
    }
  }
  
  // Row 1: Title "VRACHT 1 - WILLEBROEK" (yellow background, merged)
  const titleRow1 = dateRow1 + 1
  ws['!merges'].push({ s: { r: titleRow1, c: 0 }, e: { r: titleRow1, c: 6 } })
  const titleCell1 = XLSX.utils.encode_cell({ r: titleRow1, c: 0 })
  if (ws[titleCell1]) {
    ws[titleCell1].s = {
      font: { bold: true, sz: 12 },
      fill: { fgColor: { rgb: 'FFFF00' } }, // Yellow background
      alignment: { horizontal: 'left', vertical: 'center' }
    }
  }
  
  // Row 2: Headers (grey background, bold)
  const headerRow1 = titleRow1 + 1
  for (let c = 0; c < 7; c++) {
    const cell = XLSX.utils.encode_cell({ r: headerRow1, c })
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'D3D3D3' } }, // Light grey background
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }
  }
  
  // Find VRACHT 2 - WILRIJK section
  let rowIndex = 0
  let foundWilrijk = false
  for (let i = 0; i < wsData.length; i++) {
    if (Array.isArray(wsData[i]) && wsData[i][0] === dateStr && !foundWilrijk) {
      // Check if next row is VRACHT 2
      if (i + 1 < wsData.length && wsData[i + 1][0] === 'VRACHT 2 - WILRIJK') {
        foundWilrijk = true
        const dateRow2 = i
        const titleRow2 = i + 1
        const headerRow2 = i + 2
        
        // Row for date (yellow background, merged)
        ws['!merges'].push({ s: { r: dateRow2, c: 0 }, e: { r: dateRow2, c: 6 } })
        const dateCell2 = XLSX.utils.encode_cell({ r: dateRow2, c: 0 })
        if (ws[dateCell2]) {
          ws[dateCell2].s = {
            font: { bold: true, sz: 12 },
            fill: { fgColor: { rgb: 'FFFF00' } }, // Yellow background
            alignment: { horizontal: 'left', vertical: 'center' }
          }
        }
        
        // Row for title "VRACHT 2 - WILRIJK" (yellow background, merged)
        ws['!merges'].push({ s: { r: titleRow2, c: 0 }, e: { r: titleRow2, c: 6 } })
        const titleCell2 = XLSX.utils.encode_cell({ r: titleRow2, c: 0 })
        if (ws[titleCell2]) {
          ws[titleCell2].s = {
            font: { bold: true, sz: 12 },
            fill: { fgColor: { rgb: 'FFFF00' } }, // Yellow background
            alignment: { horizontal: 'left', vertical: 'center' }
          }
        }
        
        // Row for headers (grey background, bold)
        for (let c = 0; c < 7; c++) {
          const cell = XLSX.utils.encode_cell({ r: headerRow2, c })
          if (ws[cell]) {
            ws[cell].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: 'D3D3D3' } }, // Light grey background
              alignment: { horizontal: 'center', vertical: 'center' }
            }
          }
        }
        break
      }
    }
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Transportplanning')
  
  // Generate buffer as array (XLSX returns number[] with type: 'array')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  
  // Convert number[] to Uint8Array
  return new Uint8Array(buffer)
}


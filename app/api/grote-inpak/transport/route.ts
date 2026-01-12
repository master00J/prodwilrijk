import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get transport data
    const { data: transportData, error: transportError } = await supabaseAdmin
      .from('grote_inpak_transport')
      .select('*')
      .order('created_at', { ascending: false })

    if (transportError) {
      throw transportError
    }

    // Get case labels to fetch case details
    const caseLabels = (transportData || []).map((item: any) => item.case_label).filter(Boolean)
    
    // Fetch case details separately to avoid join issues
    let casesMap = new Map()
    if (caseLabels.length > 0) {
      // Build select query - only include columns that exist
      const { data: casesData, error: casesError } = await supabaseAdmin
        .from('grote_inpak_cases')
        .select('case_label, case_type, arrival_date, item_number, productielocatie, in_willebroek, stock_location, status, comment, erp_code, stapel')
        .in('case_label', caseLabels)

      if (!casesError && casesData) {
        casesData.forEach((caseItem: any) => {
          casesMap.set(caseItem.case_label, caseItem)
        })
      }
    }

    // Flatten the data structure
    const flattenedData = (transportData || []).map((item: any) => {
      const caseData = casesMap.get(item.case_label) || {}
      return {
        case_label: item.case_label,
        transport_needed: item.transport_needed,
        transport_date: item.transport_date,
        transport_status: item.transport_status,
        bestemming: item.bestemming || 'Willebroek',
        // Include all case fields (will be null/undefined if column doesn't exist)
        case_type: caseData.case_type,
        arrival_date: caseData.arrival_date,
        item_number: caseData.item_number,
        productielocatie: caseData.productielocatie,
        in_willebroek: caseData.in_willebroek,
        stock_location: caseData.stock_location,
        status: caseData.status,
        comment: caseData.comment,
        erp_code: caseData.erp_code || null,
        stapel: caseData.stapel || 1,
      }
    })

    return NextResponse.json({ data: flattenedData, count: flattenedData.length })
  } catch (error: any) {
    console.error('Error fetching transport:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching transport data' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get transport data with case details via join
    const { data: transportData, error: transportError } = await supabaseAdmin
      .from('grote_inpak_transport')
      .select(`
        *,
        case:grote_inpak_cases!case_label (
          case_type,
          arrival_date,
          item_number,
          productielocatie,
          in_willebroek,
          stock_location,
          status,
          comment,
          erp_code,
          stapel
        )
      `)
      .order('created_at', { ascending: false })

    if (transportError) {
      throw transportError
    }

    // Flatten the data structure
    const flattenedData = (transportData || []).map((item: any) => {
      const caseData = item.case || {}
      return {
        case_label: item.case_label,
        transport_needed: item.transport_needed,
        transport_date: item.transport_date,
        transport_status: item.transport_status,
        bestemming: item.bestemming || 'Willebroek',
        // Include all case fields
        case_type: caseData.case_type,
        arrival_date: caseData.arrival_date,
        item_number: caseData.item_number,
        productielocatie: caseData.productielocatie,
        in_willebroek: caseData.in_willebroek,
        stock_location: caseData.stock_location,
        status: caseData.status,
        comment: caseData.comment,
        erp_code: caseData.erp_code,
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


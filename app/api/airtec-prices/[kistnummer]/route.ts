import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kistnummer: string }> }
) {
  try {
    const { kistnummer: kistnummerParam } = await params
    const kistnummer = decodeURIComponent(kistnummerParam)
    const body = await request.json()
    const { erp_code, price, assembly_cost, material_cost, transport_cost } = body

    if (price === undefined) {
      return NextResponse.json(
        { error: 'Price is required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      price: parseFloat(price) || 0,
      updated_at: new Date().toISOString(),
    }

    if (erp_code !== undefined) {
      updateData.erp_code = erp_code?.trim() || null
    }
    if (assembly_cost !== undefined) {
      updateData.assembly_cost = parseFloat(assembly_cost) || 0
    }
    if (material_cost !== undefined) {
      updateData.material_cost = parseFloat(material_cost) || 0
    }
    if (transport_cost !== undefined) {
      updateData.transport_cost = parseFloat(transport_cost) || 0
    }

    const { data, error } = await supabaseAdmin
      .from('airtec_prices')
      .update(updateData)
      .eq('kistnummer', kistnummer)
      .select()
      .single()

    if (error) {
      console.error('Error updating airtec price:', error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Price not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update price' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      price: data,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kistnummer: string }> }
) {
  try {
    const { kistnummer: kistnummerParam } = await params
    const kistnummer = decodeURIComponent(kistnummerParam)

    const { error } = await supabaseAdmin
      .from('airtec_prices')
      .delete()
      .eq('kistnummer', kistnummer)

    if (error) {
      console.error('Error deleting airtec price:', error)
      return NextResponse.json(
        { error: 'Failed to delete price' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Price deleted successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


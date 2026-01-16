import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET - Fetch all ERP LINK entries
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('*')
      .order('kistnummer', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('Error fetching ERP LINK data:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching ERP LINK data' },
      { status: 500 }
    )
  }
}

// POST - Create new ERP LINK entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kistnummer, erp_code, productielocatie, description, stapel } = body

    if (!kistnummer) {
      return NextResponse.json(
        { error: 'kistnummer is required' },
        { status: 400 }
      )
    }

    // Normalize productielocatie
    let normalizedProductielocatie = ''
    if (productielocatie) {
      const normalized = String(productielocatie).toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        normalizedProductielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        normalizedProductielocatie = 'Genk'
      }
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .insert({
        kistnummer: String(kistnummer).trim().toUpperCase(),
        erp_code: erp_code ? String(erp_code).trim() : null,
        productielocatie: normalizedProductielocatie || null,
        description: description ? String(description).trim() : null,
        stapel: stapel !== undefined && stapel !== null ? Math.max(1, Number(stapel) || 1) : 1,
      })
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Kistnummer already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Error creating ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating ERP LINK entry' },
      { status: 500 }
    )
  }
}

// PUT - Update existing ERP LINK entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, kistnummer, erp_code, productielocatie, description, stapel } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Normalize productielocatie
    let normalizedProductielocatie = ''
    if (productielocatie) {
      const normalized = String(productielocatie).toLowerCase().trim()
      if (normalized.includes('wilrijk')) {
        normalizedProductielocatie = 'Wilrijk'
      } else if (normalized.includes('genk')) {
        normalizedProductielocatie = 'Genk'
      }
    }

    const updateData: any = {}
    if (kistnummer !== undefined) updateData.kistnummer = String(kistnummer).trim().toUpperCase()
    if (erp_code !== undefined) updateData.erp_code = erp_code ? String(erp_code).trim() : null
    if (productielocatie !== undefined) updateData.productielocatie = normalizedProductielocatie || null
    if (description !== undefined) updateData.description = description ? String(description).trim() : null
    if (stapel !== undefined) updateData.stapel = Math.max(1, Number(stapel) || 1)

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Kistnummer already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Error updating ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating ERP LINK entry' },
      { status: 500 }
    )
  }
}

// DELETE - Delete ERP LINK entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('Error deleting ERP LINK entry:', error)
    return NextResponse.json(
      { error: error.message || 'Error deleting ERP LINK entry' },
      { status: 500 }
    )
  }
}



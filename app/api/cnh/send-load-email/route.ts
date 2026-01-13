import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/send-load-email - Send load email with PDF
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { loadReference, containerNumber, truckPlate } = body

    if (!loadReference || !containerNumber) {
      return NextResponse.json(
        { error: 'loadReference and containerNumber are required' },
        { status: 400 }
      )
    }

    // Get motors for this load
    const { data: motors, error: motorsError } = await supabaseAdmin
      .from('cnh_motors')
      .select('*')
      .eq('load_reference', loadReference)
      .eq('container_number', containerNumber)
      .eq('state', 'loaded')

    if (motorsError) {
      console.error('Error fetching motors:', motorsError)
      return NextResponse.json(
        { error: 'Failed to fetch motors' },
        { status: 500 }
      )
    }

    // TODO: Implement email sending with PDF generation
    // For now, just return success
    // In production, you would:
    // 1. Generate PDF with motor list
    // 2. Get container photo if available
    // 3. Send email with PDF and photo attachment

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      motorCount: motors?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


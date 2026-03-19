import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// DELETE - Delete one or multiple wood packages
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Package IDs are required' },
        { status: 400 }
      )
    }

    // Convert all IDs to numbers
    const packageIds = ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))

    if (packageIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid package IDs' },
        { status: 400 }
      )
    }

    // Check if any packages are already received
    const { data: packages, error: checkError } = await supabaseAdmin
      .from('wood_packages')
      .select('id, ontvangen, pakketnummer')
      .in('id', packageIds)

    if (checkError) {
      console.error('Error checking packages:', checkError)
      return NextResponse.json(
        { error: 'Failed to check packages' },
        { status: 500 }
      )
    }

    const receivedPackages = packages?.filter((pkg: any) => pkg.ontvangen) || []
    if (receivedPackages.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete received packages: ${receivedPackages.map((p: any) => p.pakketnummer).join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Delete packages
    const { error } = await supabaseAdmin
      .from('wood_packages')
      .delete()
      .in('id', packageIds)

    if (error) {
      console.error('Error deleting packages:', error)
      return NextResponse.json(
        { error: 'Failed to delete packages', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${packageIds.length} package(s)` 
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




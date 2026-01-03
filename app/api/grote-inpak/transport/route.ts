import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_transport')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ data: data || [], count: data?.length || 0 })
  } catch (error: any) {
    console.error('Error fetching transport:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching transport data' },
      { status: 500 }
    )
  }
}


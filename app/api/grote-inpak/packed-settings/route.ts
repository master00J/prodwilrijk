import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const DEFAULTS = {
  po_apf: 'MF-4536602',
  po_s4: 'MF-4536602',
  po_s5: 'MF-4536602',
  po_s9: 'MF-4536602',
  po_indus: 'MF-4581681',
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_packed_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      data: data || { id: 1, ...DEFAULTS },
    })
  } catch (error: any) {
    console.error('Error fetching packed settings:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching packed settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = {
      id: 1,
      po_apf: String(body.po_apf || '').trim() || DEFAULTS.po_apf,
      po_s4: String(body.po_s4 || '').trim() || DEFAULTS.po_s4,
      po_s5: String(body.po_s5 || '').trim() || DEFAULTS.po_s5,
      po_s9: String(body.po_s9 || '').trim() || DEFAULTS.po_s9,
      po_indus: String(body.po_indus || '').trim() || DEFAULTS.po_indus,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_packed_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error saving packed settings:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving packed settings' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Geen items om te verwerken' }, { status: 400 })
    }

    const results: any[] = []

    for (const item of items) {
      const { kistnummer, amount, erp_code } = item
      if (!kistnummer || !amount) continue

      const kist = String(kistnummer).trim()
      const qty = Number(amount)
      if (qty <= 0) continue

      // Haal huidige rij op
      const { data: existing } = await supabaseAdmin
        .from('airtec_kisten_stock')
        .select('id, huidige_voorraad')
        .eq('kistnummer', kist)
        .maybeSingle()

      if (existing) {
        const newStock = (existing.huidige_voorraad || 0) + qty
        const { error: updateError } = await supabaseAdmin
          .from('airtec_kisten_stock')
          .update({ huidige_voorraad: newStock, updated_at: new Date().toISOString() })
          .eq('id', existing.id)

        if (updateError) {
          console.error(`Update error kist ${kist}:`, updateError)
          results.push({ kistnummer: kist, success: false, error: updateError.message })
          continue
        }
        results.push({ kistnummer: kist, success: true, added: qty, new_stock: newStock })
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('airtec_kisten_stock')
          .insert({
            kistnummer: kist,
            erp_code: erp_code ? String(erp_code).trim() : null,
            huidige_voorraad: qty,
            minimum_voorraad: 0,
          })

        if (insertError) {
          console.error(`Insert error kist ${kist}:`, insertError)
          results.push({ kistnummer: kist, success: false, error: insertError.message })
          continue
        }
        results.push({ kistnummer: kist, success: true, added: qty, new_stock: qty })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('confirm-cmr error:', err)
    return NextResponse.json({ error: err.message || 'Onverwachte fout' }, { status: 500 })
  }
})

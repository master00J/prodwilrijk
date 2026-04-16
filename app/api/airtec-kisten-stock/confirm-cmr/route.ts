import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'

export const POST = withAuth(async (request) => {
  const body = await request.json()
  const { items } = body

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Geen items om te verwerken' }, { status: 400 })
  }

  const results: any[] = []

  for (const item of items) {
    const { kistnummer, amount, erp_code } = item
    if (!kistnummer || !amount) continue

    const qty = Number(amount)
    if (qty <= 0) continue

    // Probeer stock te verhogen via RPC
    const { error: rpcError } = await supabaseAdmin.rpc('increment_airtec_kisten_stock', {
      p_kistnummer: String(kistnummer).trim(),
      p_quantity: qty,
    })

    if (rpcError) {
      // Kistnummer bestaat nog niet: aanmaken
      const { error: insertError } = await supabaseAdmin
        .from('airtec_kisten_stock')
        .insert({
          kistnummer: String(kistnummer).trim(),
          erp_code: erp_code ? String(erp_code).trim() : null,
          huidige_voorraad: qty,
          minimum_voorraad: 0,
        })

      if (insertError) {
        results.push({ kistnummer, success: false, error: insertError.message })
        continue
      }
    }

    results.push({ kistnummer, success: true, added: qty })
  }

  return NextResponse.json({ success: true, results })
})

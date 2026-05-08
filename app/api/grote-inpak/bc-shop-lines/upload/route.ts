import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { parseBcShopLinesExcel } from '@/lib/grote-inpak/parse-bc-shop-lines-excel'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Oilfree/BC Excel: kolom F PILS (volledig serial) matcht op shopOrderMatchKey ==
 * genormaliseerde waarde uit Excel (laatste 6 cijfers, typ. kolom I / substr 11,6).
 * Atlas uit Excel (kolom H), FP per lijn uit Item No., Customer Order No. (typ. kolom K).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const parsed = parseBcShopLinesExcel(workbook)

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            'Geen bruikbare rijen. Verwacht een tabel met Item No. en een kolom met de 6-cijferige suffix (kolom I of substr …11,6).',
        },
        { status: 422 },
      )
    }

    const byKey = new Map<string, (typeof parsed)[0]>()
    for (const row of parsed) {
      if (!row.match_key) continue
      byKey.set(row.match_key, row)
    }

    const { data: cases, error: fetchErr } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, serial_number, pils_shop_order_key')

    if (fetchErr) throw fetchErr

    const matchedAt = new Date().toISOString()
    const updates: Array<{
      case_label: string
      pils_shop_order_key: string
      atlas_planner_email: string | null
      bc_fp_item_no: string | null
      bc_shop_order_no: string | null
      bc_sales_order_no: string | null
      bc_customer_order_no: string | null
      bc_line_description: string | null
      bc_shop_lines_source_file: string
      bc_shop_lines_matched_at: string
    }> = []

    for (const c of cases || []) {
      const k =
        shopOrderMatchKey(c.serial_number) ??
        shopOrderMatchKey(String(c.pils_shop_order_key ?? '').trim() || undefined)
      if (!k) continue
      const hit = byKey.get(k)
      if (!hit) continue
      updates.push({
        case_label: c.case_label,
        pils_shop_order_key: k,
        atlas_planner_email: hit.atlas_planner_email,
        bc_fp_item_no: hit.fp_item_no,
        bc_shop_order_no: hit.match_raw,
        bc_sales_order_no: hit.sales_order_no,
        bc_customer_order_no: hit.customer_order_no,
        bc_line_description: hit.description,
        bc_shop_lines_source_file: file.name,
        bc_shop_lines_matched_at: matchedAt,
      })
    }

    const CHUNK = 40
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      const results = await Promise.all(
        chunk.map((u) =>
          supabaseAdmin
            .from('grote_inpak_cases')
            .update({
              pils_shop_order_key: u.pils_shop_order_key,
              atlas_planner_email: u.atlas_planner_email,
              bc_fp_item_no: u.bc_fp_item_no,
              bc_shop_order_no: u.bc_shop_order_no,
              bc_sales_order_no: u.bc_sales_order_no,
              bc_customer_order_no: u.bc_customer_order_no,
              bc_line_description: u.bc_line_description,
              bc_shop_lines_source_file: u.bc_shop_lines_source_file,
              bc_shop_lines_matched_at: u.bc_shop_lines_matched_at,
            })
            .eq('case_label', u.case_label),
        ),
      )
      for (const r of results) {
        if (r.error) throw r.error
      }
    }

    return NextResponse.json({
      success: true,
      file: file.name,
      excel_rows_used: parsed.length,
      unique_match_keys: byKey.size,
      cases_matched: updates.length,
      cases_in_db: (cases || []).length,
    })
  } catch (error: any) {
    logApiError(error, { route: '/api/grote-inpak/bc-shop-lines/upload', method: 'POST' })
    return NextResponse.json({ error: error.message || 'Upload mislukt' }, { status: 500 })
  }
}

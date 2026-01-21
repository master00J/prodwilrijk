import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const status = searchParams.get('status')
    const uitgevoerdDoor = searchParams.get('uitgevoerdDoor')
    const gecontroleerdePersonn = searchParams.get('gecontroleerdePersonn')
    const afdeling = searchParams.get('afdeling')
    const product = searchParams.get('product')
    const ordernummer = searchParams.get('ordernummer')

    let query = supabaseAdmin
      .from('product_controles')
      .select('id, product_naam, order_nummer, controle_datum, uitgevoerd_door, gecontroleerde_persoon, status, afdeling, algemene_opmerkingen, checklist_templates(naam)')
      .order('controle_datum', { ascending: false })

    if (dateFrom) {
      query = query.gte('controle_datum', `${dateFrom}T00:00:00.000Z`)
    }
    if (dateTo) {
      query = query.lte('controle_datum', `${dateTo}T23:59:59.999Z`)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (uitgevoerdDoor) {
      query = query.ilike('uitgevoerd_door', `%${uitgevoerdDoor}%`)
    }
    if (gecontroleerdePersonn) {
      query = query.ilike('gecontroleerde_persoon', `%${gecontroleerdePersonn}%`)
    }
    if (afdeling) {
      query = query.eq('afdeling', afdeling)
    }
    if (product) {
      query = query.ilike('product_naam', `%${product}%`)
    }
    if (ordernummer) {
      query = query.ilike('order_nummer', `%${ordernummer}%`)
    }

    const { data: controles, error } = await query

    if (error) {
      console.error('Error exporting controles:', error)
      return NextResponse.json({ error: 'Failed to export controles' }, { status: 500 })
    }

    const controleIds = (controles || []).map((row: any) => row.id)

    const [itemsCounts, fotosCounts] = await Promise.all([
      supabaseAdmin
        .from('controle_checklist_items')
        .select('controle_id')
        .in('controle_id', controleIds),
      supabaseAdmin
        .from('controle_fotos')
        .select('controle_id')
        .in('controle_id', controleIds),
    ])

    const itemCountMap = new Map<number, number>()
    const fotoCountMap = new Map<number, number>()
    itemsCounts.data?.forEach((row: any) => {
      itemCountMap.set(row.controle_id, (itemCountMap.get(row.controle_id) || 0) + 1)
    })
    fotosCounts.data?.forEach((row: any) => {
      fotoCountMap.set(row.controle_id, (fotoCountMap.get(row.controle_id) || 0) + 1)
    })

    const headers = [
      'ID',
      'Product Naam',
      'Ordernummer',
      'Datum',
      'Uitgevoerd Door',
      'Gecontroleerde Persoon',
      'Status',
      'Afdeling',
      'Template',
      'Checklist Items',
      'Fotos',
      'Opmerkingen',
    ]

    const rows = (controles || []).map((controle: any) => [
      controle.id,
      `"${controle.product_naam || ''}"`,
      `"${controle.order_nummer || ''}"`,
      new Date(controle.controle_datum).toLocaleString('nl-NL'),
      `"${controle.uitgevoerd_door || ''}"`,
      `"${controle.gecontroleerde_persoon || ''}"`,
      `"${controle.status || ''}"`,
      `"${controle.afdeling || ''}"`,
      `"${controle.checklist_templates?.naam || 'Ad-hoc'}"`,
      itemCountMap.get(controle.id) || 0,
      fotoCountMap.get(controle.id) || 0,
      `"${(controle.algemene_opmerkingen || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const filename = `controles_export_${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse('\ufeff' + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

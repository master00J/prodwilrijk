import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { data: controles, error } = await supabaseAdmin
      .from('product_controles')
      .select('id, product_naam, order_nummer, controle_datum, uitgevoerd_door, gecontroleerde_persoon, afdeling, status, checklist_template_id, checklist_templates(naam)')
      .order('controle_datum', { ascending: false })

    if (error) {
      console.error('Error fetching controles:', error)
      return NextResponse.json({ error: 'Failed to fetch controles' }, { status: 500 })
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

    const enriched = (controles || []).map((row: any) => ({
      ...row,
      checklist_template_naam: row.checklist_templates?.naam || null,
      aantal_checklist_items: itemCountMap.get(row.id) || 0,
      aantal_fotos: fotoCountMap.get(row.id) || 0,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const productNaam = formData.get('product_naam')?.toString().trim()
    const orderNummer = formData.get('order_nummer')?.toString().trim() || null
    const uitgevoerdDoor = formData.get('uitgevoerd_door')?.toString().trim()
    const gecontroleerdePersoon = formData.get('gecontroleerde_persoon')?.toString().trim()
    const afdeling = formData.get('afdeling')?.toString().trim() || null
    const algemeneOpmerkingen = formData.get('algemene_opmerkingen')?.toString().trim() || null
    const status = formData.get('status')?.toString().trim() || 'in behandeling'
    const checklistTemplateId = formData.get('checklist_template_id')
    const checklistItemsRaw = formData.get('checklist_items')?.toString() || '[]'
    const fotos = formData.getAll('fotos') as File[]

    if (!productNaam || !uitgevoerdDoor || !gecontroleerdePersoon) {
      return NextResponse.json(
        { error: 'Productnaam, uitvoerder en gecontroleerde persoon zijn verplicht.' },
        { status: 400 }
      )
    }

    let parsedChecklistItems: any[] = []
    try {
      parsedChecklistItems = JSON.parse(checklistItemsRaw)
      if (!Array.isArray(parsedChecklistItems)) {
        throw new Error('checklist_items moet een array zijn')
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Ongeldig formaat voor checklist_items.' },
        { status: 400 }
      )
    }

    const { data: controleInsert, error: controleError } = await supabaseAdmin
      .from('product_controles')
      .insert({
        product_naam: productNaam,
        order_nummer: orderNummer,
        uitgevoerd_door: uitgevoerdDoor,
        gecontroleerde_persoon: gecontroleerdePersoon,
        afdeling,
        algemene_opmerkingen: algemeneOpmerkingen,
        status,
        checklist_template_id: checklistTemplateId ? Number(checklistTemplateId) : null,
      })
      .select('id')
      .single()

    if (controleError || !controleInsert) {
      console.error('Error inserting controle:', controleError)
      return NextResponse.json({ error: 'Failed to save controle' }, { status: 500 })
    }

    const controleId = controleInsert.id

    if (parsedChecklistItems.length > 0) {
      const checklistRows = parsedChecklistItems.map((item) => ({
        controle_id: controleId,
        template_item_id: item.template_item_id || null,
        item_beschrijving: item.item_beschrijving,
        antwoord_waarde: item.antwoord_waarde ?? null,
        opmerking_bij_antwoord: item.opmerking_bij_antwoord ?? null,
      }))

      const { error: checklistError } = await supabaseAdmin
        .from('controle_checklist_items')
        .insert(checklistRows)

      if (checklistError) {
        console.error('Error inserting checklist items:', checklistError)
        return NextResponse.json({ error: 'Failed to save checklist items' }, { status: 500 })
      }
    }

    if (fotos && fotos.length > 0) {
      for (const foto of fotos) {
        const arrayBuffer = await foto.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 15)
        const fileExt = foto.name.split('.').pop() || 'jpg'
        const filePath = `controle/${controleId}/${timestamp}_${randomStr}.${fileExt}`

        const { error: uploadError } = await supabaseAdmin.storage
          .from('controle-fotos')
          .upload(filePath, buffer, {
            contentType: foto.type,
            upsert: false,
          })

        if (uploadError) {
          console.error('Error uploading controle photo:', uploadError)
          continue
        }

        const { data: urlData } = supabaseAdmin.storage
          .from('controle-fotos')
          .getPublicUrl(filePath)

        await supabaseAdmin
          .from('controle_fotos')
          .insert({
            controle_id: controleId,
            bestandsnaam: filePath,
            image_url: urlData?.publicUrl || null,
          })
      }
    }

    return NextResponse.json({ success: true, controleId })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

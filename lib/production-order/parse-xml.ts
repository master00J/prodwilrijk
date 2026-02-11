/**
 * Parse production order XML (DataItem ProductionOrder + ProdOrderLine).
 * Used by admin production-order upload (time registration flow).
 */

function parseDecimal(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = String(value).replace(',', '.').trim()
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateMDY(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const parts = trimmed.split('/')
  if (parts.length !== 3) return null
  const [month, day, year] = parts.map((p) => p.trim())
  const monthNum = Number(month)
  const dayNum = Number(day)
  const yearNum = Number(year.length === 2 ? `20${year}` : year)
  if (!monthNum || !dayNum || !yearNum) return null
  return `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
}

function extractItemNumber(description: string): string | null {
  if (!description) return null
  const match = description.match(/\(([^)]+)\)\s*$/)
  return match?.[1]?.trim() ?? null
}

function parseColumns(dataItem: Element): Record<string, string> {
  const columns = Array.from(dataItem.querySelectorAll(':scope > Columns > Column'))
  const map: Record<string, string> = {}
  columns.forEach((column) => {
    const name = column.getAttribute('name') || ''
    map[name] = column.textContent || ''
  })
  return map
}

export interface ParsedProductionOrder {
  order: {
    order_number: string
    sales_order_number: string | null
    creation_date: string | null
    due_date: string | null
    starting_date: string | null
    source_file_name: string
  }
  lines: Array<{
    line_no: number
    item_no: string | null
    variant_code: string | null
    description: string | null
    description_2: string | null
    quantity: number
    inside_mass: string | null
    outside_mass: string | null
    item_number: string | null
    components: any[]
  }>
}

export async function parseProductionOrderXml(file: File): Promise<ParsedProductionOrder> {
  const xmlText = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(String(e.target?.result ?? ''))
    reader.onerror = reject
    reader.readAsText(file)
  })

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) throw new Error('Ongeldig XML bestand.')

  const orderItem = xmlDoc.querySelector('DataItem[name="ProductionOrder"]')
  if (!orderItem) throw new Error('Productieorder info niet gevonden in XML.')

  const orderColumns = parseColumns(orderItem)
  const orderNumber = orderColumns['No_']?.trim()
  if (!orderNumber) throw new Error('Ordernummer ontbreekt in XML.')

  const lines = Array.from(xmlDoc.querySelectorAll('DataItem[name="ProdOrderLine"]')).map((lineItem, index) => {
    const lineColumns = parseColumns(lineItem)
    const lineDescription = lineColumns['Line_Description']?.trim() || ''
    const extractedFromDescription = extractItemNumber(lineDescription)
    // Line_Item_No_ (bijv. GP009982) = itemnummer; koppelt aan Excel-kolom "No." en material_prices/verkoopprijzen
    const item_number =
      lineColumns['Line_Item_No_']?.trim() || extractedFromDescription || null

    const components = Array.from(lineItem.querySelectorAll(':scope > DataItems > DataItem[name="Component"]')).map(
      (componentItem) => {
        const componentColumns = parseColumns(componentItem)
        const fsgItem = componentItem.querySelector(':scope > DataItems > DataItem[name="ComponentFieldsForGroupingFSG"]')
        const fsgColumns = fsgItem ? parseColumns(fsgItem) : {}
        return {
          component_line_no: componentColumns['Component_Line_No_']?.trim() || null,
          component_item_no: componentColumns['Component_Item_No_']?.trim() || null,
          component_description: componentColumns['Component_Description']?.trim() || null,
          component_description_2: componentColumns['Component_Description_2']?.trim() || null,
          component_length: parseDecimal(componentColumns['Component_Length']),
          component_width: parseDecimal(componentColumns['Component_Width']),
          component_thickness: parseDecimal(componentColumns['Component_Thickness']),
          component_unit: parseDecimal(componentColumns['Component_Unit']),
          component_group: componentColumns['Component_Group']?.trim() || null,
          component_group_sortvalue: parseDecimal(componentColumns['Component_Group_SortValue']),
          component_indentation: componentColumns['Component_Indentation']?.trim() || null,
          component_margin: componentColumns['Component_Margin']?.trim() || null,
          fsg_group_code: componentColumns['FSGComponentGroupCode']?.trim() || null,
          fsg_group_description: componentColumns['FSGComponentGroupDescription']?.trim() || null,
          fsg_unit: parseDecimal(fsgColumns['FSGComponent_Unit']),
          fsg_unit_expected: parseDecimal(fsgColumns['FSGComponent_UnitExpected']),
          fsg_total_volume: parseDecimal(fsgColumns['FSGCompoment_TotalVolume']),
        }
      }
    )

    return {
      line_no: parseInt(lineColumns['Line_Line_No_'] || `${index + 1}`, 10) || index + 1,
      item_no: lineColumns['Line_Item_No_']?.trim() || null,
      variant_code: lineColumns['Line_Variant_Code']?.trim() || null,
      description: lineDescription || null,
      description_2: lineColumns['Line_Description_2']?.trim() || null,
      quantity: parseDecimal(lineColumns['Line_Quantity']) ?? 0,
      inside_mass: lineColumns['Line_InsideMass']?.trim() || null,
      outside_mass: lineColumns['Line_OutsideMass']?.trim() || null,
      item_number,
      components,
    }
  })

  return {
    order: {
      order_number: orderNumber,
      sales_order_number: orderColumns['SalesHeader_No']?.trim() || null,
      creation_date: parseDateMDY(orderColumns['Creation_Date']),
      due_date: parseDateMDY(orderColumns['Due_Date']),
      starting_date: parseDateMDY(orderColumns['Starting_Date']),
      source_file_name: file.name,
    },
    lines,
  }
}

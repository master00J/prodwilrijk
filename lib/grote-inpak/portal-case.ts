import { groteInpakFpMatchKey, type ProductionTimeActiveSummary } from '@/lib/grote-inpak/production-time-floor'

export const PORTAL_CASE_SELECT =
  'case_label, case_type, productielocatie, in_willebroek, arrival_date, deadline, dagen_te_laat, bc_line_description, bc_fp_item_no, bc_shop_order_no, pils_shop_order_key, serial_number'

export function buildPortalProgress(
  row: {
    productielocatie?: string | null
    in_willebroek?: boolean | null
  },
  prod: ProductionTimeActiveSummary | null,
): { headline: string; detail: string | null; production_step: string | null } {
  if (prod) {
    return {
      headline: 'In productie op de vloer',
      detail: `Huidige stap: ${prod.step}`,
      production_step: prod.step,
    }
  }
  if (row.in_willebroek) {
    return {
      headline: 'In ons magazijn (Willebroek)',
      detail: 'Uw order is klaar voor verdere verwerking of afhaling volgens afspraak.',
      production_step: null,
    }
  }
  const loc = String(row.productielocatie || '').trim()
  if (loc === 'Genk') {
    return {
      headline: 'In voorbereiding (Genk)',
      detail: 'Uw kist wordt klaargemaakt voor transport of productie.',
      production_step: null,
    }
  }
  if (loc === 'Wilrijk') {
    return {
      headline: 'In voorbereiding (Wilrijk)',
      detail: null,
      production_step: null,
    }
  }
  return {
    headline: 'Order geregistreerd',
    detail: null,
    production_step: null,
  }
}

export function mapCaseRowToPortalLine(
  row: Record<string, unknown>,
  floorByFp: Map<string, ProductionTimeActiveSummary>,
) {
  const fpKey = row.bc_fp_item_no ? groteInpakFpMatchKey(String(row.bc_fp_item_no)) : null
  const prod = fpKey ? floorByFp.get(fpKey) ?? null : null
  const progress = buildPortalProgress(
    {
      productielocatie: row.productielocatie as string | null | undefined,
      in_willebroek: row.in_willebroek as boolean | null | undefined,
    },
    prod,
  )
  return {
    case_label: String(row.case_label ?? ''),
    case_type: (row.case_type as string | null) ?? null,
    productielocatie: (row.productielocatie as string | null) ?? null,
    in_willebroek: Boolean(row.in_willebroek),
    arrival_indicative: (row.arrival_date as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    days_overdue: typeof row.dagen_te_laat === 'number' ? row.dagen_te_laat : 0,
    description: (row.bc_line_description as string | null) ?? null,
    fp_code: (row.bc_fp_item_no as string | null) ?? null,
    shop_reference: (row.bc_shop_order_no as string | null) ?? null,
    shop_key: (row.pils_shop_order_key as string | null) ?? null,
    serial_number: (row.serial_number as string | null) ?? null,
    progress,
  }
}

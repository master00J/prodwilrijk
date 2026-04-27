export const GROTE_INPAK_AUTO_STATUSES = [
  'Op stock',
  'In transfer',
  'In productie',
  'Nog te produceren',
] as const

export type GroteInpakAutoStatus = (typeof GROTE_INPAK_AUTO_STATUSES)[number]

type AutoStatusInput = {
  in_willebroek?: boolean | null
  stock_willebroek?: number | null
  stock_genk?: number | null
  stock_wilrijk?: number | null
  in_transfer_qty?: number | null
  in_productie_qty?: number | null
}

const positive = (value: number | null | undefined) => (Number(value) || 0) > 0

export function calculateGroteInpakAutoStatus(item: AutoStatusInput): GroteInpakAutoStatus {
  if (
    item.in_willebroek === true ||
    positive(item.stock_willebroek) ||
    positive(item.stock_genk) ||
    positive(item.stock_wilrijk)
  ) {
    return 'Op stock'
  }

  if (positive(item.in_transfer_qty)) {
    return 'In transfer'
  }

  if (positive(item.in_productie_qty)) {
    return 'In productie'
  }

  return 'Nog te produceren'
}

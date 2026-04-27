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

export type GroteInpakStatusAllocationPool = {
  stock_willebroek: number
  stock_genk: number
  stock_wilrijk: number
  in_transfer_qty: number
  in_productie_qty: number
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

export function explainGroteInpakAutoStatus(item: AutoStatusInput): string {
  const stockParts: string[] = []
  if (item.in_willebroek === true || positive(item.stock_willebroek)) {
    stockParts.push(`Willebroek ${Number(item.stock_willebroek) || 0}`)
  }
  if (positive(item.stock_genk)) stockParts.push(`Genk ${Number(item.stock_genk)}`)
  if (positive(item.stock_wilrijk)) stockParts.push(`Wilrijk ${Number(item.stock_wilrijk)}`)

  if (stockParts.length > 0) {
    return `Op stock: ${stockParts.join(', ')}`
  }

  if (positive(item.in_transfer_qty)) {
    return `Onderweg vanuit transferorders: ${Number(item.in_transfer_qty)} stuk(s)`
  }

  if (positive(item.in_productie_qty)) {
    return `Open productiehoeveelheid: ${Number(item.in_productie_qty)} stuk(s)`
  }

  return 'Geen stock, transfer of open productie gevonden'
}

export function allocateGroteInpakAutoStatus(pool: GroteInpakStatusAllocationPool): {
  status: GroteInpakAutoStatus
  reason: string
} {
  if (pool.stock_willebroek > 0) {
    pool.stock_willebroek -= 1
    return {
      status: 'Op stock',
      reason: `Toegewezen uit stock Willebroek (${pool.stock_willebroek} resterend na deze case)`,
    }
  }

  if (pool.stock_genk > 0) {
    pool.stock_genk -= 1
    return {
      status: 'Op stock',
      reason: `Toegewezen uit stock Genk (${pool.stock_genk} resterend na deze case)`,
    }
  }

  if (pool.stock_wilrijk > 0) {
    pool.stock_wilrijk -= 1
    return {
      status: 'Op stock',
      reason: `Toegewezen uit stock Wilrijk (${pool.stock_wilrijk} resterend na deze case)`,
    }
  }

  if (pool.in_transfer_qty > 0) {
    pool.in_transfer_qty -= 1
    return {
      status: 'In transfer',
      reason: `Toegewezen uit transferorders (${pool.in_transfer_qty} resterend na deze case)`,
    }
  }

  if (pool.in_productie_qty > 0) {
    pool.in_productie_qty -= 1
    return {
      status: 'In productie',
      reason: `Toegewezen uit open productie (${pool.in_productie_qty} resterend na deze case)`,
    }
  }

  return {
    status: 'Nog te produceren',
    reason: 'Geen resterende stock, transfer of productie voor dit kisttype',
  }
}

export interface ItemToPack {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  priority: boolean
  measurement: boolean
  packed: boolean
  image?: string | null
  created_at?: string
  updated_at?: string
}

export interface PackedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  date_packed: string
  original_id: number
  created_at?: string
}

export interface DailyReport {
  date: string
  totalQuantity: number
  backlogQuantity: number
  priorityQuantity: number
  packedQuantity: number
  backlogByAge?: Array<{
    daysOld: number
    count: number
    percentage: number
  }>
  recommendations?: string[]
}


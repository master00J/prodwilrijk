export interface ItemToPack {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  priority: boolean
  measurement: boolean
  packed: boolean
  problem: boolean
  problem_comment?: string | null
  image?: string | null
  images?: string[] // Multiple images
  wms_line_id?: string | null // Unique identifier from WMS for status 30 lines
  wms_import_date?: string | null // Date when imported from WMS
  created_at?: string
  updated_at?: string
}

// Grote Inpak Types
export interface GroteInpakCase {
  id: number
  case_label: string
  case_type?: string | null
  arrival_date?: string | null
  item_number?: string | null
  productielocatie?: string | null
  in_willebroek: boolean
  stock_location?: string | null
  locatie?: string | null
  status?: string | null
  priority: boolean
  comment?: string | null
  erp_code?: string | null
  stapel?: number | null
  term_werkdagen?: number | null
  deadline?: string | null
  dagen_te_laat: number
  dagen_in_willebroek: number
  created_at: string
  updated_at: string
}

export interface GroteInpakTransport {
  id: number
  case_label: string
  transport_needed: boolean
  transport_date?: string | null
  transport_status?: string | null
  created_at: string
  updated_at: string
}

export interface GroteInpakStock {
  id: number
  item_number: string
  kistnummer?: string | null
  location?: string | null
  quantity?: number | null
  stock?: number | null
  inkoop?: number | null
  productie?: number | null
  in_transfer?: number | null
  erp_code?: string | null
  created_at: string
  updated_at: string
}

export interface GroteInpakForecast {
  id: number
  item_number?: string | null
  case_label?: string | null
  case_type?: string | null
  arrival_date?: string | null
  source_file?: string | null
  created_at: string
  updated_at: string
}

export interface GroteInpakPacked {
  id: number
  case_label: string
  packed_date: string
  packed_file?: string | null
  created_at: string
}

export interface GroteInpakFileUpload {
  id: number
  file_type: 'pils' | 'erp' | 'stock' | 'forecast' | 'packed'
  file_name: string
  file_size?: number | null
  uploaded_by?: string | null
  uploaded_at: string
  processed_at?: string | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  error_message?: string | null
}

export interface IncomingGood {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  created_at?: string
}

export interface ConfirmedIncomingGood {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  date_confirmed: string
  original_id?: number
  created_at?: string
}

export interface WmsProject {
  id: number
  project_no: string
  machine_type?: string | null
  modality?: string | null
  production_location?: string | null
  packing_company?: string | null
  packing_company_reference?: string | null
  transport_week_contract?: string | null
  vmi_ref_no?: string | null
  vmi_employee?: string | null
  date?: string | null
  measuring_location?: string | null
  measuring_date_requested?: string | null
  measuring_contact_person?: string | null
  measuring_team?: string | null
  measuring_hall?: string | null
  source_file_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface WmsProjectLine {
  id: number
  project_id: number
  line_type: string
  source_sheet?: string | null
  sort_order?: number | null
  truck_or_container?: string | null
  outer_pack_no?: string | null
  packing_no?: string | null
  label_item_no?: string | null
  article_no?: string | null
  description?: string | null
  qty?: number | null
  part_of?: string | null
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  length_cm?: number | null
  width_cm?: number | null
  height_cm?: number | null
  weight_netto_kg?: number | null
  weight_gross_kg?: number | null
  weight_measured_kg?: number | null
  label_qty?: number | null
  received_at?: string | null
  shipped_at?: string | null
  status: string
  status_updated_at?: string | null
  notes?: string | null
  storage_m2?: number | null
  storage_location?: string | null
  dimensions_confirmed?: boolean | null
  package_id?: number | null
  created_at?: string
  updated_at?: string
  images?: string[]
}

export interface WmsPackage {
  id: number
  project_id: number
  package_no: string
  received_at?: string | null
  load_in_at?: string | null
  load_out_at?: string | null
  storage_location?: string | null
  storage_m2?: number | null
  created_at?: string
  updated_at?: string
  images?: string[]
}

export interface WmsPackageLine {
  id: number
  package_id: number
  line_id: number
  created_at?: string
}

export interface WmsStorageLocation {
  id: number
  name: string
  capacity_m2?: number | null
  notes?: string | null
  active?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface StorageRentalCustomer {
  id: number
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  active?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface StorageRentalLocation {
  id: number
  name: string
  capacity_m2?: number | null
  notes?: string | null
  active?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface StorageRentalItem {
  id: number
  customer_id?: number | null
  location_id?: number | null
  description?: string | null
  m2?: number | null
  m2_bare?: number | null
  m2_verpakt?: number | null
  price_per_m2?: number | null
  start_date?: string | null
  end_date?: string | null
  active?: boolean | null
  notes?: string | null
  or_number?: string | null
  customer_description?: string | null
  foresco_id?: string | null
  packing_status?: 'bare' | 'verpakt' | null
  photos_bare?: string[]
  photos_verpakt?: string[]
  created_at?: string
  updated_at?: string
  customer?: { id: number; name: string } | null
  location?: { id: number; name: string } | null
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

export interface Employee {
  id: number
  name: string
  active?: boolean
  created_at?: string
  updated_at?: string
}

export interface TimeLog {
  id: number
  employee_id: number
  type: string
  start_time: string
  end_time?: string | null
  is_paused?: boolean
  created_at?: string
  updated_at?: string
}

export interface IncomingGoodAirtec {
  id: number
  beschrijving?: string | null
  item_number?: string | null
  lot_number?: string | null
  datum_opgestuurd?: string | null
  kistnummer?: string | null
  divisie?: string | null
  quantity: number
  datum_ontvangen: string
  created_at?: string
}

export interface ItemToPackAirtec {
  id: number
  beschrijving?: string | null
  item_number?: string | null
  lot_number?: string | null
  datum_opgestuurd?: string | null
  kistnummer?: string | null
  divisie?: string | null
  quantity: number
  priority: boolean
  packed: boolean
  datum_ontvangen: string
  created_at?: string
  updated_at?: string
}

export interface PackedItemAirtec {
  id: number
  beschrijving?: string | null
  item_number?: string | null
  lot_number?: string | null
  datum_opgestuurd?: string | null
  kistnummer?: string | null
  divisie?: string | null
  quantity: number
  datum_ontvangen: string
  date_packed: string
  original_id?: number | null
  created_at?: string
}

export interface ReturnedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  date_returned: string
  reason?: string | null
  original_id?: number | null
  images?: string[]
  created_at?: string
}

// Wood Inventory Types
export interface WoodOrder {
  id: number
  houtsoort: string
  min_lengte: number
  dikte: number
  breedte: number
  aantal_pakken: number
  planken_per_pak: number
  opmerkingen?: string | null
  priority: boolean
  besteld_op: string
  ontvangen_pakken: number
  open_pakken: number
  bc_code?: string | null
  locatie?: string | null
  gearchiveerd: boolean
  created_at: string
  updated_at: string
}

export interface WoodPackage {
  id: number
  order_id?: number | null
  pakketnummer: string
  houtsoort: string
  exacte_dikte: number
  exacte_breedte: number
  exacte_lengte: number
  planken_per_pak: number
  opmerking?: string | null
  aangemeld_op: string
  ontvangen: boolean
  locatie?: string | null
  ontvangen_op?: string | null
  created_at: string
  updated_at: string
}

export interface WoodStock {
  id: number
  package_id?: number | null
  houtsoort: string
  pakketnummer?: string | null
  dikte: number
  breedte: number
  lengte: number
  locatie: string
  aantal: number
  ontvangen_op: string
  created_at: string
  updated_at: string
}

export interface WoodConsumption {
  id: number
  stock_id?: number | null
  houtsoort: string
  lengte: number
  breedte: number
  dikte: number
  aantal: number
  datum_verbruik: string
  opmerking?: string | null
  created_at: string
}

export interface WoodTargetStock {
  id: number
  houtsoort: string
  dikte: number
  breedte: number
  target_packs: number
  desired_length?: number | null
  created_at: string
  updated_at: string
}

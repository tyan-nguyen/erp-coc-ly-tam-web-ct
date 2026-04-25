import { createClient } from '@/lib/supabase/server'
import {
  filterRowsByQuery,
  pickKeyField,
  type RowData,
} from '@/lib/master-data/crud-utils'

export const ADDRESS_NOTE_PREFIX = '[VI_TRI_CONG_TRINH]:'
export const AREA_NOTE_PREFIX = '[KHU_VUC]:'
export const AREA_DATALIST_ID = 'dm-duan-area-options'

export const AREA_OPTIONS = [
  'Trà Vinh',
  'Vĩnh Long',
  'Cần Thơ',
  'Bến Tre',
  'Sóc Trăng',
  'Đồng Tháp',
  'Hậu Giang',
  'Tiền Giang',
  'An Giang',
  'Kiên Giang',
  'Bạc Liêu',
  'Cà Mau',
  'TP. Hồ Chí Minh',
  'Long An',
  'Đồng Nai',
  'Bình Dương',
  'Bình Phước',
  'Tây Ninh',
  'Bà Rịa - Vũng Tàu',
  'Đà Nẵng',
  'Quảng Nam',
  'Quảng Ngãi',
  'Bình Định',
  'Phú Yên',
  'Khánh Hòa',
  'Ninh Thuận',
  'Bình Thuận',
  'Quảng Trị',
  'Thừa Thiên Huế',
  'Quảng Bình',
  'Hà Tĩnh',
  'Nghệ An',
  'Thanh Hóa',
  'Lâm Đồng',
  'Đắk Lắk',
  'Đắk Nông',
  'Gia Lai',
  'Kon Tum',
  'Hà Nội',
  'Hải Phòng',
  'Quảng Ninh',
  'Bắc Ninh',
  'Bắc Giang',
  'Hải Dương',
  'Hưng Yên',
  'Vĩnh Phúc',
  'Phú Thọ',
  'Thái Nguyên',
  'Bắc Kạn',
  'Tuyên Quang',
  'Hà Giang',
  'Lào Cai',
  'Yên Bái',
  'Sơn La',
  'Điện Biên',
  'Lai Châu',
  'Hòa Bình',
  'Ninh Bình',
  'Nam Định',
  'Hà Nam',
  'Thái Bình',
  'Cao Bằng',
  'Lạng Sơn',
] as const

export type DmDuanCustomerOption = {
  kh_id: string
  ma_kh: string
  ten_kh: string
}

export type DmDuanStorageConfig = {
  addressField: string
  noteField: string
  addressStorageMode: 'column' | 'note' | 'none'
  areaField: string
  areaStorageMode: 'column' | 'note' | 'none'
}

export type DmDuanPageData = {
  rows: RowData[]
  customers: DmDuanCustomerOption[]
  customerMap: Map<string, DmDuanCustomerOption>
  keyField: string | null
  error: unknown
  storage: DmDuanStorageConfig
  filteredRows: RowData[]
  pagedRows: RowData[]
  totalPages: number
  safePage: number
  editRow: RowData | null
}

export async function loadDmDuanPageData(input: {
  q: string
  showInactive: boolean
  editKey: string
  currentPage: number
  pageSize: number
}) {
  const supabase = await createClient()
  const [{ data: projectRows, error }, { data: customerRows }] = await Promise.all([
    supabase.from('dm_duan').select('*').limit(200),
    supabase.from('dm_kh').select('*').eq('is_active', true).limit(200),
  ])

  const rows: RowData[] = ((projectRows ?? []) as RowData[]).map((row) => ({
    ...row,
    search_text: [
      row.ma_da,
      row.ma_duan,
      row.ten_da,
      row.kh_id,
      row.vi_tri_cong_trinh,
      row.dia_chi_cong_trinh,
      row.dia_diem,
      row.khu_vuc,
      row.ghi_chu,
    ]
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .join(' '),
  }))
  const customers = ((customerRows ?? []) as RowData[]).map((row) => ({
    kh_id: String(row.kh_id ?? ''),
    ma_kh: String(row.ma_kh ?? ''),
    ten_kh: String(row.ten_kh ?? row.ma_kh ?? row.kh_id ?? ''),
  }))
  const customerMap = new Map(customers.map((item) => [item.kh_id, item]))
  const keyField = pickKeyField('dm_duan', rows)
  const storage = resolveDuanStorageConfig(rows)

  const sortedRows = [...rows].sort(compareDmDuanRowsDesc)
  const filteredByActive = input.showInactive
    ? sortedRows
    : sortedRows.filter((row) => row.is_active !== false)
  const filteredRows = filterRowsByQuery(
    filteredByActive.map((row) => ({
      ...row,
      khach_hang_hien_thi: customerMap.get(String(row.kh_id ?? ''))?.ten_kh ?? row.kh_id,
      search_text: [
        row.search_text,
        customerMap.get(String(row.kh_id ?? ''))?.ma_kh,
        customerMap.get(String(row.kh_id ?? ''))?.ten_kh,
      ]
        .filter((value) => value !== null && value !== undefined && String(value).trim())
        .join(' '),
    })),
    input.q
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / input.pageSize))
  const safePage = Math.min(input.currentPage, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * input.pageSize, safePage * input.pageSize)
  const editRow =
    input.editKey && keyField
      ? rows.find((row) => String(row[keyField]) === input.editKey) ?? null
      : null

  return {
    rows,
    customers,
    customerMap,
    keyField,
    error,
    storage,
    filteredRows,
    pagedRows,
    totalPages,
    safePage,
    editRow,
  } satisfies DmDuanPageData
}

export function resolveDuanStorageConfig(rows: RowData[]): DmDuanStorageConfig {
  const columns = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key)
    }
  }

  const addressField = pickFirst(columns, ['vi_tri_cong_trinh', 'dia_chi_cong_trinh', 'dia_diem'])
  const noteField = pickFirst(columns, ['ghi_chu'])
  const hasAddressColumn = columns.has(addressField)
  const addressStorageMode = hasAddressColumn ? 'column' : noteField ? 'note' : 'none'
  const areaField = 'khu_vuc'
  const hasAreaColumn = columns.has(areaField)
  const areaStorageMode = hasAreaColumn ? 'column' : noteField ? 'note' : 'none'

  return {
    addressField,
    noteField,
    addressStorageMode,
    areaField,
    areaStorageMode,
  }
}

export function pickFirst(columns: Set<string>, candidates: string[]) {
  return candidates.find((field) => columns.has(field)) ?? candidates[0] ?? ''
}

export function readOptional(row: RowData, fieldName: string) {
  if (!fieldName) return null
  return row[fieldName]
}

export function extractAreaFromNote(note: string) {
  const areaLine = note
    .split('\n')
    .find((line) => line.trim().startsWith(AREA_NOTE_PREFIX))
  return areaLine ? areaLine.replace(AREA_NOTE_PREFIX, '').trim() : ''
}

export function extractAddressFromNote(note: string) {
  const addressLine = note
    .split('\n')
    .find((line) => line.trim().startsWith(ADDRESS_NOTE_PREFIX))
  return addressLine ? addressLine.replace(ADDRESS_NOTE_PREFIX, '').trim() : ''
}

export function stripAreaFromNote(note: string) {
  return note
    .split('\n')
    .filter(
      (line) =>
        !line.trim().startsWith(AREA_NOTE_PREFIX) &&
        !line.trim().startsWith(ADDRESS_NOTE_PREFIX)
    )
    .join('\n')
    .trim()
}

export function readAddressValue(row: RowData, addressField: string, noteField: string) {
  const directValue = String(readOptional(row, addressField) ?? '').trim()
  if (directValue) return directValue
  const noteValue = String(readOptional(row, noteField) ?? '').trim()
  return extractAddressFromNote(noteValue) || null
}

export function readAreaValue(row: RowData, areaField: string, noteField: string) {
  const directValue = String(readOptional(row, areaField) ?? '').trim()
  if (directValue) return directValue
  const noteValue = String(readOptional(row, noteField) ?? '').trim()
  return extractAreaFromNote(noteValue) || null
}

export function readNoteValue(row: RowData, noteField: string) {
  const noteValue = String(readOptional(row, noteField) ?? '').trim()
  return stripAreaFromNote(noteValue) || null
}

export function compareDmDuanRowsDesc(a: RowData, b: RowData) {
  const aTime = readRowTime(a)
  const bTime = readRowTime(b)
  if (aTime !== bTime) return bTime - aTime
  return String(b.ma_da ?? '').localeCompare(String(a.ma_da ?? ''))
}

export function readRowTime(row: RowData) {
  const raw = row.created_at ?? row.updated_at ?? null
  if (!raw) return 0
  const time = new Date(String(raw)).getTime()
  return Number.isNaN(time) ? 0 : time
}

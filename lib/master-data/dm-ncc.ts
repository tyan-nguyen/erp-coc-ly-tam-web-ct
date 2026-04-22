import { createClient } from '@/lib/supabase/server'
import {
  filterRowsByQuery,
  pickKeyField,
  type RowData,
} from '@/lib/master-data/crud-utils'

export const DM_NCC_FIELD_LABELS: Record<string, string> = {
  ma_ncc: 'Mã nhà cung cấp',
  ten_ncc: 'Tên nhà cung cấp',
  loai_ncc: 'Loại nhà cung cấp',
  nguoi_lien_he: 'Người liên hệ',
  sdt: 'SĐT',
  so_dien_thoai: 'SĐT',
  dien_thoai: 'SĐT',
  email: 'Email',
  dia_chi: 'Địa chỉ',
  ghi_chu: 'Ghi chú',
}

export const DM_NCC_OPTIONAL_FIELDS = [
  'nguoi_lien_he',
  'sdt',
  'so_dien_thoai',
  'dien_thoai',
  'email',
  'dia_chi',
  'ghi_chu',
] as const

export const LOAI_NCC_OPTIONS = [
  { value: 'PHU_KIEN', label: 'Phụ kiện' },
  { value: 'NVL', label: 'NVL' },
  { value: 'TAI_SAN', label: 'Tài sản' },
  { value: 'CCDC', label: 'Công cụ dụng cụ' },
  { value: 'VAN_CHUYEN', label: 'Vận chuyển' },
] as const

export type DmNccPageData = {
  rows: RowData[]
  error: unknown
  keyField: string | null
  columns: Set<string>
  phoneField: string
  emailField: string
  contactNameField: string
  addressField: string
  noteField: string
  filteredRows: RowData[]
  pagedRows: RowData[]
  totalPages: number
  safePage: number
  editRow: RowData | null
}

export function getDmNccAvailableFields(rows: RowData[]) {
  const columns = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key)
    }
  }

  return {
    columns,
    optionalFields: DM_NCC_OPTIONAL_FIELDS.filter((field) => columns.has(field)),
  }
}

export function formatLoaiNcc(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase()
  const matched = LOAI_NCC_OPTIONS.find((option) => option.value === normalized)
  if (matched) {
    return matched.label
  }

  return value == null ? '-' : String(value)
}

export function getPreferredPhoneField(columns: Set<string>) {
  const candidates = ['sdt', 'so_dien_thoai', 'dien_thoai']
  return candidates.find((field) => columns.has(field)) ?? ''
}

export async function loadDmNccPageData(input: {
  q: string
  showInactive: boolean
  editKey: string
  currentPage: number
  pageSize: number
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('dm_ncc').select('*').limit(200)
  const rows: RowData[] = ((data ?? []) as RowData[]).map((row) => ({
    ...row,
    search_text: [
      row.ma_ncc,
      row.ten_ncc,
      row.loai_ncc,
      row.nguoi_lien_he,
      row.sdt,
      row.so_dien_thoai,
      row.dien_thoai,
      row.email,
      row.dia_chi,
      row.ghi_chu,
    ]
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .join(' '),
  }))
  const keyField = pickKeyField('dm_ncc', rows)
  const { columns } = getDmNccAvailableFields(rows)
  const phoneField = getPreferredPhoneField(columns)
  const emailField = columns.has('email') ? 'email' : ''
  const contactNameField = columns.has('nguoi_lien_he') ? 'nguoi_lien_he' : ''
  const addressField = columns.has('dia_chi') ? 'dia_chi' : ''
  const noteField = columns.has('ghi_chu') ? 'ghi_chu' : ''

  const sortedRows = [...rows].sort(compareDmNccRowsDesc)
  const filteredByActive = input.showInactive
    ? sortedRows
    : sortedRows.filter((row) => row.is_active !== false)
  const filteredRows = filterRowsByQuery(filteredByActive, input.q)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / input.pageSize))
  const safePage = Math.min(input.currentPage, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * input.pageSize, safePage * input.pageSize)
  const editRow =
    input.editKey && keyField
      ? rows.find((row) => String(row[keyField]) === input.editKey) ?? null
      : null

  return {
    rows,
    error,
    keyField,
    columns,
    phoneField,
    emailField,
    contactNameField,
    addressField,
    noteField,
    filteredRows,
    pagedRows,
    totalPages,
    safePage,
    editRow,
  } satisfies DmNccPageData
}

export function compareDmNccRowsDesc(a: RowData, b: RowData) {
  const aTime = readDmNccRowTime(a)
  const bTime = readDmNccRowTime(b)
  if (aTime !== bTime) return bTime - aTime
  return String(b.ma_ncc ?? '').localeCompare(String(a.ma_ncc ?? ''))
}

export function readDmNccRowTime(row: RowData) {
  const raw = row.created_at ?? row.updated_at ?? null
  if (!raw) return 0
  const time = new Date(String(raw)).getTime()
  return Number.isNaN(time) ? 0 : time
}

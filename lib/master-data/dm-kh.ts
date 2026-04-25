import { createClient } from '@/lib/supabase/server'
import {
  filterRowsByQuery,
  pickKeyField,
  shouldHideColumn,
  type RowData,
} from '@/lib/master-data/crud-utils'

export const DM_KH_CONTACT_FIELDS = [
  'sdt',
  'so_dien_thoai',
  'dien_thoai',
  'lien_he',
  'nguoi_lien_he',
  'email',
] as const

export const DM_KH_FORM_FIELDS = ['ten_kh', 'mst', 'dia_chi', 'nhom_kh', 'email', 'ghi_chu'] as const

export const DM_KH_VISIBLE_FIELDS = [
  'ma_kh',
  'ten_kh',
  'sdt',
  'so_dien_thoai',
  'dien_thoai',
  'lien_he',
  'email',
  'mst',
  'dia_chi',
  'nhom_kh',
  'ghi_chu',
] as const

export const DM_KH_FIELD_LABELS: Record<string, string> = {
  ma_kh: 'Mã khách hàng',
  ten_kh: 'Thông tin khách hàng',
  sdt: 'SĐT',
  so_dien_thoai: 'SĐT',
  dien_thoai: 'SĐT',
  lien_he: 'Liên hệ',
  nguoi_lien_he: 'Liên hệ',
  email: 'Email',
  mst: 'MST',
  dia_chi: 'Địa chỉ',
  nhom_kh: 'Nhóm khách hàng',
  ghi_chu: 'Ghi chú',
}

export type DmKhPageData = {
  rows: RowData[]
  error: unknown
  keyField: string | null
  visibleFields: string[]
  formFields: string[]
  sortedRows: RowData[]
  filteredByActive: RowData[]
  filteredRows: RowData[]
  pagedRows: RowData[]
  columns: string[]
  totalPages: number
  safePage: number
  editRow: RowData | null
  duplicateMatches: RowData[]
}

export function getDmKhAvailableFields(rows: RowData[]) {
  const columns = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key)
    }
  }

  return {
    columns: Array.from(columns),
    contactFields: DM_KH_CONTACT_FIELDS.filter((field) => columns.has(field)),
    visibleFields: DM_KH_VISIBLE_FIELDS.filter((field) => columns.has(field)),
    formFields: DM_KH_FORM_FIELDS.filter((field) => columns.has(field)),
  }
}

export async function loadDmKhPageData(input: {
  q: string
  showInactive: boolean
  editKey: string
  contact: string
  currentPage: number
  pageSize: number
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('dm_kh').select('*').limit(200)
  const rows: RowData[] = ((data ?? []) as RowData[]).map((row) => ({
    ...row,
    search_text: [
      row.ma_kh,
      row.ten_kh,
      row.sdt,
      row.so_dien_thoai,
      row.dien_thoai,
      row.lien_he,
      row.nguoi_lien_he,
      row.email,
      row.mst,
      row.dia_chi,
      row.nhom_kh,
      row.ghi_chu,
    ]
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .join(' '),
  }))
  const keyField = pickKeyField('dm_kh', rows)
  const { visibleFields, formFields } = getDmKhAvailableFields(rows)

  const sortedRows = [...rows].sort(compareDmKhRowsDesc)
  const filteredByActive = input.showInactive
    ? sortedRows
    : sortedRows.filter((row) => row.is_active !== false)
  const filteredRows = filterRowsByQuery(filteredByActive, input.q)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / input.pageSize))
  const safePage = Math.min(input.currentPage, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * input.pageSize, safePage * input.pageSize)
  const columns = visibleFields.filter((column) => !shouldHideColumn(column) && column !== keyField)
  const editRow =
    input.editKey && keyField
      ? sortedRows.find((row) => String(row[keyField]) === input.editKey) ?? null
      : null
  const duplicateMatches = input.contact
    ? filteredByActive.filter((row) => rowMatchesContact(row, input.contact))
    : []

  return {
    rows,
    error,
    keyField,
    visibleFields,
    formFields,
    sortedRows,
    filteredByActive,
    filteredRows,
    pagedRows,
    columns,
    totalPages,
    safePage,
    editRow,
    duplicateMatches,
  } satisfies DmKhPageData
}

export function normalizeContactValue(value: string) {
  return value.trim().toLowerCase()
}

export function rowMatchesContact(row: RowData, contact: string) {
  const normalizedContact = normalizeContactValue(contact)
  if (!normalizedContact) {
    return false
  }

  return DM_KH_CONTACT_FIELDS.some((field) => {
    const raw = row[field]
    if (raw === null || raw === undefined) {
      return false
    }
    return String(raw).trim().toLowerCase().includes(normalizedContact)
  })
}

export function pickContactField(
  contact: string,
  availableContactFields: string[]
) {
  const normalized = normalizeContactValue(contact)
  const prefersEmail = normalized.includes('@')

  if (prefersEmail) {
    return availableContactFields.find((field) => field === 'email') ?? null
  }

  return (
    availableContactFields.find((field) => field !== 'email') ??
    availableContactFields[0] ??
    null
  )
}

export function getPreferredContactValue(row: RowData) {
  for (const field of DM_KH_CONTACT_FIELDS) {
    const value = row[field]
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value)
    }
  }
  return ''
}

export function compareDmKhRowsDesc(a: RowData, b: RowData) {
  const aTime = readRowTime(a)
  const bTime = readRowTime(b)

  if (aTime !== bTime) {
    return bTime - aTime
  }

  const aCode = String(a.ma_kh ?? '')
  const bCode = String(b.ma_kh ?? '')
  return bCode.localeCompare(aCode)
}

export function readRowTime(row: RowData) {
  const raw = row.created_at ?? row.updated_at ?? null
  if (!raw) return 0
  const time = new Date(String(raw)).getTime()
  return Number.isNaN(time) ? 0 : time
}

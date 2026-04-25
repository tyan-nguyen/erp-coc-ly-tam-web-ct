export type RowData = Record<string, unknown>

const DEFAULT_HIDDEN_COLUMNS = new Set([
  'deleted_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'is_active',
])

const COLUMN_LABELS: Record<string, string> = {
  ma_kh: 'Mã khách hàng',
  ten_kh: 'Thông tin khách hàng',
  nhom_kh: 'Nhóm khách hàng',
  mst: 'MST',
  dia_chi: 'Địa chỉ',
  ghi_chu: 'Ghi chú',
  ma_da: 'Mã dự án',
  ten_da: 'Tên dự án',
  ten_ncc: 'Tên nhà cung cấp',
  loai_ncc: 'Loại nhà cung cấp',
  location_code: 'Mã khu vực',
  location_name: 'Tên khu vực',
  location_type: 'Loại khu vực',
  parent_location_id: 'Khu vực cha',
  ten_hang: 'Tên hàng',
  nhom_hang: 'Nhóm hàng',
  hao_hut_pct: '% hao hụt',
  don_gia: 'Đơn giá',
  loai_coc: 'Loại cọc',
  mac_be_tong: 'Mác bê tông',
  do_ngoai: 'Đường kính ngoài',
  chieu_day: 'Chiều dày',
  dinh_muc: 'Định mức',
  dinh_muc_m3: 'Định mức/m3',
  dvt: 'Đơn vị tính',
}

const TABLE_KEY_CANDIDATES: Record<string, string[]> = {
  dm_kh: ['kh_id', 'ma_kh', 'id'],
  dm_duan: ['da_id', 'duan_id', 'ma_da', 'ma_duan', 'id'],
  dm_ncc: ['ncc_id', 'ma_ncc', 'id'],
  warehouse_location: ['location_id', 'location_code', 'id'],
  nvl: ['nvl_id', 'ma_nvl', 'id'],
  gia_nvl: ['gia_nvl_id', 'id'],
  dm_coc_template: ['template_id', 'ma_coc_template', 'id'],
  dm_dinh_muc_phu_md: ['dm_id', 'id', 'nvl_id'],
  dm_capphoi_bt: ['cp_id', 'id', 'nvl_id'],
  boc_tach_nvl: ['boc_tach_nvl_id', 'id'],
  boc_tach_nvl_items: ['boc_tach_nvl_item_id', 'id'],
  boc_tach_seg_nvl: ['boc_tach_seg_nvl_id', 'id'],
}

export function pickKeyField(table: string, rows: RowData[]): string | null {
  const columns = rows[0] ? Object.keys(rows[0]) : []
  if (columns.length === 0) {
    return TABLE_KEY_CANDIDATES[table]?.[0] ?? null
  }

  const candidates = [
    ...(TABLE_KEY_CANDIDATES[table] ?? []),
    'id',
    ...columns.filter((col) => col.endsWith('_id')),
    ...columns.filter((col) => col.startsWith('ma_')),
  ]

  for (const candidate of candidates) {
    if (columns.includes(candidate)) {
      return candidate
    }
  }

  return null
}

export function hasSoftDeleteColumns(rows: RowData[]): boolean {
  const columns = rows[0] ? Object.keys(rows[0]) : []
  return columns.includes('is_active') && columns.includes('deleted_at')
}

export function filterRowsByQuery(rows: RowData[], query: string): RowData[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return rows
  }

  return rows.filter((row) => {
    const precomputed = row.search_text
    if (typeof precomputed === 'string' && precomputed.trim()) {
      return precomputed.toLowerCase().includes(normalized)
    }

    return Object.values(row).some((value) => {
      if (value === null || value === undefined) {
        return false
      }
      return String(value).toLowerCase().includes(normalized)
    })
  })
}

export function parsePayload(input: string): RowData {
  const parsed = JSON.parse(input) as unknown
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Payload phai la JSON object.')
  }
  return parsed as RowData
}

export function safeStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function displayCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export function shouldHideColumn(column: string): boolean {
  return DEFAULT_HIDDEN_COLUMNS.has(column)
}

export function formatColumnLabel(column: string): string {
  const explicit = COLUMN_LABELS[column]
  if (explicit) {
    return explicit
  }

  const normalized = column
    .replace(/_/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalized) {
    return column
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = params[key]
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

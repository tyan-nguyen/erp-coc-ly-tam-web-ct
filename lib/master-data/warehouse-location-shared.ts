export const WAREHOUSE_LOCATION_TYPE_OPTIONS = [
  { value: 'STORAGE', label: 'Kho thành phẩm / lưu trữ' },
  { value: 'STAGING', label: 'Khu chờ / trung chuyển' },
  { value: 'DEFECT', label: 'Khu lỗi / xử lý' },
] as const

export const RESERVED_WAREHOUSE_LOCATION_CODES = ['KHO_THANH_PHAM', 'KHU_LOI', 'CHO_QC'] as const

export function normalizeWarehouseLocationCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

export function isReservedWarehouseLocationCode(value: unknown) {
  const normalized = normalizeWarehouseLocationCode(String(value ?? ''))
  return RESERVED_WAREHOUSE_LOCATION_CODES.includes(
    normalized as (typeof RESERVED_WAREHOUSE_LOCATION_CODES)[number]
  )
}

export function formatWarehouseLocationType(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase()
  return (
    WAREHOUSE_LOCATION_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? String(value ?? '-')
  )
}

export function formatWarehouseLocationGroup(row: { location_code?: unknown; is_reserved?: unknown }) {
  if (Boolean(row.is_reserved) || isReservedWarehouseLocationCode(row.location_code)) {
    return 'Mặc định hệ thống'
  }
  return 'Bãi người dùng'
}

export function buildWarehouseLocationLabel(input: { location_code?: unknown; location_name?: unknown }) {
  const code = String(input.location_code ?? '').trim()
  const name = String(input.location_name ?? '').trim()
  if (!code && !name) return '-'
  if (!code) return name
  if (!name || name === code) return code
  return `${code} · ${name}`
}

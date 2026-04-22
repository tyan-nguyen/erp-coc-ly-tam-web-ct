import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FinishedGoodsInventoryFilters,
  FinishedGoodsInventoryScope,
  FinishedGoodsInventorySummaryRow,
} from '@/lib/ton-kho-thanh-pham/types'

export type AnySupabase = SupabaseClient

export type InventorySerialRecord = {
  serialId: string
  serialCode: string
  lotId: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  qcStatus: string
  lifecycleStatus: string
  dispositionStatus: string
  visibleInProject: boolean
  visibleInRetail: boolean
  currentLocationId: string
  note: string
  productionDate: string
  lotCode: string
  locationLabel: string
  itemKey: string
  itemLabel: string
}

export const SUMMARY_PAGE_SIZE = 20
export const SERIAL_PAGE_SIZE = 30

export function normalizeText(value: unknown) {
  return String(value || '').trim()
}

export function normalizeSearch(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function round3(value: number) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000
  return Number.isFinite(rounded) ? rounded : 0
}

export function deriveStockSegmentGroup(tenDoan: string) {
  const normalized = normalizeText(tenDoan).toUpperCase()
  if (normalized === 'MUI') return 'MUI'
  if (normalized.startsWith('THAN')) return 'THAN'
  return normalizeText(tenDoan)
}

export function clampPage(value: unknown) {
  const parsed = Math.max(Math.trunc(toNumber(value, 1)), 1)
  return parsed || 1
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function parseScope(value: unknown): FinishedGoodsInventoryScope {
  const normalized = normalizeText(value).toUpperCase()
  return normalized === 'PROJECT' || normalized === 'RETAIL' || normalized === 'HOLD' ? normalized : 'ALL'
}

export function isMissingRelationError(error: unknown, relationName: string) {
  const message = String(
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? (error as { message: unknown }).message
        : ''
  ).toLowerCase()

  return (
    (message.includes('relation') && message.includes(relationName.toLowerCase())) ||
    (message.includes('schema cache') && message.includes(relationName.toLowerCase()))
  )
}

export function buildItemKey(loaiCoc: string, tenDoan: string, chieuDaiM: number) {
  return [normalizeText(loaiCoc), deriveStockSegmentGroup(tenDoan), String(round3(chieuDaiM))].join('::')
}

export function buildItemLabel(loaiCoc: string, tenDoan: string, chieuDaiM: number) {
  return `${normalizeText(loaiCoc)} | ${deriveStockSegmentGroup(tenDoan)} | ${round3(chieuDaiM)}m`
}

export function resolveVisibilityLabel(projectVisible: boolean, retailVisible: boolean) {
  if (projectVisible && retailVisible) return 'Dự án + Khách lẻ'
  if (projectVisible) return 'Dự án'
  if (retailVisible) return 'Khách lẻ'
  return 'Ẩn / chờ xử lý'
}

export function buildLocationLabel(locationCode: string, locationName: string) {
  if (locationCode && locationName && locationCode !== locationName) {
    return `${locationCode} · ${locationName}`
  }
  return locationName || locationCode || 'Chưa gán'
}

export function isCurrentInventoryRow(lifecycleStatus: string) {
  return lifecycleStatus !== 'DA_XUAT' && lifecycleStatus !== 'HUY_BO' && lifecycleStatus !== 'CHO_DUYET_KIEM_KE'
}

export function deriveInventoryVisibility(
  qcStatus: string,
  dispositionStatus: string,
  visibleInProject: boolean,
  visibleInRetail: boolean
) {
  if (qcStatus === 'DAT') {
    return { visibleInProject: true, visibleInRetail: true }
  }
  if (qcStatus === 'LOI' && dispositionStatus === 'THANH_LY') {
    return { visibleInProject: false, visibleInRetail: true }
  }
  if (qcStatus === 'LOI' && dispositionStatus === 'HUY') {
    return { visibleInProject: false, visibleInRetail: false }
  }
  return { visibleInProject, visibleInRetail }
}

export function isHoldInventoryRow(row: Pick<InventorySerialRecord, 'qcStatus' | 'visibleInProject' | 'visibleInRetail'>) {
  if (row.qcStatus === 'CHUA_QC') return true
  if (!row.visibleInProject && !row.visibleInRetail) return true
  return false
}

export function matchesScope(row: FinishedGoodsInventorySummaryRow, scope: FinishedGoodsInventoryScope) {
  if (scope === 'PROJECT') return row.projectQty > 0
  if (scope === 'RETAIL') return row.retailQty > 0
  if (scope === 'HOLD') return row.holdQty > 0
  return true
}

export function matchesQuery(row: FinishedGoodsInventorySummaryRow, query: string) {
  if (!query) return true
  const haystack = normalizeSearch([row.itemLabel, row.loaiCoc, row.tenDoan, row.latestProductionDate].join(' '))
  return haystack.includes(query)
}

export function buildInventoryFilters(
  rawFilters: Partial<Record<'q' | 'scope' | 'page' | 'item' | 'serial_page', string | string[] | undefined>>
): FinishedGoodsInventoryFilters {
  return {
    query: normalizeSearch(Array.isArray(rawFilters.q) ? rawFilters.q[0] : rawFilters.q),
    scope: parseScope(Array.isArray(rawFilters.scope) ? rawFilters.scope[0] : rawFilters.scope),
    page: clampPage(Array.isArray(rawFilters.page) ? rawFilters.page[0] : rawFilters.page),
    selectedItemKey: normalizeText(Array.isArray(rawFilters.item) ? rawFilters.item[0] : rawFilters.item),
    serialPage: clampPage(Array.isArray(rawFilters.serial_page) ? rawFilters.serial_page[0] : rawFilters.serial_page),
  }
}

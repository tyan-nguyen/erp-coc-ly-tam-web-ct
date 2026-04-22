import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildItemKey,
  buildItemLabel,
  buildLocationLabel,
  deriveInventoryVisibility,
  isCurrentInventoryRow,
  normalizeText,
  round3,
  safeArray,
  toNumber,
} from '@/lib/ton-kho-thanh-pham/internal'
import type {
  LegacyReconciliationCandidateLine,
  LegacyReconciliationCandidateVoucher,
  LegacyReconciliationDetailItem,
  LegacyReconciliationDetailPageData,
  LegacyReconciliationDetailSerialCandidate,
  LegacyReconciliationListFilters,
  LegacyReconciliationPageData,
} from '@/lib/ton-kho-thanh-pham/reconciliation-types'

const PAGE_SIZE = 20

type AnySupabase = SupabaseClient

type RawVoucherRow = Record<string, unknown>

function clampPage(value: unknown) {
  const parsed = Math.max(Math.trunc(toNumber(value, 1)), 1)
  return parsed || 1
}

function normalizeSearch(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function makeVoucherCode(voucherId: string) {
  return `PX-${String(voucherId || '').slice(-6).toUpperCase()}`
}

function buildListFilters(
  rawFilters: Partial<Record<'q' | 'page', string | string[] | undefined>>
): LegacyReconciliationListFilters {
  return {
    query: normalizeSearch(Array.isArray(rawFilters.q) ? rawFilters.q[0] : rawFilters.q),
    page: clampPage(Array.isArray(rawFilters.page) ? rawFilters.page[0] : rawFilters.page),
  }
}

function matchesQuery(row: LegacyReconciliationCandidateVoucher, query: string) {
  if (!query) return true
  const haystack = normalizeSearch(
    [
      row.maPhieu,
      row.customerName || '',
      row.projectName || '',
      row.orderLabel || '',
      ...row.lines.map((line) => line.itemLabel),
    ].join(' ')
  )
  return haystack.includes(query)
}

async function loadVoucherRows(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('phieu_xuat_ban')
    .select('voucher_id, source_type, trang_thai, kh_id, da_id, order_id, quote_id, payload_json, created_at')
    .eq('is_active', true)
    .in('trang_thai', ['DA_XUAT', 'XUAT_MOT_PHAN'])

  if (error) throw error
  return safeArray<RawVoucherRow>(data)
}

async function loadAssignedAndReturnedMaps(supabase: AnySupabase, voucherIds: string[]) {
  const [shipmentResponse, returnResponse] = await Promise.all([
    voucherIds.length
      ? supabase.from('shipment_voucher_serial').select('voucher_id, serial_id').in('voucher_id', voucherIds)
      : Promise.resolve({ data: [], error: null }),
    voucherIds.length
      ? supabase.from('return_voucher_serial').select('shipment_voucher_id, serial_id').in('shipment_voucher_id', voucherIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (shipmentResponse.error) throw shipmentResponse.error
  if (returnResponse.error) throw returnResponse.error

  const relatedSerialIds = Array.from(
    new Set(
      [
        ...safeArray<Record<string, unknown>>(shipmentResponse.data).map((row) => String(row.serial_id || '')),
        ...safeArray<Record<string, unknown>>(returnResponse.data).map((row) => String(row.serial_id || '')),
      ].filter(Boolean)
    )
  )

  const serialItemKeyMap = new Map<string, string>()
  if (relatedSerialIds.length) {
    const { data: serialRows, error: serialError } = await supabase
      .from('pile_serial')
      .select('serial_id, loai_coc, ten_doan, chieu_dai_m')
      .in('serial_id', relatedSerialIds)

    if (serialError) throw serialError

    for (const row of safeArray<Record<string, unknown>>(serialRows)) {
      serialItemKeyMap.set(
        String(row.serial_id || ''),
        buildItemKey(normalizeText(row.loai_coc), normalizeText(row.ten_doan), round3(toNumber(row.chieu_dai_m)))
      )
    }
  }

  const assignedByVoucherAndItem = new Map<string, number>()
  for (const row of safeArray<Record<string, unknown>>(shipmentResponse.data)) {
    const voucherId = String(row.voucher_id || '')
    const itemKey = serialItemKeyMap.get(String(row.serial_id || ''))
    if (!voucherId || !itemKey) continue
    const key = `${voucherId}::${itemKey}`
    assignedByVoucherAndItem.set(key, (assignedByVoucherAndItem.get(key) ?? 0) + 1)
  }

  const returnedByVoucherAndItem = new Map<string, number>()
  for (const row of safeArray<Record<string, unknown>>(returnResponse.data)) {
    const voucherId = String(row.shipment_voucher_id || '')
    const itemKey = serialItemKeyMap.get(String(row.serial_id || ''))
    if (!voucherId || !itemKey) continue
    const key = `${voucherId}::${itemKey}`
    returnedByVoucherAndItem.set(key, (returnedByVoucherAndItem.get(key) ?? 0) + 1)
  }

  return { assignedByVoucherAndItem, returnedByVoucherAndItem }
}

function buildCandidateVoucher(
  row: RawVoucherRow,
  assignedByVoucherAndItem: Map<string, number>,
  returnedByVoucherAndItem: Map<string, number>
): LegacyReconciliationCandidateVoucher | null {
  const payload = (row.payload_json as Record<string, unknown> | null) || {}
  const summary = payload.summary && typeof payload.summary === 'object' ? (payload.summary as Record<string, unknown>) : {}
  const lines = safeArray<Record<string, unknown>>(payload.lines)
  const unresolvedLines: LegacyReconciliationCandidateLine[] = []

  for (const line of lines) {
    const actualQty = Math.max(toNumber(line.actualQty), 0)
    if (!actualQty) continue
    const loaiCoc = normalizeText(line.loaiCoc)
    const tenDoan = normalizeText(line.tenDoan)
    const chieuDaiM = round3(toNumber(line.chieuDaiM))
    const itemKey = buildItemKey(loaiCoc, tenDoan, chieuDaiM)
    const assignedQty = assignedByVoucherAndItem.get(`${String(row.voucher_id || '')}::${itemKey}`) ?? 0
    const returnedQty = returnedByVoucherAndItem.get(`${String(row.voucher_id || '')}::${itemKey}`) ?? 0
    const unresolvedQty = Math.max(actualQty - assignedQty - returnedQty, 0)
    if (!unresolvedQty) continue

    unresolvedLines.push({
      lineId: normalizeText(line.lineId) || itemKey,
      itemKey,
      itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
      actualQty,
      assignedQty,
      returnedQty,
      unresolvedQty,
      orderSourceKey: normalizeText(line.orderSourceKey) || null,
      stockSourceKey: normalizeText(line.stockSourceKey) || null,
    })
  }

  if (!unresolvedLines.length) return null

  return {
    voucherId: String(row.voucher_id || ''),
    maPhieu: makeVoucherCode(String(row.voucher_id || '')),
    status: normalizeText(row.trang_thai) || 'DA_XUAT',
    sourceType: normalizeText(row.source_type) === 'TON_KHO' ? 'TON_KHO' : 'DON_HANG',
    customerName: normalizeText(summary.customerName) || null,
    projectName: normalizeText(summary.projectName) || null,
    orderLabel: normalizeText(summary.maOrder) || null,
    quoteLabel: normalizeText(summary.maBaoGia) || null,
    createdAt: normalizeText(row.created_at),
    unresolvedQtyTotal: unresolvedLines.reduce((sum, line) => sum + line.unresolvedQty, 0),
    lineCount: unresolvedLines.length,
    lines: unresolvedLines,
  }
}

async function loadSerialCandidatesByItemKey(supabase: AnySupabase, itemKeys: string[]) {
  if (!itemKeys.length) return new Map<string, LegacyReconciliationDetailSerialCandidate[]>()

  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, disposition_status, visible_in_project, visible_in_retail, current_location_id, notes'
    )
    .eq('is_active', true)

  if (serialError) throw serialError

  const currentRows = safeArray<Record<string, unknown>>(serialRows).filter((row) =>
    isCurrentInventoryRow(normalizeText(row.lifecycle_status))
  )

  const lotIds = Array.from(new Set(currentRows.map((row) => String(row.lot_id || '')).filter(Boolean)))
  const locationIds = Array.from(new Set(currentRows.map((row) => String(row.current_location_id || '')).filter(Boolean)))

  const [lotResponse, locationResponse] = await Promise.all([
    lotIds.length
      ? supabase.from('production_lot').select('lot_id, lot_code, production_date').in('lot_id', lotIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase.from('warehouse_location').select('location_id, location_code, location_name').in('location_id', locationIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (lotResponse.error) throw lotResponse.error
  if (locationResponse.error) throw locationResponse.error

  const lotMap = new Map<string, Record<string, unknown>>()
  for (const lot of safeArray<Record<string, unknown>>(lotResponse.data)) {
    lotMap.set(String(lot.lot_id || ''), lot)
  }

  const locationMap = new Map<string, Record<string, unknown>>()
  for (const location of safeArray<Record<string, unknown>>(locationResponse.data)) {
    locationMap.set(String(location.location_id || ''), location)
  }

  const itemKeySet = new Set(itemKeys)
  const result = new Map<string, LegacyReconciliationDetailSerialCandidate[]>()

  for (const row of currentRows) {
    const itemKey = buildItemKey(
      normalizeText(row.loai_coc),
      normalizeText(row.ten_doan),
      round3(toNumber(row.chieu_dai_m))
    )
    if (!itemKeySet.has(itemKey)) continue

    const lot = lotMap.get(String(row.lot_id || '')) || {}
    const location = locationMap.get(String(row.current_location_id || '')) || {}
    const visibility = deriveInventoryVisibility(
      normalizeText(row.qc_status),
      normalizeText(row.disposition_status),
      Boolean(row.visible_in_project),
      Boolean(row.visible_in_retail)
    )
    const visibilityLabel = visibility.visibleInProject && visibility.visibleInRetail
      ? 'Dự án + Khách lẻ'
      : visibility.visibleInProject
        ? 'Dự án'
        : visibility.visibleInRetail
          ? 'Khách lẻ'
          : 'Ẩn / chờ xử lý'

    const candidate: LegacyReconciliationDetailSerialCandidate = {
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      lotCode: normalizeText(lot.lot_code),
      productionDate: normalizeText(lot.production_date),
      locationLabel: buildLocationLabel(normalizeText(location.location_code), normalizeText(location.location_name)),
      visibilityLabel,
      lifecycleStatus: normalizeText(row.lifecycle_status),
      dispositionStatus: normalizeText(row.disposition_status),
    }

    result.set(itemKey, [...(result.get(itemKey) || []), candidate])
  }

  for (const key of itemKeys) {
    result.set(
      key,
      (result.get(key) || []).sort((a, b) => a.serialCode.localeCompare(b.serialCode, 'vi'))
    )
  }

  return result
}

export async function loadLegacyReconciliationPageData(
  supabase: AnySupabase,
  rawFilters: Partial<Record<'q' | 'page', string | string[] | undefined>>
): Promise<LegacyReconciliationPageData> {
  const filters = buildListFilters(rawFilters)
  const voucherRows = await loadVoucherRows(supabase)
  const voucherIds = voucherRows.map((row) => String(row.voucher_id || '')).filter(Boolean)
  const { assignedByVoucherAndItem, returnedByVoucherAndItem } = await loadAssignedAndReturnedMaps(supabase, voucherIds)

  const candidateRows = voucherRows
    .map((row) => buildCandidateVoucher(row, assignedByVoucherAndItem, returnedByVoucherAndItem))
    .filter((row): row is LegacyReconciliationCandidateVoucher => Boolean(row))

  const filteredRows = candidateRows
    .filter((row) => matchesQuery(row, filters.query))
    .sort((a, b) => {
      if (b.unresolvedQtyTotal !== a.unresolvedQtyTotal) return b.unresolvedQtyTotal - a.unresolvedQtyTotal
      return b.createdAt.localeCompare(a.createdAt)
    })

  const totalCount = filteredRows.length
  const pageCount = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)
  const page = Math.min(filters.page, pageCount)
  const rows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return {
    filters: { ...filters, page },
    rows,
    totalCount,
    pageCount,
  }
}

export async function loadLegacyReconciliationDetailPageData(
  supabase: AnySupabase,
  voucherId: string
): Promise<LegacyReconciliationDetailPageData | null> {
  const voucherRows = await loadVoucherRows(supabase)
  const target = voucherRows.find((row) => String(row.voucher_id || '') === voucherId)
  if (!target) return null

  const { assignedByVoucherAndItem, returnedByVoucherAndItem } = await loadAssignedAndReturnedMaps(supabase, [voucherId])
  const candidate = buildCandidateVoucher(target, assignedByVoucherAndItem, returnedByVoucherAndItem)
  if (!candidate) return null

  const serialCandidatesByItem = await loadSerialCandidatesByItemKey(
    supabase,
    candidate.lines.map((line) => line.itemKey)
  )

  const items: LegacyReconciliationDetailItem[] = candidate.lines.map((line) => ({
    ...line,
    serialCandidates: serialCandidatesByItem.get(line.itemKey) || [],
  }))

  return {
    voucherId: candidate.voucherId,
    maPhieu: candidate.maPhieu,
    status: candidate.status,
    sourceType: candidate.sourceType,
    customerName: candidate.customerName,
    projectName: candidate.projectName,
    orderLabel: candidate.orderLabel,
    quoteLabel: candidate.quoteLabel,
    createdAt: candidate.createdAt,
    unresolvedQtyTotal: candidate.unresolvedQtyTotal,
    items,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinishedGoodsInventoryPageData, FinishedGoodsInventorySummaryRow } from '@/lib/ton-kho-thanh-pham/types'
import {
  buildInventoryFilters,
  buildItemKey,
  buildItemLabel,
  deriveInventoryVisibility,
  isCurrentInventoryRow,
  isMissingRelationError,
  matchesQuery,
  matchesScope,
  normalizeText,
  round3,
  safeArray,
  toNumber,
  type AnySupabase,
  type InventorySerialRecord,
  SUMMARY_PAGE_SIZE,
} from '@/lib/ton-kho-thanh-pham/internal'
import {
  buildFilteredSummaryRows,
  buildInventorySummaryRows,
  buildSelectedItemDetail,
} from '@/lib/ton-kho-thanh-pham/selectors'

const FINISHED_GOODS_STOCK_MODEL_NAME = 'finished_goods_stock_summary'
const ENABLE_FINISHED_GOODS_STOCK_READ_MODEL = process.env.FINISHED_GOODS_STOCK_READ_MODEL === 'true'

async function isInventorySchemaReady(supabase: AnySupabase) {
  const { error } = await supabase.from('pile_serial').select('serial_id').limit(1)
  if (!error) return true
  if (isMissingRelationError(error, 'pile_serial')) return false
  throw error
}

async function isStockReadModelVerified(supabase: AnySupabase, modelName: string) {
  const { data, error } = await supabase
    .from('stock_read_model_health')
    .select('is_verified')
    .eq('model_name', modelName)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error, 'stock_read_model_health')) return false
    throw error
  }

  return Boolean((data as Record<string, unknown> | null)?.is_verified)
}

function extractLegacyFinishedGoodsCountId(note: string) {
  const match = note.match(/^Sinh từ kiểm kê cọc ([0-9a-fA-F-]{36}) - dòng (\d+)$/)
  if (!match) return null
  return {
    countSheetId: match[1],
    lineNo: match[2],
  }
}

async function buildFinishedGoodsCountCodeMap(supabase: AnySupabase, notes: string[]) {
  const countSheetIds = Array.from(
    new Set(
      notes
        .map((note) => extractLegacyFinishedGoodsCountId(note)?.countSheetId || '')
        .filter(Boolean)
    )
  )

  if (!countSheetIds.length) return new Map<string, string>()

  const { data, error } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code')
    .in('count_sheet_id', countSheetIds)

  if (error) {
    if (isMissingRelationError(error, 'inventory_count_sheet')) return new Map<string, string>()
    throw error
  }

  const codeMap = new Map<string, string>()
  for (const row of safeArray<Record<string, unknown>>(data)) {
    const countSheetId = normalizeText(row.count_sheet_id)
    const countSheetCode = normalizeText(row.count_sheet_code)
    if (countSheetId && countSheetCode) codeMap.set(countSheetId, countSheetCode)
  }

  return codeMap
}

function formatFinishedGoodsSerialNote(note: string, countSheetCodeMap: Map<string, string>) {
  const parsed = extractLegacyFinishedGoodsCountId(note)
  if (!parsed) return note
  const countSheetCode = countSheetCodeMap.get(parsed.countSheetId)
  if (!countSheetCode) return note
  return `Kiểm kê cọc ${countSheetCode} - dòng ${parsed.lineNo}`
}

async function loadCurrentInventorySerials(supabase: AnySupabase) {
  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, disposition_status, visible_in_project, visible_in_retail, current_location_id, notes'
    )
    .eq('is_active', true)

  if (serialError) throw serialError

  const currentRows = ((serialRows ?? []) as Array<Record<string, unknown>>).filter((row) =>
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

  const countSheetCodeMap = await buildFinishedGoodsCountCodeMap(
    supabase,
    currentRows.map((row) => normalizeText(row.notes))
  )

  const lotMap = new Map<string, Record<string, unknown>>()
  for (const lot of (lotResponse.data ?? []) as Array<Record<string, unknown>>) {
    lotMap.set(String(lot.lot_id || ''), lot)
  }

  const locationMap = new Map<string, Record<string, unknown>>()
  for (const location of (locationResponse.data ?? []) as Array<Record<string, unknown>>) {
    locationMap.set(String(location.location_id || ''), location)
  }

  return currentRows.map((row) => {
    const lot = lotMap.get(String(row.lot_id || '')) || {}
    const location = locationMap.get(String(row.current_location_id || '')) || {}
    const loaiCoc = normalizeText(row.loai_coc)
    const tenDoan = normalizeText(row.ten_doan)
    const chieuDaiM = round3(toNumber(row.chieu_dai_m))
    const qcStatus = normalizeText(row.qc_status)
    const dispositionStatus = normalizeText(row.disposition_status)
    const visibility = deriveInventoryVisibility(
      qcStatus,
      dispositionStatus,
      Boolean(row.visible_in_project),
      Boolean(row.visible_in_retail)
    )

    return {
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      lotId: String(row.lot_id || ''),
      loaiCoc,
      tenDoan,
      chieuDaiM,
      qcStatus,
      lifecycleStatus: normalizeText(row.lifecycle_status),
      dispositionStatus,
      visibleInProject: visibility.visibleInProject,
      visibleInRetail: visibility.visibleInRetail,
      currentLocationId: String(row.current_location_id || ''),
      note: formatFinishedGoodsSerialNote(normalizeText(row.notes), countSheetCodeMap),
      productionDate: normalizeText(lot.production_date),
      lotCode: normalizeText(lot.lot_code),
      locationLabel: normalizeText(location.location_name) || normalizeText(location.location_code) || 'Chưa gán',
      itemKey: buildItemKey(loaiCoc, tenDoan, chieuDaiM),
      itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    } satisfies InventorySerialRecord
  })
}

export async function loadFinishedGoodsCurrentInventoryRows(supabase: SupabaseClient) {
  return loadCurrentInventorySerials(supabase)
}

async function buildFinishedGoodsLegacySummaryRows(supabase: AnySupabase) {
  const currentRows = await loadCurrentInventorySerials(supabase)
  const legacyShipmentGapByItem = await loadLegacyShipmentGapByItem(supabase)
  const summaryMap = buildInventorySummaryRows(currentRows, legacyShipmentGapByItem)
  return buildFilteredSummaryRows(summaryMap, {
    query: '',
    scope: 'ALL',
    page: 1,
    selectedItemKey: '',
    serialPage: 1,
  })
}

function mapFinishedGoodsSummaryRow(row: Record<string, unknown>): FinishedGoodsInventorySummaryRow {
  const loaiCoc = normalizeText(row.loai_coc)
  const tenDoan = normalizeText(row.ten_doan)
  const chieuDaiM = round3(toNumber(row.chieu_dai_m))
  return {
    itemKey: normalizeText(row.item_key) || buildItemKey(loaiCoc, tenDoan, chieuDaiM),
    itemLabel: normalizeText(row.item_label) || buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    loaiCoc,
    tenDoan,
    chieuDaiM,
    physicalQty: Math.max(Math.trunc(toNumber(row.physical_qty)), 0),
    projectQty: Math.max(Math.trunc(toNumber(row.project_qty)), 0),
    retailQty: Math.max(Math.trunc(toNumber(row.retail_qty)), 0),
    holdQty: Math.max(Math.trunc(toNumber(row.hold_qty)), 0),
    lotCount: Math.max(Math.trunc(toNumber(row.lot_count)), 0),
    latestProductionDate: normalizeText(row.latest_production_date),
    legacyShipmentGapQty: Math.max(Math.trunc(toNumber(row.legacy_shipment_gap_qty)), 0),
  }
}

async function loadFinishedGoodsReadModelRows(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('finished_goods_stock_summary')
    .select(
      'item_key, item_label, loai_coc, ten_doan, chieu_dai_m, physical_qty, project_qty, retail_qty, hold_qty, lot_count, latest_production_date, legacy_shipment_gap_qty'
    )
    .order('physical_qty', { ascending: false })
    .order('item_label', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'finished_goods_stock_summary')) return null
    throw error
  }

  return safeArray<Record<string, unknown>>(data).map(mapFinishedGoodsSummaryRow)
}

async function loadFinishedGoodsReadModelRow(supabase: AnySupabase, itemKey: string) {
  const { data, error } = await supabase
    .from('finished_goods_stock_summary')
    .select(
      'item_key, item_label, loai_coc, ten_doan, chieu_dai_m, physical_qty, project_qty, retail_qty, hold_qty, lot_count, latest_production_date, legacy_shipment_gap_qty'
    )
    .eq('item_key', itemKey)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error, 'finished_goods_stock_summary')) return null
    throw error
  }

  return data ? mapFinishedGoodsSummaryRow(data as Record<string, unknown>) : null
}

function parseFinishedGoodsItemKey(itemKey: string) {
  const [loaiCoc = '', tenDoan = '', chieuDaiM = ''] = itemKey.split('::')
  return {
    loaiCoc: normalizeText(loaiCoc),
    tenDoan: normalizeText(tenDoan),
    chieuDaiM: round3(toNumber(chieuDaiM)),
  }
}

async function loadCurrentInventorySerialsForItem(supabase: AnySupabase, itemKey: string) {
  const parsed = parseFinishedGoodsItemKey(itemKey)
  if (!parsed.loaiCoc || !parsed.chieuDaiM) return []

  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, disposition_status, visible_in_project, visible_in_retail, current_location_id, notes'
    )
    .eq('is_active', true)
    .eq('loai_coc', parsed.loaiCoc)
    .eq('chieu_dai_m', parsed.chieuDaiM)

  if (serialError) throw serialError

  const currentRows = safeArray<Record<string, unknown>>(serialRows).filter((row) => {
    const lifecycleStatus = normalizeText(row.lifecycle_status)
    const loaiCoc = normalizeText(row.loai_coc)
    const tenDoan = normalizeText(row.ten_doan)
    const chieuDaiM = round3(toNumber(row.chieu_dai_m))
    return isCurrentInventoryRow(lifecycleStatus) && buildItemKey(loaiCoc, tenDoan, chieuDaiM) === itemKey
  })

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

  const countSheetCodeMap = await buildFinishedGoodsCountCodeMap(
    supabase,
    currentRows.map((row) => normalizeText(row.notes))
  )

  const lotMap = new Map<string, Record<string, unknown>>()
  for (const lot of safeArray<Record<string, unknown>>(lotResponse.data)) {
    lotMap.set(String(lot.lot_id || ''), lot)
  }

  const locationMap = new Map<string, Record<string, unknown>>()
  for (const location of safeArray<Record<string, unknown>>(locationResponse.data)) {
    locationMap.set(String(location.location_id || ''), location)
  }

  return currentRows.map((row) => {
    const lot = lotMap.get(String(row.lot_id || '')) || {}
    const location = locationMap.get(String(row.current_location_id || '')) || {}
    const loaiCoc = normalizeText(row.loai_coc)
    const tenDoan = normalizeText(row.ten_doan)
    const chieuDaiM = round3(toNumber(row.chieu_dai_m))
    const qcStatus = normalizeText(row.qc_status)
    const dispositionStatus = normalizeText(row.disposition_status)
    const visibility = deriveInventoryVisibility(
      qcStatus,
      dispositionStatus,
      Boolean(row.visible_in_project),
      Boolean(row.visible_in_retail)
    )

    return {
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      lotId: String(row.lot_id || ''),
      loaiCoc,
      tenDoan,
      chieuDaiM,
      qcStatus,
      lifecycleStatus: normalizeText(row.lifecycle_status),
      dispositionStatus,
      visibleInProject: visibility.visibleInProject,
      visibleInRetail: visibility.visibleInRetail,
      currentLocationId: String(row.current_location_id || ''),
      note: formatFinishedGoodsSerialNote(normalizeText(row.notes), countSheetCodeMap),
      productionDate: normalizeText(lot.production_date),
      lotCode: normalizeText(lot.lot_code),
      locationLabel: normalizeText(location.location_name) || normalizeText(location.location_code) || 'Chưa gán',
      itemKey: buildItemKey(loaiCoc, tenDoan, chieuDaiM),
      itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    } satisfies InventorySerialRecord
  })
}

function compareFinishedGoodsSummaryRows(
  sourceRows: FinishedGoodsInventorySummaryRow[],
  readModelRows: FinishedGoodsInventorySummaryRow[]
) {
  const sourceMap = new Map(sourceRows.map((row) => [row.itemKey, row]))
  const readModelMap = new Map(readModelRows.map((row) => [row.itemKey, row]))
  const keys = Array.from(new Set([...sourceMap.keys(), ...readModelMap.keys()])).sort()
  const mismatches: Array<{ itemKey: string; reason: string }> = []

  for (const itemKey of keys) {
    const source = sourceMap.get(itemKey)
    const readModel = readModelMap.get(itemKey)
    if (!source || !readModel) {
      mismatches.push({ itemKey, reason: source ? 'missing_read_model_row' : 'extra_read_model_row' })
      continue
    }

    const fields: Array<keyof FinishedGoodsInventorySummaryRow> = [
      'physicalQty',
      'projectQty',
      'retailQty',
      'holdQty',
      'lotCount',
      'legacyShipmentGapQty',
    ]

    for (const field of fields) {
      if (Number(source[field] || 0) !== Number(readModel[field] || 0)) {
        mismatches.push({ itemKey, reason: `mismatch_${field}` })
        break
      }
    }
  }

  return {
    matched: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches: mismatches.slice(0, 20),
  }
}

export async function refreshFinishedGoodsStockReadModel(supabase: SupabaseClient) {
  const rows = await buildFinishedGoodsLegacySummaryRows(supabase)
  const now = new Date().toISOString()

  const deleteResult = await supabase.from('finished_goods_stock_summary').delete().neq('item_key', '')
  if (deleteResult.error) throw deleteResult.error

  if (rows.length) {
    const { error } = await supabase.from('finished_goods_stock_summary').insert(
      rows.map((row) => ({
        item_key: row.itemKey,
        item_label: row.itemLabel,
        loai_coc: row.loaiCoc,
        ten_doan: row.tenDoan,
        chieu_dai_m: row.chieuDaiM,
        physical_qty: row.physicalQty,
        project_qty: row.projectQty,
        retail_qty: row.retailQty,
        hold_qty: row.holdQty,
        lot_count: row.lotCount,
        latest_production_date: row.latestProductionDate || null,
        legacy_shipment_gap_qty: row.legacyShipmentGapQty,
        refreshed_at: now,
      }))
    )
    if (error) throw error
  }

  const { error: healthError } = await supabase.from('stock_read_model_health').upsert({
    model_name: FINISHED_GOODS_STOCK_MODEL_NAME,
    is_verified: false,
    source_row_count: rows.length,
    read_model_row_count: rows.length,
    mismatch_count: 0,
    refreshed_at: now,
    verified_at: null,
    note: 'Refreshed from legacy finished-goods inventory calculation.',
  })
  if (healthError) throw healthError

  return rows
}

export async function verifyFinishedGoodsStockReadModel(supabase: SupabaseClient) {
  const sourceRows = await buildFinishedGoodsLegacySummaryRows(supabase)
  const readModelRows = (await loadFinishedGoodsReadModelRows(supabase)) ?? []
  const comparison = compareFinishedGoodsSummaryRows(sourceRows, readModelRows)
  const now = new Date().toISOString()

  const { error } = await supabase.from('stock_read_model_health').upsert({
    model_name: FINISHED_GOODS_STOCK_MODEL_NAME,
    is_verified: comparison.matched,
    source_row_count: sourceRows.length,
    read_model_row_count: readModelRows.length,
    mismatch_count: comparison.mismatchCount,
    verified_at: comparison.matched ? now : null,
    note: comparison.matched
      ? 'Read model matches legacy finished-goods inventory calculation.'
      : JSON.stringify(comparison.mismatches),
  })
  if (error) throw error

  return {
    modelName: FINISHED_GOODS_STOCK_MODEL_NAME,
    sourceRowCount: sourceRows.length,
    readModelRowCount: readModelRows.length,
    ...comparison,
  }
}

async function loadFinishedGoodsBucketWithFilter(
  supabase: SupabaseClient,
  predicate: (row: Awaited<ReturnType<typeof loadCurrentInventorySerials>>[number]) => boolean
) {
  const currentRows = await loadCurrentInventorySerials(supabase)
  const legacyShipmentGapByItem = await loadLegacyShipmentGapByItem(supabase)
  const bucket = new Map<string, number>()

  for (const row of currentRows.filter(predicate)) {
    bucket.set(row.itemKey, (bucket.get(row.itemKey) ?? 0) + 1)
  }

  for (const [itemKey, gapQty] of legacyShipmentGapByItem.entries()) {
    if (!gapQty) continue
    bucket.set(itemKey, Math.max((bucket.get(itemKey) ?? 0) - gapQty, 0))
  }

  return bucket
}

async function loadLegacyShipmentGapByItem(supabase: AnySupabase) {
  const { data: voucherRows, error: voucherError } = await supabase
    .from('phieu_xuat_ban')
    .select('voucher_id, trang_thai, payload_json')
    .eq('is_active', true)
    .in('trang_thai', ['DA_XUAT', 'XUAT_MOT_PHAN'])

  if (voucherError) throw voucherError

  const voucherIds = safeArray<Record<string, unknown>>(voucherRows).map((row) => String(row.voucher_id || '')).filter(Boolean)

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

  const gapByItem = new Map<string, number>()
  for (const row of safeArray<Record<string, unknown>>(voucherRows)) {
    const voucherId = String(row.voucher_id || '')
    const payload = (row.payload_json as Record<string, unknown> | null) || {}
    const lines = safeArray<Record<string, unknown>>(payload.lines)

    for (const line of lines) {
      const actualQty = Math.max(toNumber(line.actualQty), 0)
      if (!actualQty) continue
      const itemKey = buildItemKey(normalizeText(line.loaiCoc), normalizeText(line.tenDoan), round3(toNumber(line.chieuDaiM)))
      const assigned = assignedByVoucherAndItem.get(`${voucherId}::${itemKey}`) ?? 0
      const returned = returnedByVoucherAndItem.get(`${voucherId}::${itemKey}`) ?? 0
      const gap = Math.max(actualQty - assigned - returned, 0)
      if (!gap) continue
      gapByItem.set(itemKey, (gapByItem.get(itemKey) ?? 0) + gap)
    }
  }

  return gapByItem
}

export async function loadFinishedGoodsInventoryPageData(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'q' | 'scope' | 'page' | 'item' | 'serial_page', string | string[] | undefined>>
): Promise<FinishedGoodsInventoryPageData> {
  const schemaReady = await isInventorySchemaReady(supabase)
  const filters = buildInventoryFilters(rawFilters)

  if (!schemaReady) {
    return {
      schemaReady: false,
      filters,
      summaryRows: [],
      summaryTotalCount: 0,
      summaryPageCount: 1,
      selectedItemDetail: null,
      prefetchedItemDetails: {},
    }
  }

  const readModelVerified =
    ENABLE_FINISHED_GOODS_STOCK_READ_MODEL && (await isStockReadModelVerified(supabase, FINISHED_GOODS_STOCK_MODEL_NAME))
  if (readModelVerified) {
    const readModelRows = await loadFinishedGoodsReadModelRows(supabase)
    if (readModelRows) {
      const filteredRows = readModelRows
        .filter((row) => matchesScope(row, filters.scope))
        .filter((row) => matchesQuery(row, filters.query))
      const summaryTotalCount = filteredRows.length
      const summaryPageCount = Math.max(Math.ceil(summaryTotalCount / SUMMARY_PAGE_SIZE), 1)
      const summaryPage = Math.min(filters.page, summaryPageCount)
      const summaryRows = filteredRows.slice((summaryPage - 1) * SUMMARY_PAGE_SIZE, summaryPage * SUMMARY_PAGE_SIZE)
      const selectedItemDetail = filters.selectedItemKey
        ? (await loadFinishedGoodsSelectedItemDetailFromLegacy(supabase, rawFilters)).selectedItemDetail
        : null

      return {
        schemaReady: true,
        filters: {
          ...filters,
          page: summaryPage,
          serialPage: selectedItemDetail?.serialPage || filters.serialPage,
        },
        summaryRows,
        summaryTotalCount,
        summaryPageCount,
        selectedItemDetail,
        prefetchedItemDetails: {},
      }
    }
  }

  const currentRows = await loadCurrentInventorySerials(supabase)
  const legacyShipmentGapByItem = await loadLegacyShipmentGapByItem(supabase)
  const summaryMap = buildInventorySummaryRows(currentRows, legacyShipmentGapByItem)
  const filteredRows = buildFilteredSummaryRows(summaryMap, filters)

  const summaryTotalCount = filteredRows.length
  const summaryPageCount = Math.max(Math.ceil(summaryTotalCount / SUMMARY_PAGE_SIZE), 1)
  const summaryPage = Math.min(filters.page, summaryPageCount)
  const summaryRows = filteredRows.slice((summaryPage - 1) * SUMMARY_PAGE_SIZE, summaryPage * SUMMARY_PAGE_SIZE)
  const selectedItemDetail = buildSelectedItemDetail(currentRows, filteredRows, summaryMap, filters)
  const prefetchedItemDetails = Object.fromEntries(
    summaryRows
      .map((row) => {
        const detail = buildSelectedItemDetail(currentRows, filteredRows, summaryMap, {
          ...filters,
          selectedItemKey: row.itemKey,
          serialPage: 1,
        })
        return detail ? [row.itemKey, detail] : null
      })
      .filter(Boolean) as Array<[string, NonNullable<FinishedGoodsInventoryPageData['selectedItemDetail']>]>
  )

  return {
    schemaReady: true,
    filters: {
      ...filters,
      page: summaryPage,
      serialPage: selectedItemDetail?.serialPage || filters.serialPage,
    },
    summaryRows,
    summaryTotalCount,
    summaryPageCount,
    selectedItemDetail,
    prefetchedItemDetails,
  }
}

async function loadFinishedGoodsSelectedItemDetailFromLegacy(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'scope' | 'item' | 'serial_page', string | string[] | undefined>>
) {
  const schemaReady = await isInventorySchemaReady(supabase)
  const filters = buildInventoryFilters(rawFilters)

  if (!schemaReady || !filters.selectedItemKey) {
    return {
      schemaReady,
      filters,
      selectedItemDetail: null,
    }
  }

  const currentRows = await loadCurrentInventorySerials(supabase)
  const legacyShipmentGapByItem = await loadLegacyShipmentGapByItem(supabase)
  const summaryMap = buildInventorySummaryRows(currentRows, legacyShipmentGapByItem)
  const filteredRows = buildFilteredSummaryRows(summaryMap, filters)
  const selectedItemDetail = buildSelectedItemDetail(currentRows, filteredRows, summaryMap, filters)

  return {
    schemaReady: true,
    filters: {
      ...filters,
      serialPage: selectedItemDetail?.serialPage || filters.serialPage,
    },
    selectedItemDetail,
  }
}

async function loadFinishedGoodsSelectedItemDetailFromReadModel(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'scope' | 'item' | 'serial_page', string | string[] | undefined>>
) {
  const schemaReady = await isInventorySchemaReady(supabase)
  const filters = buildInventoryFilters(rawFilters)

  if (!schemaReady || !filters.selectedItemKey) {
    return {
      schemaReady,
      filters,
      selectedItemDetail: null,
    }
  }

  const [summary, currentRows] = await Promise.all([
    loadFinishedGoodsReadModelRow(supabase, filters.selectedItemKey),
    loadCurrentInventorySerialsForItem(supabase, filters.selectedItemKey),
  ])

  if (!summary) {
    return {
      schemaReady: true,
      filters,
      selectedItemDetail: null,
    }
  }

  const summaryMap = new Map([[summary.itemKey, { ...summary, lotIds: new Set<string>() }]])
  const filteredRows = matchesScope(summary, filters.scope) && matchesQuery(summary, filters.query) ? [summary] : []
  const selectedItemDetail = buildSelectedItemDetail(currentRows, filteredRows, summaryMap, filters)

  return {
    schemaReady: true,
    filters: {
      ...filters,
      serialPage: selectedItemDetail?.serialPage || filters.serialPage,
    },
    selectedItemDetail,
  }
}

export async function loadFinishedGoodsSelectedItemDetail(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'scope' | 'item' | 'serial_page', string | string[] | undefined>>
) {
  const readModelVerified =
    ENABLE_FINISHED_GOODS_STOCK_READ_MODEL && (await isStockReadModelVerified(supabase, FINISHED_GOODS_STOCK_MODEL_NAME))
  if (readModelVerified) {
    return loadFinishedGoodsSelectedItemDetailFromReadModel(supabase, rawFilters)
  }

  return loadFinishedGoodsSelectedItemDetailFromLegacy(supabase, rawFilters)
}

export async function loadFinishedGoodsPhysicalPoolByBucket(supabase: SupabaseClient) {
  return loadFinishedGoodsBucketWithFilter(supabase, () => true)
}

export async function loadFinishedGoodsProjectPoolByBucket(supabase: SupabaseClient) {
  return loadFinishedGoodsBucketWithFilter(supabase, (row) => row.visibleInProject)
}

export async function loadFinishedGoodsRetailPoolByBucket(supabase: SupabaseClient) {
  return loadFinishedGoodsBucketWithFilter(supabase, (row) => row.visibleInRetail)
}

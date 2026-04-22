import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveStockSegmentGroup } from '@/lib/ton-kho-thanh-pham/internal'

type AnySupabase = SupabaseClient

export type ProductionLotInput = {
  warehouseIssueVoucherId: string
  planId: string
  lineId: string
  orderId: string | null
  bocId: string | null
  quoteId: string | null
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  productionDate: string
  actualQty: number
  createdBy: string
}

export type GenerateLotAndSerialResult = {
  generatedLotCount: number
  generatedSerialCount: number
  schemaReady: boolean
}

export type ProductionLotSummary = {
  lotId: string
  lotCode: string
  productionDate: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  actualQty: number
  serialCount: number
}

export type PrintableSerialLabel = {
  lotId: string
  lotCode: string
  serialId: string
  serialCode: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  productionDate: string
  displaySequence: number
}

export type SerialReprintSearchOptions = {
  loaiCocOptions: string[]
  tenDoanOptions: string[]
}

export type SerialReprintSearchInput = {
  loaiCoc?: string
  tenDoan?: string
  chieuDaiM?: number
  productionDate?: string
  displaySequence?: number
}

export type OpeningBalanceQualityStatus = 'DAT' | 'LOI'

export type OpeningBalanceLotInput = {
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  openingDate: string
  quantity: number
  qualityStatus: OpeningBalanceQualityStatus
  locationId: string | null
  note: string
  createdBy: string
}

export type OpeningBalanceLotSummary = {
  lotId: string
  lotCode: string
  countSheetId: string
  countSheetCode: string
  countSheetStatus: string
  openingDate: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  quantity: number
  qualityStatus: OpeningBalanceQualityStatus
  locationLabel: string
  note: string
  serialCount: number
  createdAt: string
}

export type CreateOpeningBalanceLotResult = {
  schemaReady: boolean
  lotId: string
  lotCode: string
  generatedSerialCount: number
}

export type ActivateOpeningBalanceDraftResult = {
  activatedLotCount: number
  activatedSerialCount: number
}

export type ExternalPurchaseLotInput = {
  purchaseOrderId: string
  purchaseOrderCode: string
  purchaseOrderLineId: string
  lineNo: number
  requestId: string | null
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  receivedDate: string
  quantity: number
  note: string
  vendorName: string
  createdBy: string
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round3(value: number) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000
  return Number.isFinite(rounded) ? rounded : 0
}

function formatCompactDate(value: string) {
  const normalized = String(value || '').replaceAll('-', '')
  if (/^\d{8}$/.test(normalized)) return normalized.slice(2)
  return normalized
}

function sanitizeSegment(value: string) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function buildLengthCode(value: number) {
  const normalized = String(round3(value)).replace('.', '_')
  return `${normalized}M`
}

function buildLotCodeBase(input: ProductionLotInput) {
  const datePart = formatCompactDate(input.productionDate)
  const segmentPart = sanitizeSegment(input.tenDoan || 'DOAN')
  const lengthPart = buildLengthCode(input.chieuDaiM)
  return `LO-${datePart}-${segmentPart}-${lengthPart}`
}

function buildOpeningLotCodeBase(input: OpeningBalanceLotInput) {
  const datePart = formatCompactDate(input.openingDate)
  const segmentPart = sanitizeSegment(input.tenDoan || 'DOAN')
  const lengthPart = buildLengthCode(input.chieuDaiM)
  return `ODK-${datePart}-${segmentPart}-${lengthPart}`
}

function buildExternalPurchaseLotCodeBase(input: ExternalPurchaseLotInput) {
  const datePart = formatCompactDate(input.receivedDate)
  const segmentPart = sanitizeSegment(input.tenDoan || 'DOAN')
  const lengthPart = buildLengthCode(input.chieuDaiM)
  return `NCC-${datePart}-${segmentPart}-${lengthPart}`
}

function buildLotCode(baseCode: string, seq: number) {
  return `${baseCode}-L${String(seq).padStart(2, '0')}`
}

function extractLotSequence(lotCode: string, baseCode: string) {
  const match = normalizeText(lotCode).match(new RegExp(`^${baseCode}-L(\\d+)$`))
  return match ? Number(match[1]) || 0 : 0
}

function buildSerialCode(lotCode: string, seq: number) {
  return `${lotCode}-${String(seq).padStart(3, '0')}`
}

function buildOpeningBalanceSystemNote(countSheetCode: string, lineNo: number, userNote?: string) {
  const marker = `Mở tồn từ phiếu ${normalizeText(countSheetCode)} - dòng ${Math.max(Math.trunc(lineNo), 0)}`
  const normalizedUserNote = normalizeText(userNote)
  if (!normalizedUserNote) return marker
  if (normalizedUserNote.includes(marker)) return normalizedUserNote
  return `${marker} | ${normalizedUserNote}`
}

function buildExternalPurchaseSystemNote(
  purchaseOrderCode: string,
  vendorName: string,
  lineNo: number,
  userNote?: string
) {
  const marker = [
    normalizeText(purchaseOrderCode),
    normalizeText(vendorName) ? `NCC ${normalizeText(vendorName)}` : '',
  ]
    .filter(Boolean)
    .join(' - ')
  const normalizedUserNote = normalizeText(userNote)
  if (!normalizedUserNote) return marker
  if (normalizedUserNote.includes(marker)) return normalizedUserNote
  return `${marker} | ${normalizedUserNote}`
}

function compareLabelRows(
  a: { createdAt: string; lotCode: string; serialCode: string },
  b: { createdAt: string; lotCode: string; serialCode: string }
) {
  const createdAtCompare = normalizeText(a.createdAt).localeCompare(normalizeText(b.createdAt), 'vi')
  if (createdAtCompare !== 0) return createdAtCompare
  const lotCodeCompare = normalizeText(a.lotCode).localeCompare(normalizeText(b.lotCode), 'vi')
  if (lotCodeCompare !== 0) return lotCodeCompare
  return normalizeText(a.serialCode).localeCompare(normalizeText(b.serialCode), 'vi')
}

async function buildDisplaySequenceBySerialId(
  supabase: AnySupabase,
  labels: Array<{
    serialId: string
    serialCode: string
    loaiCoc: string
    tenDoan: string
    chieuDaiM: number
    productionDate: string
    lotCode: string
    createdAt: string
  }>
) {
  const sequenceBySerialId = new Map<string, number>()
  const scopedKeys = Array.from(
    new Set(
      labels.map((label) =>
        [
          normalizeText(label.loaiCoc),
          deriveStockSegmentGroup(label.tenDoan),
          String(round3(label.chieuDaiM)),
          normalizeText(label.productionDate),
        ].join('::')
      )
    )
  )

  if (!scopedKeys.length) return sequenceBySerialId

  const targetDates = Array.from(new Set(labels.map((label) => normalizeText(label.productionDate)).filter(Boolean)))
  const targetLoaiCoc = Array.from(new Set(labels.map((label) => normalizeText(label.loaiCoc)).filter(Boolean)))

  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, loai_coc, ten_doan, chieu_dai_m, production_lot!inner(lot_code, production_date, created_at)'
    )
    .in('production_lot.production_date', targetDates)
    .in('loai_coc', targetLoaiCoc)
    .eq('is_active', true)

  if (error) throw error

  const grouped = new Map<
    string,
    Array<{ serialId: string; serialCode: string; lotCode: string; createdAt: string }>
  >()

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const lot = (row.production_lot as Record<string, unknown> | null) || {}
    const key = [
      normalizeText(row.loai_coc),
      deriveStockSegmentGroup(normalizeText(row.ten_doan)),
      String(round3(toNumber(row.chieu_dai_m))),
      normalizeText(lot.production_date),
    ].join('::')

    if (!scopedKeys.includes(key)) continue

    const bucket = grouped.get(key) || []
    bucket.push({
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      lotCode: normalizeText(lot.lot_code),
      createdAt: normalizeText(lot.created_at),
    })
    grouped.set(key, bucket)
  }

  for (const rows of grouped.values()) {
    rows.sort(compareLabelRows)
    rows.forEach((row, index) => {
      sequenceBySerialId.set(row.serialId, index + 1)
    })
  }

  return sequenceBySerialId
}

type OpeningBalanceStatusPreset = {
  lifecycleStatus: string
  qcStatus: string
  dispositionStatus: string
  visibleInProject: boolean
  visibleInRetail: boolean
  locationCode: string
}

function resolveOpeningBalancePreset(qualityStatus: OpeningBalanceQualityStatus): OpeningBalanceStatusPreset {
  if (qualityStatus === 'LOI') {
    return {
      lifecycleStatus: 'TRONG_KHO',
      qcStatus: 'LOI',
      dispositionStatus: 'THANH_LY',
      visibleInProject: false,
      visibleInRetail: true,
      locationCode: 'KHU_LOI',
    }
  }

  return {
    lifecycleStatus: 'TRONG_KHO',
    qcStatus: 'DAT',
    dispositionStatus: 'BINH_THUONG',
    visibleInProject: true,
    visibleInRetail: true,
    locationCode: 'KHO_THANH_PHAM',
  }
}

function isMissingRelationError(error: unknown, relationName: string) {
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

export async function isPileSerialSchemaReady(supabase: AnySupabase) {
  const { error } = await supabase.from('production_lot').select('lot_id').limit(1)
  if (!error) return true
  if (isMissingRelationError(error, 'production_lot')) return false
  throw error
}

export async function generateLotsAndSerialsFromWarehouseIssue(
  supabase: AnySupabase,
  items: ProductionLotInput[]
): Promise<GenerateLotAndSerialResult> {
  const activeItems = items.filter(
    (item) =>
      normalizeText(item.planId) &&
      normalizeText(item.lineId) &&
      normalizeText(item.productionDate) &&
      normalizeText(item.loaiCoc) &&
      normalizeText(item.tenDoan) &&
      toNumber(item.actualQty) > 0
  )

  if (!activeItems.length) {
    return { generatedLotCount: 0, generatedSerialCount: 0, schemaReady: true }
  }

  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return { generatedLotCount: 0, generatedSerialCount: 0, schemaReady: false }
  }

  let generatedLotCount = 0
  let generatedSerialCount = 0

  for (const item of activeItems) {
    const lotPayload = {
      warehouse_issue_voucher_id: item.warehouseIssueVoucherId,
      plan_id: item.planId,
      plan_line_id: item.lineId,
      order_id: item.orderId,
      boc_id: item.bocId,
      quote_id: item.quoteId,
      loai_coc: item.loaiCoc,
      ten_doan: item.tenDoan,
      chieu_dai_m: round3(item.chieuDaiM),
      production_date: item.productionDate,
      actual_qty: Math.max(Math.trunc(item.actualQty), 0),
      lot_code: '',
      created_by: item.createdBy,
      updated_by: item.createdBy,
      is_active: true,
    }

    const { data: existingLot, error: existingLotError } = await supabase
      .from('production_lot')
      .select('lot_id, lot_code')
      .eq('warehouse_issue_voucher_id', item.warehouseIssueVoucherId)
      .eq('plan_line_id', item.lineId)
      .eq('is_active', true)
      .maybeSingle()

    if (existingLotError) throw existingLotError

    const lotCode = await (async () => {
      if (existingLot?.lot_code) return String(existingLot.lot_code)
      const baseCode = buildLotCodeBase(item)
      const { data: siblingLots, error: siblingLotsError } = await supabase
        .from('production_lot')
        .select('lot_code')
        .eq('production_date', item.productionDate)
        .eq('ten_doan', item.tenDoan)
        .eq('chieu_dai_m', round3(item.chieuDaiM))
        .eq('is_active', true)

      if (siblingLotsError) throw siblingLotsError

      const nextSeq =
        ((siblingLots ?? []) as Array<Record<string, unknown>>).reduce((maxSeq, row) => {
          return Math.max(maxSeq, extractLotSequence(String(row.lot_code || ''), baseCode))
        }, 0) + 1

      return buildLotCode(baseCode, nextSeq)
    })()

    lotPayload.lot_code = lotCode

    const lotQuery = existingLot?.lot_id
      ? supabase
          .from('production_lot')
          .update({
            ...lotPayload,
            created_by: undefined,
          })
          .eq('lot_id', existingLot.lot_id)
      : supabase.from('production_lot').insert(lotPayload)

    const { data: lotRow, error: lotError } = await lotQuery.select('lot_id').maybeSingle()

    if (lotError) throw lotError
    if (!lotRow?.lot_id) continue

    generatedLotCount += 1

    const lotId = String(lotRow.lot_id)
    const serialRows = Array.from({ length: Math.max(Math.trunc(item.actualQty), 0) }, (_, index) => ({
      serial_code: buildSerialCode(lotCode, index + 1),
      lot_id: lotId,
      warehouse_issue_voucher_id: item.warehouseIssueVoucherId,
      order_id: item.orderId,
      boc_id: item.bocId,
      quote_id: item.quoteId,
      loai_coc: item.loaiCoc,
      ten_doan: item.tenDoan,
      chieu_dai_m: round3(item.chieuDaiM),
      lifecycle_status: 'TRONG_KHU_CHO_QC',
      qc_status: 'CHUA_QC',
      disposition_status: 'BINH_THUONG',
      notes: null,
      is_active: true,
    }))

    if (serialRows.length) {
      const { error: serialError } = await supabase.from('pile_serial').upsert(serialRows, {
        onConflict: 'serial_code',
        ignoreDuplicates: false,
      })
      if (serialError) throw serialError
      generatedSerialCount += serialRows.length

      const { data: insertedSerials, error: insertedSerialError } = await supabase
        .from('pile_serial')
        .select('serial_id')
        .eq('lot_id', lotId)
        .eq('is_active', true)

      if (insertedSerialError) throw insertedSerialError

      const historyRows = (insertedSerials ?? []).map((row) => ({
        serial_id: String(row.serial_id),
        event_type: 'GENERATED_FROM_WAREHOUSE_ISSUE',
        to_lifecycle_status: 'TRONG_KHU_CHO_QC',
        to_qc_status: 'CHUA_QC',
        to_disposition_status: 'BINH_THUONG',
        ref_type: 'SX_XUAT_NVL',
        ref_id: item.warehouseIssueVoucherId,
        note: 'Sinh serial từ xác nhận thực sản xuất và xuất NVL',
        changed_by: item.createdBy,
      }))

      if (historyRows.length) {
        const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
        if (historyError) throw historyError
      }
    }
  }

  return { generatedLotCount, generatedSerialCount, schemaReady: true }
}

export async function loadProductionLotsByPlan(supabase: AnySupabase, planId: string): Promise<ProductionLotSummary[]> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const { data: lotRows, error: lotError } = await supabase
    .from('production_lot')
    .select('lot_id, lot_code, production_date, loai_coc, ten_doan, chieu_dai_m, actual_qty')
    .eq('plan_id', planId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (lotError) throw lotError
  const lots = (lotRows ?? []) as Array<Record<string, unknown>>
  if (!lots.length) return []

  const lotIds = lots.map((row) => String(row.lot_id || '')).filter(Boolean)
  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select('lot_id')
    .in('lot_id', lotIds)
    .eq('is_active', true)

  if (serialError) throw serialError
  const serialCountByLot = new Map<string, number>()
  for (const row of (serialRows ?? []) as Array<Record<string, unknown>>) {
    const lotId = String(row.lot_id || '')
    serialCountByLot.set(lotId, (serialCountByLot.get(lotId) ?? 0) + 1)
  }

  return lots.map((row) => ({
    lotId: String(row.lot_id || ''),
    lotCode: normalizeText(row.lot_code),
    productionDate: normalizeText(row.production_date),
    loaiCoc: normalizeText(row.loai_coc),
    tenDoan: normalizeText(row.ten_doan),
    chieuDaiM: round3(toNumber(row.chieu_dai_m)),
    actualQty: Math.max(Math.trunc(toNumber(row.actual_qty)), 0),
    serialCount: serialCountByLot.get(String(row.lot_id || '')) ?? 0,
  }))
}

export async function loadPrintableSerialLabelsByPlan(
  supabase: AnySupabase,
  planId: string
): Promise<PrintableSerialLabel[]> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, loai_coc, ten_doan, chieu_dai_m, production_lot!inner(lot_code, production_date, plan_id, created_at)'
    )
    .eq('production_lot.plan_id', planId)
    .eq('is_active', true)
    .order('serial_code', { ascending: true })

  if (error) throw error

  const labels = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const lot = (row.production_lot as Record<string, unknown> | null) || {}
    return {
      lotId: String(lot.lot_id || ''),
      lotCode: normalizeText(lot.lot_code),
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      loaiCoc: normalizeText(row.loai_coc),
      tenDoan: normalizeText(row.ten_doan),
      chieuDaiM: round3(toNumber(row.chieu_dai_m)),
      productionDate: normalizeText(lot.production_date),
      createdAt: normalizeText(lot.created_at),
      displaySequence: 0,
    }
  })

  const sequenceBySerialId = await buildDisplaySequenceBySerialId(supabase, labels)
  return labels.map((label) => ({
    ...label,
    displaySequence: sequenceBySerialId.get(label.serialId) || 0,
  }))
}

export async function loadPrintableSerialLabelsByLotId(
  supabase: AnySupabase,
  lotId: string
): Promise<PrintableSerialLabel[]> {
  return loadPrintableSerialLabelsByLotIds(supabase, [lotId])
}

export async function loadPrintableSerialLabelsByLotIds(
  supabase: AnySupabase,
  lotIds: string[]
): Promise<PrintableSerialLabel[]> {
  const normalizedLotIds = Array.from(new Set(lotIds.map((item) => String(item || '').trim()).filter(Boolean)))
  if (!normalizedLotIds.length) return []

  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const { data: lotRows, error: lotError } = await supabase
    .from('production_lot')
    .select('lot_id, lot_code, production_date, created_at')
    .in('lot_id', normalizedLotIds)
    .eq('is_active', true)

  if (lotError) throw lotError

  const lotMap = new Map<string, Record<string, unknown>>()
  for (const row of (lotRows ?? []) as Array<Record<string, unknown>>) {
    const lotId = normalizeText(row.lot_id)
    if (lotId) lotMap.set(lotId, row)
  }

  const existingLotIds = Array.from(lotMap.keys())
  if (!existingLotIds.length) return []

  const { data, error } = await supabase
    .from('pile_serial')
    .select('serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m')
    .in('lot_id', existingLotIds)
    .eq('is_active', true)
    .order('serial_code', { ascending: true })

  if (error) throw error

  const labels = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const lot = lotMap.get(normalizeText(row.lot_id)) || {}
    return {
      lotId: normalizeText(row.lot_id) || String(lot.lot_id || ''),
      lotCode: normalizeText(lot.lot_code),
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      loaiCoc: normalizeText(row.loai_coc),
      tenDoan: normalizeText(row.ten_doan),
      chieuDaiM: round3(toNumber(row.chieu_dai_m)),
      productionDate: normalizeText(lot.production_date),
      createdAt: normalizeText(lot.created_at),
      displaySequence: 0,
    }
  })

  const sequenceBySerialId = await buildDisplaySequenceBySerialId(supabase, labels)
  return labels.map((label) => ({
    ...label,
    displaySequence: sequenceBySerialId.get(label.serialId) || 0,
  }))
}

export async function loadPrintableSerialLabelsBySerialCodes(
  supabase: AnySupabase,
  serialCodes: string[]
): Promise<PrintableSerialLabel[]> {
  const normalizedCodes = Array.from(
    new Set(serialCodes.map((item) => normalizeText(item).toUpperCase()).filter(Boolean))
  )
  if (!normalizedCodes.length) return []

  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, production_lot!inner(lot_id, lot_code, production_date, created_at)'
    )
    .in('serial_code', normalizedCodes)
    .eq('is_active', true)
    .order('serial_code', { ascending: true })

  if (error) throw error

  const labels = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const lot = (row.production_lot as Record<string, unknown> | null) || {}
    return {
      lotId: normalizeText(row.lot_id) || normalizeText(lot.lot_id),
      lotCode: normalizeText(lot.lot_code),
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      loaiCoc: normalizeText(row.loai_coc),
      tenDoan: normalizeText(row.ten_doan),
      chieuDaiM: round3(toNumber(row.chieu_dai_m)),
      productionDate: normalizeText(lot.production_date),
      createdAt: normalizeText(lot.created_at),
      displaySequence: 0,
    }
  })

  const sequenceBySerialId = await buildDisplaySequenceBySerialId(supabase, labels)
  return labels.map((label) => ({
    ...label,
    displaySequence: sequenceBySerialId.get(label.serialId) || 0,
  }))
}

export async function loadSerialReprintSearchOptions(
  supabase: AnySupabase
): Promise<SerialReprintSearchOptions> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return { loaiCocOptions: [], tenDoanOptions: [] }

  const { data, error } = await supabase
    .from('pile_serial')
    .select('loai_coc, ten_doan')
    .eq('is_active', true)
    .limit(3000)

  if (error) throw error

  const loaiCocOptions = Array.from(
    new Set(((data ?? []) as Array<Record<string, unknown>>).map((row) => normalizeText(row.loai_coc)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'vi'))
  const tenDoanOptions = Array.from(
    new Set(
      ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => deriveStockSegmentGroup(normalizeText(row.ten_doan)))
        .filter((item) => item === 'MUI' || item === 'THAN')
    )
  ).sort((a, b) => a.localeCompare(b, 'vi'))

  return { loaiCocOptions, tenDoanOptions }
}

export async function searchPrintableSerialLabelsForReprint(
  supabase: AnySupabase,
  input: SerialReprintSearchInput
): Promise<PrintableSerialLabel[]> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const normalizedLoaiCoc = normalizeText(input.loaiCoc)
  const normalizedTenDoan = normalizeText(input.tenDoan)
  const normalizedTenDoanGroup = normalizedTenDoan ? deriveStockSegmentGroup(normalizedTenDoan) : ''
  const normalizedDate = normalizeText(input.productionDate)
  const length = round3(toNumber(input.chieuDaiM))
  const targetSequence = Math.max(Math.trunc(toNumber(input.displaySequence)), 0)

  if (!normalizedLoaiCoc && !normalizedTenDoan && !normalizedDate && !length && !targetSequence) return []

  let query = supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, production_lot!inner(lot_id, lot_code, production_date, created_at)'
    )
    .eq('is_active', true)
    .limit(500)

  if (normalizedLoaiCoc) query = query.eq('loai_coc', normalizedLoaiCoc)
  if (normalizedDate) query = query.eq('production_lot.production_date', normalizedDate)

  const { data, error } = await query
  if (error) throw error

  const labels = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const lot = (row.production_lot as Record<string, unknown> | null) || {}
      return {
        lotId: normalizeText(row.lot_id) || normalizeText(lot.lot_id),
        lotCode: normalizeText(lot.lot_code),
        serialId: String(row.serial_id || ''),
        serialCode: normalizeText(row.serial_code),
        loaiCoc: normalizeText(row.loai_coc),
        tenDoan: normalizeText(row.ten_doan),
        chieuDaiM: round3(toNumber(row.chieu_dai_m)),
        productionDate: normalizeText(lot.production_date),
        createdAt: normalizeText(lot.created_at),
        displaySequence: 0,
      }
    })
    .filter((label) => !normalizedTenDoanGroup || deriveStockSegmentGroup(label.tenDoan) === normalizedTenDoanGroup)
    .filter((label) => !length || Math.abs(label.chieuDaiM - length) < 0.001)

  const sequenceBySerialId = await buildDisplaySequenceBySerialId(supabase, labels)
  return labels
    .map((label) => ({
      ...label,
      displaySequence: sequenceBySerialId.get(label.serialId) || 0,
    }))
    .filter((label) => !targetSequence || label.displaySequence === targetSequence)
}

export async function createOpeningBalanceLotAndSerials(
  supabase: AnySupabase,
  input: OpeningBalanceLotInput
): Promise<CreateOpeningBalanceLotResult> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      lotId: '',
      lotCode: '',
      generatedSerialCount: 0,
    }
  }

  const normalizedLoaiCoc = normalizeText(input.loaiCoc)
  const normalizedTenDoan = normalizeText(input.tenDoan)
  const normalizedDate = normalizeText(input.openingDate)
  const quantity = Math.max(Math.trunc(toNumber(input.quantity)), 0)

  if (!normalizedLoaiCoc || !normalizedTenDoan || !normalizedDate || quantity <= 0) {
    throw new Error('Cần nhập đủ loại cọc, đoạn, ngày mở tồn và số lượng lớn hơn 0.')
  }

  const preset = resolveOpeningBalancePreset(input.qualityStatus)

  const { data: locationRows, error: locationError } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name')
    .eq('is_active', true)

  if (locationError) throw locationError

  const locationByCode = new Map<string, Record<string, unknown>>()
  const locationById = new Map<string, Record<string, unknown>>()
  for (const row of (locationRows ?? []) as Array<Record<string, unknown>>) {
    const locationCode = normalizeText(row.location_code)
    const locationId = String(row.location_id || '')
    if (locationCode) locationByCode.set(locationCode, row)
    if (locationId) locationById.set(locationId, row)
  }

  const resolvedLocation =
    (input.locationId ? locationById.get(String(input.locationId)) : null) || locationByCode.get(preset.locationCode) || null
  const resolvedLocationId = resolvedLocation ? String(resolvedLocation.location_id || '') : null

  const lotBaseCode = buildOpeningLotCodeBase(input)
  const { data: siblingLots, error: siblingLotsError } = await supabase
    .from('production_lot')
    .select('lot_code')
    .ilike('lot_code', `${lotBaseCode}-L%`)
    .eq('is_active', true)

  if (siblingLotsError) throw siblingLotsError

  const nextSeq =
    ((siblingLots ?? []) as Array<Record<string, unknown>>).reduce((maxSeq, row) => {
      return Math.max(maxSeq, extractLotSequence(String(row.lot_code || ''), lotBaseCode))
    }, 0) + 1

  const lotCode = buildLotCode(lotBaseCode, nextSeq)
  const lotPayload = {
    lot_code: lotCode,
    loai_coc: normalizedLoaiCoc,
    ten_doan: normalizedTenDoan,
    chieu_dai_m: round3(input.chieuDaiM),
    production_date: normalizedDate,
    actual_qty: quantity,
    created_by: input.createdBy,
    updated_by: input.createdBy,
    is_active: true,
  }

  const { data: lotRow, error: lotError } = await supabase
    .from('production_lot')
    .insert(lotPayload)
    .select('lot_id')
    .single()

  if (lotError) throw lotError

  const lotId = String(lotRow.lot_id || '')
  const serialRows = Array.from({ length: quantity }, (_, index) => ({
    serial_code: buildSerialCode(lotCode, index + 1),
    lot_id: lotId,
    loai_coc: normalizedLoaiCoc,
    ten_doan: normalizedTenDoan,
    chieu_dai_m: round3(input.chieuDaiM),
    lifecycle_status: preset.lifecycleStatus,
    qc_status: preset.qcStatus,
    disposition_status: preset.dispositionStatus,
    visible_in_project: preset.visibleInProject,
    visible_in_retail: preset.visibleInRetail,
    current_location_id: resolvedLocationId,
    notes: normalizeText(input.note) || null,
    is_active: true,
  }))

  const { error: serialError } = await supabase.from('pile_serial').insert(serialRows)
  if (serialError) throw serialError

  const { data: insertedSerials, error: insertedSerialError } = await supabase
    .from('pile_serial')
    .select('serial_id')
    .eq('lot_id', lotId)
    .eq('is_active', true)

  if (insertedSerialError) throw insertedSerialError

  const historyRows = (insertedSerials ?? []).map((row) => ({
    serial_id: String(row.serial_id || ''),
    event_type: 'OPENING_BALANCE_CREATED',
    to_lifecycle_status: preset.lifecycleStatus,
    to_qc_status: preset.qcStatus,
    to_disposition_status: preset.dispositionStatus,
    to_location_id: resolvedLocationId,
    ref_type: 'OPENING_BALANCE',
    ref_id: lotId,
    note: normalizeText(input.note) || 'Sinh serial từ tồn đầu kỳ thành phẩm',
    changed_by: input.createdBy,
  }))

  if (historyRows.length) {
    const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) throw historyError
  }

  if (resolvedLocationId && insertedSerials?.length) {
    const moveRows = insertedSerials.map((row) => ({
      serial_id: String(row.serial_id || ''),
      from_location_id: null,
      to_location_id: resolvedLocationId,
      moved_by: input.createdBy,
      note: 'Gán bãi khi mở tồn đầu kỳ thành phẩm',
    }))
    const { error: moveError } = await supabase.from('pile_serial_move').insert(moveRows)
    if (moveError) throw moveError
  }

  return {
    schemaReady: true,
    lotId,
    lotCode,
    generatedSerialCount: quantity,
  }
}

export async function createDraftOpeningBalanceLotAndSerials(
  supabase: AnySupabase,
  input: OpeningBalanceLotInput
): Promise<CreateOpeningBalanceLotResult> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      lotId: '',
      lotCode: '',
      generatedSerialCount: 0,
    }
  }

  const normalizedLoaiCoc = normalizeText(input.loaiCoc)
  const normalizedTenDoan = normalizeText(input.tenDoan)
  const normalizedDate = normalizeText(input.openingDate)
  const normalizedNote = normalizeText(input.note)
  const quantity = Math.max(Math.trunc(toNumber(input.quantity)), 0)

  if (!normalizedLoaiCoc || !normalizedTenDoan || !normalizedDate || quantity <= 0) {
    throw new Error('Cần nhập đủ loại cọc, đoạn, ngày mở tồn và số lượng lớn hơn 0.')
  }

  const draftPreset = {
    lifecycleStatus: 'CHO_DUYET_KIEM_KE',
    qcStatus: input.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
    dispositionStatus: input.qualityStatus === 'LOI' ? 'THANH_LY' : 'BINH_THUONG',
    locationCode: input.qualityStatus === 'LOI' ? 'KHU_LOI' : 'KHO_THANH_PHAM',
  }

  const { data: locationRows, error: locationError } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code')
    .eq('is_active', true)

  if (locationError) throw locationError

  const locationByCode = new Map<string, Record<string, unknown>>()
  const locationById = new Map<string, Record<string, unknown>>()
  for (const row of (locationRows ?? []) as Array<Record<string, unknown>>) {
    const locationCode = normalizeText(row.location_code)
    const locationId = String(row.location_id || '')
    if (locationCode) locationByCode.set(locationCode, row)
    if (locationId) locationById.set(locationId, row)
  }

  const resolvedLocation =
    (input.locationId ? locationById.get(String(input.locationId)) : null) ||
    locationByCode.get(draftPreset.locationCode) ||
    null
  const resolvedLocationId = resolvedLocation ? String(resolvedLocation.location_id || '') : null

  const lotBaseCode = buildOpeningLotCodeBase(input)
  const { data: siblingLots, error: siblingLotsError } = await supabase
    .from('production_lot')
    .select('lot_id, lot_code')
    .ilike('lot_code', `${lotBaseCode}-L%`)
    .eq('is_active', true)

  if (siblingLotsError) throw siblingLotsError

  const nextSeq =
    ((siblingLots ?? []) as Array<Record<string, unknown>>).reduce((maxSeq, row) => {
      return Math.max(maxSeq, extractLotSequence(String(row.lot_code || ''), lotBaseCode))
    }, 0) + 1

  const lotCode = buildLotCode(lotBaseCode, nextSeq)
  const { data: lotRow, error: lotError } = await supabase
    .from('production_lot')
    .insert({
      lot_code: lotCode,
      loai_coc: normalizedLoaiCoc,
      ten_doan: normalizedTenDoan,
      chieu_dai_m: round3(input.chieuDaiM),
      production_date: normalizedDate,
      actual_qty: quantity,
      created_by: input.createdBy,
      updated_by: input.createdBy,
      is_active: true,
    })
    .select('lot_id')
    .single()

  if (lotError) throw lotError

  const lotId = String(lotRow.lot_id || '')
  const serialRows = Array.from({ length: quantity }, (_, index) => ({
    serial_code: buildSerialCode(lotCode, index + 1),
    lot_id: lotId,
    loai_coc: normalizedLoaiCoc,
    ten_doan: normalizedTenDoan,
    chieu_dai_m: round3(input.chieuDaiM),
    lifecycle_status: draftPreset.lifecycleStatus,
    qc_status: draftPreset.qcStatus,
    disposition_status: draftPreset.dispositionStatus,
    visible_in_project: false,
    visible_in_retail: false,
    current_location_id: resolvedLocationId,
    notes: normalizedNote || null,
    is_active: true,
  }))

  const { error: serialError } = await supabase.from('pile_serial').insert(serialRows)
  if (serialError) throw serialError

  const { data: insertedSerials, error: insertedSerialError } = await supabase
    .from('pile_serial')
    .select('serial_id')
    .eq('lot_id', lotId)
    .eq('is_active', true)

  if (insertedSerialError) throw insertedSerialError

  const historyRows = (insertedSerials ?? []).map((row) => ({
    serial_id: String(row.serial_id || ''),
    event_type: 'OPENING_BALANCE_DRAFT_CREATED',
    to_lifecycle_status: draftPreset.lifecycleStatus,
    to_qc_status: draftPreset.qcStatus,
    to_disposition_status: draftPreset.dispositionStatus,
    to_location_id: resolvedLocationId,
    ref_type: 'OPENING_BALANCE',
    ref_id: lotId,
    note: normalizedNote || 'Sinh tem nháp từ phiếu mở tồn đầu kỳ',
    changed_by: input.createdBy,
  }))

  if (historyRows.length) {
    const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) throw historyError
  }

  return {
    schemaReady: true,
    lotId,
    lotCode,
    generatedSerialCount: quantity,
  }
}

export async function createExternalPurchaseLotAndSerials(
  supabase: AnySupabase,
  input: ExternalPurchaseLotInput
): Promise<CreateOpeningBalanceLotResult> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      lotId: '',
      lotCode: '',
      generatedSerialCount: 0,
    }
  }

  const normalizedLoaiCoc = normalizeText(input.loaiCoc)
  const normalizedTenDoan = normalizeText(input.tenDoan)
  const normalizedDate = normalizeText(input.receivedDate)
  const quantity = Math.max(Math.trunc(toNumber(input.quantity)), 0)
  if (!normalizedLoaiCoc || !normalizedTenDoan || !normalizedDate || quantity <= 0) {
    throw new Error('Thiếu dữ liệu để nhập kho cọc ngoài.')
  }

  const { data: locationRows, error: locationError } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code')
    .eq('is_active', true)

  if (locationError) throw locationError

  const finishedGoodsLocation = ((locationRows ?? []) as Array<Record<string, unknown>>).find(
    (row) => normalizeText(row.location_code) === 'KHO_THANH_PHAM'
  )
  const resolvedLocationId = finishedGoodsLocation ? String(finishedGoodsLocation.location_id || '') : null

  const lotBaseCode = buildExternalPurchaseLotCodeBase(input)
  const { data: siblingLots, error: siblingLotsError } = await supabase
    .from('production_lot')
    .select('lot_code')
    .ilike('lot_code', `${lotBaseCode}-L%`)
    .eq('is_active', true)

  if (siblingLotsError) throw siblingLotsError

  const nextSeq =
    ((siblingLots ?? []) as Array<Record<string, unknown>>).reduce((maxSeq, row) => {
      return Math.max(maxSeq, extractLotSequence(String(row.lot_code || ''), lotBaseCode))
    }, 0) + 1

  const lotCode = buildLotCode(lotBaseCode, nextSeq)
  const { data: lotRow, error: lotError } = await supabase
    .from('production_lot')
    .insert({
      lot_code: lotCode,
      loai_coc: normalizedLoaiCoc,
      ten_doan: normalizedTenDoan,
      chieu_dai_m: round3(input.chieuDaiM),
      production_date: normalizedDate,
      actual_qty: quantity,
      created_by: input.createdBy,
      updated_by: input.createdBy,
      is_active: true,
    })
    .select('lot_id')
    .single()

  if (lotError || !lotRow) throw lotError || new Error('Không tạo được lot cho cọc ngoài.')

  const lotId = String(lotRow.lot_id || '')
  const systemNote = buildExternalPurchaseSystemNote(
    input.purchaseOrderCode,
    input.vendorName,
    Math.max(Math.trunc(toNumber(input.lineNo)), 1),
    input.note
  )
  const serialRows = Array.from({ length: quantity }, (_, index) => ({
    serial_code: buildSerialCode(lotCode, index + 1),
    lot_id: lotId,
    loai_coc: normalizedLoaiCoc,
    ten_doan: normalizedTenDoan,
    chieu_dai_m: round3(input.chieuDaiM),
    lifecycle_status: 'TRONG_KHO',
    qc_status: 'DAT',
    disposition_status: 'BINH_THUONG',
    visible_in_project: true,
    visible_in_retail: true,
    current_location_id: resolvedLocationId,
    notes: systemNote,
    is_active: true,
  }))

  const { error: serialError } = await supabase.from('pile_serial').insert(serialRows)
  if (serialError) throw serialError

  const { data: insertedSerials, error: insertedSerialError } = await supabase
    .from('pile_serial')
    .select('serial_id')
    .eq('lot_id', lotId)
    .eq('is_active', true)

  if (insertedSerialError) throw insertedSerialError

  const historyRows = ((insertedSerials ?? []) as Array<Record<string, unknown>>).map((row) => ({
    serial_id: String(row.serial_id || ''),
    event_type: 'EXTERNAL_PURCHASE_RECEIVED',
    to_lifecycle_status: 'TRONG_KHO',
    to_qc_status: 'DAT',
    to_disposition_status: 'BINH_THUONG',
    to_location_id: resolvedLocationId,
    ref_type: 'EXTERNAL_PURCHASE',
    ref_id: input.purchaseOrderId,
    note: systemNote,
    changed_by: input.createdBy,
  }))

  if (historyRows.length) {
    const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) throw historyError
  }

  if (resolvedLocationId && historyRows.length) {
    const moveRows = historyRows.map((row) => ({
      serial_id: row.serial_id,
      from_location_id: null,
      to_location_id: resolvedLocationId,
      moved_by: input.createdBy,
      note: 'Nhập kho thành phẩm từ phiếu mua cọc ngoài',
    }))
    const { error: moveError } = await supabase.from('pile_serial_move').insert(moveRows)
    if (moveError) throw moveError
  }

  return {
    schemaReady: true,
    lotId,
    lotCode,
    generatedSerialCount: quantity,
  }
}

export async function activateDraftOpeningBalanceLots(input: {
  supabase: AnySupabase
  userId: string
  countSheetCode: string
  openingDate: string
  lines: Array<{
    lineNo: number
    loaiCoc: string
    tenDoan: string
    chieuDaiM: number
    quantity: number
    qualityStatus: OpeningBalanceQualityStatus
    locationId: string | null
    note: string
  }>
}): Promise<ActivateOpeningBalanceDraftResult> {
  const normalizedCode = normalizeText(input.countSheetCode)
  if (!normalizedCode) return { activatedLotCount: 0, activatedSerialCount: 0 }

  const lineByNo = new Map(
    input.lines.map((line) => [
      line.lineNo,
      {
        ...line,
        quantity: Math.max(Math.trunc(toNumber(line.quantity)), 0),
      },
    ])
  )

  const { data: draftSerialRows, error: draftSerialError } = await input.supabase
    .from('pile_serial')
    .select('serial_id, lot_id, notes')
    .ilike('notes', `%Mở tồn từ phiếu ${normalizedCode}%`)
    .eq('is_active', true)

  if (draftSerialError) throw draftSerialError

  const serialIdsToActivate: string[] = []
  const lotIdsToTouch = new Set<string>()
  const finalLocationBySerialId = new Map<string, string | null>()
  const historyRows: Array<Record<string, unknown>> = []

  for (const row of (draftSerialRows ?? []) as Array<Record<string, unknown>>) {
    const note = normalizeText(row.notes)
    const match = note.match(new RegExp(`Mở tồn từ phiếu\\s+${normalizedCode}\\s+-\\s+dòng\\s+(\\d+)`, 'i'))
    const lineNo = match?.[1] ? Number(match[1]) : 0
    const line = lineByNo.get(lineNo)
    if (!line || line.quantity <= 0) continue

    const preset = resolveOpeningBalancePreset(line.qualityStatus)
    const serialId = String(row.serial_id || '')
    if (!serialId) continue

    serialIdsToActivate.push(serialId)
    if (row.lot_id) lotIdsToTouch.add(String(row.lot_id))
    finalLocationBySerialId.set(serialId, line.locationId || null)
    historyRows.push({
      serial_id: serialId,
      event_type: 'OPENING_BALANCE_APPROVED',
      to_lifecycle_status: preset.lifecycleStatus,
      to_qc_status: preset.qcStatus,
      to_disposition_status: preset.dispositionStatus,
      to_location_id: line.locationId || null,
      ref_type: 'OPENING_BALANCE',
      ref_id: String(row.lot_id || ''),
      note: buildOpeningBalanceSystemNote(normalizedCode, lineNo, normalizeText(line.note) || note),
      changed_by: input.userId,
    })
  }

  if (!serialIdsToActivate.length) {
    return { activatedLotCount: 0, activatedSerialCount: 0 }
  }

  const { data: serialRowsToUpdate, error: serialRowsToUpdateError } = await input.supabase
    .from('pile_serial')
    .select('serial_id, notes')
    .in('serial_id', serialIdsToActivate)

  if (serialRowsToUpdateError) throw serialRowsToUpdateError

  for (const row of (serialRowsToUpdate ?? []) as Array<Record<string, unknown>>) {
    const serialId = String(row.serial_id || '')
    const note = normalizeText(row.notes)
    const match = note.match(new RegExp(`Mở tồn từ phiếu\\s+${normalizedCode}\\s+-\\s+dòng\\s+(\\d+)`, 'i'))
    const lineNo = match?.[1] ? Number(match[1]) : 0
    const line = lineByNo.get(lineNo)
    if (!line) continue
    const preset = resolveOpeningBalancePreset(line.qualityStatus)

    const { error: updateError } = await input.supabase
      .from('pile_serial')
      .update({
        lifecycle_status: preset.lifecycleStatus,
        qc_status: preset.qcStatus,
        disposition_status: preset.dispositionStatus,
        visible_in_project: preset.visibleInProject,
        visible_in_retail: preset.visibleInRetail,
        current_location_id: finalLocationBySerialId.get(serialId) ?? null,
        notes: buildOpeningBalanceSystemNote(normalizedCode, lineNo, normalizeText(line.note) || note),
      })
      .eq('serial_id', serialId)
    if (updateError) throw updateError
  }

  if (historyRows.length) {
    const { error: historyError } = await input.supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) throw historyError
  }

  return {
    activatedLotCount: lotIdsToTouch.size,
    activatedSerialCount: serialIdsToActivate.length,
  }
}

export async function loadOpeningBalanceLots(supabase: AnySupabase): Promise<OpeningBalanceLotSummary[]> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) return []

  const { data: lotRows, error: lotError } = await supabase
    .from('production_lot')
    .select('lot_id, lot_code, production_date, loai_coc, ten_doan, chieu_dai_m, actual_qty, created_at')
    .ilike('lot_code', 'ODK-%')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30)

  if (lotError) throw lotError

  const lots = (lotRows ?? []) as Array<Record<string, unknown>>
  if (!lots.length) return []

  const lotIds = lots.map((row) => String(row.lot_id || '')).filter(Boolean)
  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select('serial_id, lot_id, qc_status, current_location_id, notes')
    .in('lot_id', lotIds)
    .eq('is_active', true)

  if (serialError) throw serialError

  const locationIds = Array.from(
    new Set(((serialRows ?? []) as Array<Record<string, unknown>>).map((row) => String(row.current_location_id || '')).filter(Boolean))
  )

  const { data: locationRows, error: locationError } =
    locationIds.length > 0
      ? await supabase
          .from('warehouse_location')
          .select('location_id, location_code, location_name')
          .in('location_id', locationIds)
      : { data: [], error: null as unknown }

  if (locationError) throw locationError

  const locationMap = new Map<string, Record<string, unknown>>()
  for (const row of (locationRows ?? []) as Array<Record<string, unknown>>) {
    locationMap.set(String(row.location_id || ''), row)
  }

  const serialsByLot = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (serialRows ?? []) as Array<Record<string, unknown>>) {
    const lotId = String(row.lot_id || '')
    const bucket = serialsByLot.get(lotId) || []
    bucket.push(row)
    serialsByLot.set(lotId, bucket)
  }

  const countSheetCodeByLot = new Map<string, string>()
  for (const row of lots) {
    const lotId = String(row.lot_id || '')
    const serials = serialsByLot.get(lotId) || []
    const firstSerial = serials[0] || {}
    const note = normalizeText(firstSerial.notes)
    const match = note.match(/Mở tồn từ phiếu\s+(KK-TP-\d{8}-\d{6})\s+-\s+dòng\s+\d+/i)
    if (match?.[1]) {
      countSheetCodeByLot.set(lotId, normalizeText(match[1]))
    }
  }

  const countSheetCodes = Array.from(new Set(Array.from(countSheetCodeByLot.values()).filter(Boolean)))
  const countSheetByCode = new Map<string, { countSheetId: string; countSheetStatus: string }>()
  if (countSheetCodes.length) {
    const { data: countSheetRows, error: countSheetError } = await supabase
      .from('inventory_count_sheet')
      .select('count_sheet_id, count_sheet_code, status')
      .in('count_sheet_code', countSheetCodes)

    if (countSheetError) throw countSheetError

    for (const row of (countSheetRows ?? []) as Array<Record<string, unknown>>) {
      const countSheetCode = normalizeText(row.count_sheet_code)
      if (!countSheetCode) continue
      countSheetByCode.set(countSheetCode, {
        countSheetId: normalizeText(row.count_sheet_id),
        countSheetStatus: normalizeText(row.status),
      })
    }
  }

  return lots.map((row) => {
    const lotId = String(row.lot_id || '')
    const serials = serialsByLot.get(lotId) || []
    const firstSerial = serials[0] || {}
    const location = locationMap.get(String(firstSerial.current_location_id || '')) || {}
    const qcStatus = normalizeText(firstSerial.qc_status)
    const locationCode = normalizeText(location.location_code)
    const locationName = normalizeText(location.location_name)
    const countSheetCode = countSheetCodeByLot.get(lotId) || ''
    const countSheet = countSheetByCode.get(countSheetCode)

    return {
      lotId,
      lotCode: normalizeText(row.lot_code),
      countSheetId: countSheet?.countSheetId || '',
      countSheetCode,
      countSheetStatus: countSheet?.countSheetStatus || '',
      openingDate: normalizeText(row.production_date),
      loaiCoc: normalizeText(row.loai_coc),
      tenDoan: normalizeText(row.ten_doan),
      chieuDaiM: round3(toNumber(row.chieu_dai_m)),
      quantity: Math.max(Math.trunc(toNumber(row.actual_qty)), 0),
      qualityStatus: qcStatus === 'LOI' ? 'LOI' : 'DAT',
      locationLabel: locationCode || locationName ? `${locationCode}${locationCode && locationName ? ' · ' : ''}${locationName}` : 'Chưa gán',
      note: normalizeText(firstSerial.notes),
      serialCount: serials.length,
      createdAt: normalizeText(row.created_at),
    }
  })
}

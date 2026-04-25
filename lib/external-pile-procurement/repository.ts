import type { SupabaseClient } from '@supabase/supabase-js'
import { EXTERNAL_PILE_PROCUREMENT_DOMAIN, isExternalPileProcurementPayload } from '@/lib/external-pile-procurement/domain'
import type {
  ExternalPileLineDraft,
  ExternalPileOrderDetail,
  ExternalPileOrderLine,
  ExternalPileOrderStatus,
  ExternalPileOrderSummary,
  ExternalPileProcurementPageData,
  ExternalPileRequestLine,
  ExternalPileRequestStatus,
  ExternalPileRequestSummary,
} from '@/lib/external-pile-procurement/types'
import { createExternalPurchaseLotAndSerials, loadPrintableSerialLabelsByLotIds } from '@/lib/pile-serial/repository'

type AnySupabase = SupabaseClient

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function safeArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : []
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

async function buildRequestCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateToken = `${yy}${mm}${dd}`
  const prefix = `PR-COC-${dateToken}-`

  const { data, error } = await supabase
    .from('material_purchase_request')
    .select('request_code')
    .ilike('request_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of safeArray<Record<string, unknown>>(data)) {
    const requestCode = normalizeText(row.request_code)
    if (!requestCode.startsWith(prefix)) continue
    const suffix = requestCode.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

async function buildPoCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `PO-COC-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('material_purchase_order')
    .select('po_code')
    .ilike('po_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of safeArray<Record<string, unknown>>(data)) {
    const poCode = normalizeText(row.po_code)
    if (!poCode.startsWith(prefix)) continue
    const suffix = poCode.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

function buildItemLabel(loaiCoc: string, tenDoan: string, chieuDaiM: number) {
  return `${normalizeText(loaiCoc)} | ${normalizeText(tenDoan)} | ${round3(chieuDaiM)}m`
}

function mapRequestStatus(value: unknown): ExternalPileRequestStatus {
  const normalized = normalizeText(value).toUpperCase()
  if (
    normalized === 'CHO_DUYET' ||
    normalized === 'DA_DUYET' ||
    normalized === 'DA_CHUYEN_DAT_HANG' ||
    normalized === 'TU_CHOI'
  ) {
    return normalized
  }
  return 'DRAFT'
}

function mapOrderStatus(value: unknown): ExternalPileOrderStatus {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'DA_GUI_NCC' || normalized === 'DA_NHAN_MOT_PHAN' || normalized === 'DA_NHAN_DU' || normalized === 'HUY') {
    return normalized
  }
  return 'DRAFT'
}

async function loadLoaiCocOptions(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('dm_coc_template')
    .select('loai_coc')
    .eq('is_active', true)
    .order('loai_coc', { ascending: true })

  if (error) return []

  return Array.from(
    new Set(
      safeArray<Record<string, unknown>>(data)
        .map((row) => normalizeText(row.loai_coc))
        .filter(Boolean)
    )
  ).map((value) => ({ value, label: value }))
}

async function loadVendorOptions(supabase: AnySupabase) {
  const { data, error } = await supabase.from('dm_ncc').select('ncc_id, ten_ncc, is_active').limit(500)
  if (error) return []

  return safeArray<Record<string, unknown>>(data)
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      value: normalizeText(row.ncc_id),
      label: normalizeText(row.ten_ncc),
    }))
    .filter((row) => row.value && row.label)
}

export async function isExternalPileProcurementSchemaReady(supabase: AnySupabase) {
  const [requestHeader, requestLine, poHeader, poLine] = await Promise.all([
    supabase.from('material_purchase_request').select('request_id').limit(1),
    supabase.from('material_purchase_request_line').select('request_line_id').limit(1),
    supabase.from('material_purchase_order').select('po_id').limit(1),
    supabase.from('material_purchase_order_line').select('po_line_id').limit(1),
  ])

  return !requestHeader.error && !requestLine.error && !poHeader.error && !poLine.error
}

async function loadExternalRequestSummaries(supabase: AnySupabase): Promise<ExternalPileRequestSummary[]> {
  const { data: headerRows, error: headerError } = await supabase
    .from('material_purchase_request')
    .select('request_id, request_code, status, note, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(100)

  if (headerError) throw headerError

  const filteredHeaders = safeArray<Record<string, unknown>>(headerRows).filter((row) =>
    isExternalPileProcurementPayload(row.payload_json)
  )

  const requestIds = filteredHeaders.map((row) => normalizeText(row.request_id)).filter(Boolean)
  if (!requestIds.length) return []

  const { data: lineRows, error: lineError } = await supabase
    .from('material_purchase_request_line')
    .select('request_id, request_line_id, line_no, proposed_qty, reason, payload_json')
    .in('request_id', requestIds)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const lineBucket = new Map<string, ExternalPileRequestLine[]>()
  for (const row of safeArray<Record<string, unknown>>(lineRows)) {
    const requestId = normalizeText(row.request_id)
    if (!requestId) continue
    const payload = toRecord(row.payload_json)
    const loaiCoc = normalizeText(payload.loaiCoc)
    const tenDoan = normalizeText(payload.tenDoan)
    const chieuDaiM = round3(toNumber(payload.chieuDaiM))
    const lines = lineBucket.get(requestId) || []
    lines.push({
      requestLineId: normalizeText(row.request_line_id),
      lineNo: Math.max(Math.trunc(toNumber(row.line_no)), 1),
      loaiCoc,
      tenDoan,
      chieuDaiM,
      soLuongDeXuat: Math.max(Math.trunc(toNumber(row.proposed_qty)), 0),
      ghiChu: normalizeText(row.reason) || normalizeText(payload.ghiChu),
      itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    })
    lineBucket.set(requestId, lines)
  }

  return filteredHeaders.map((row) => {
    const requestId = normalizeText(row.request_id)
    const lines = lineBucket.get(requestId) || []
    return {
      requestId,
      requestCode: normalizeText(row.request_code) || requestId,
      status: mapRequestStatus(row.status),
      note: normalizeText(row.note),
      createdAt: normalizeText(row.created_at),
      totalQty: lines.reduce((sum, line) => sum + line.soLuongDeXuat, 0),
      lineCount: lines.length,
      lines,
    }
  })
}

async function loadExternalOrderSummaries(supabase: AnySupabase): Promise<ExternalPileOrderSummary[]> {
  const { data: headerRows, error: headerError } = await supabase
    .from('material_purchase_order')
    .select('po_id, po_code, request_id, request_code, vendor_name, expected_date, status, note, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(100)

  if (headerError) throw headerError

  const filteredHeaders = safeArray<Record<string, unknown>>(headerRows).filter((row) =>
    isExternalPileProcurementPayload(row.payload_json)
  )

  const poIds = filteredHeaders.map((row) => normalizeText(row.po_id)).filter(Boolean)
  if (!poIds.length) return []

  const { data: lineRows, error: lineError } = await supabase
    .from('material_purchase_order_line')
    .select('po_id, po_line_id, request_line_id, line_no, ordered_qty, reason, payload_json')
    .in('po_id', poIds)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const lineBucket = new Map<string, ExternalPileOrderLine[]>()
  for (const row of safeArray<Record<string, unknown>>(lineRows)) {
    const poId = normalizeText(row.po_id)
    if (!poId) continue
    const payload = toRecord(row.payload_json)
    const loaiCoc = normalizeText(payload.loaiCoc)
    const tenDoan = normalizeText(payload.tenDoan)
    const chieuDaiM = round3(toNumber(payload.chieuDaiM))
    const orderedQty = Math.max(Math.trunc(toNumber(row.ordered_qty)), 0)
    const receivedQty = Math.max(Math.trunc(toNumber(payload.receivedQty)), 0)
    const lines = lineBucket.get(poId) || []
    lines.push({
      poLineId: normalizeText(row.po_line_id),
      requestLineId: normalizeText(row.request_line_id),
      lineNo: Math.max(Math.trunc(toNumber(row.line_no)), 1),
      loaiCoc,
      tenDoan,
      chieuDaiM,
      orderedQty,
      receivedQty,
      remainingQty: Math.max(orderedQty - receivedQty, 0),
      ghiChu: normalizeText(row.reason) || normalizeText(payload.ghiChu),
      itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    })
    lineBucket.set(poId, lines)
  }

  return filteredHeaders.map((row) => {
    const poId = normalizeText(row.po_id)
    const payload = toRecord(row.payload_json)
    const lines = lineBucket.get(poId) || []
    return {
      poId,
      poCode: normalizeText(row.po_code) || poId,
      requestId: normalizeText(row.request_id),
      requestCode: normalizeText(row.request_code),
      vendorId: normalizeText(payload.vendorId),
      vendorName: normalizeText(row.vendor_name) || 'Chưa chọn NCC',
      expectedDate: normalizeText(row.expected_date),
      note: normalizeText(row.note),
      status: mapOrderStatus(row.status),
      createdAt: normalizeText(row.created_at),
      totalOrderedQty: lines.reduce((sum, line) => sum + line.orderedQty, 0),
      totalReceivedQty: lines.reduce((sum, line) => sum + line.receivedQty, 0),
      lineCount: lines.length,
      lines,
    }
  })
}

export async function loadExternalPileProcurementPageData(
  supabase: AnySupabase
): Promise<ExternalPileProcurementPageData> {
  const schemaReady = await isExternalPileProcurementSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      loaiCocOptions: [],
      vendorOptions: [],
      requestRows: [],
      orderRows: [],
    }
  }

  const [loaiCocOptions, vendorOptions, requestRows, orderRows] = await Promise.all([
    loadLoaiCocOptions(supabase),
    loadVendorOptions(supabase),
    loadExternalRequestSummaries(supabase),
    loadExternalOrderSummaries(supabase),
  ])

  return {
    schemaReady: true,
    loaiCocOptions,
    vendorOptions,
    requestRows,
    orderRows,
  }
}

export async function loadExternalPileOrderDetail(
  supabase: AnySupabase,
  poId: string
): Promise<ExternalPileOrderDetail | null> {
  const rows = await loadExternalOrderSummaries(supabase)
  const order = rows.find((row) => row.poId === poId) || null
  if (!order) return null
  const itemLabelByPoLineId = new Map(order.lines.map((line) => [line.poLineId, line.itemLabel] as const))
  const orderPayload = await loadExternalOrderPayload(supabase, poId)
  const poLots = await loadExternalPurchaseLotsByPo(supabase, poId)
  const receivedBatches = safeArray<Record<string, unknown>>(orderPayload.receivedBatches).map((batch) => {
    const items = safeArray<Record<string, unknown>>(batch.items).map((item) => ({
      poLineId: normalizeText(item.poLineId),
      itemLabel: itemLabelByPoLineId.get(normalizeText(item.poLineId)) || '-',
      receiveQty: Math.max(Math.trunc(toNumber(item.receiveQty)), 0),
      lotId: normalizeText(item.lotId),
      lotCode: normalizeText(item.lotCode),
    }))
    return {
      receivedAt: normalizeText(batch.receivedAt),
      receivedDate: normalizeText(batch.receivedDate),
      note: normalizeText(batch.note),
      totalReceivedQty: items.reduce((sum, item) => sum + item.receiveQty, 0),
      items,
    }
  })
  backfillMissingBatchLots(receivedBatches, poLots)
  const preferredLotIds = receivedBatches.flatMap((batch) => batch.items.map((item) => item.lotId).filter(Boolean))
  const printableLots = await loadExternalPurchasePrintableLots(supabase, poId, preferredLotIds)
  return { order, receivedBatches, printableLots }
}

async function loadExternalOrderPayload(supabase: AnySupabase, poId: string) {
  const { data, error } = await supabase
    .from('material_purchase_order')
    .select('payload_json')
    .eq('po_id', poId)
    .single()

  if (error || !data) throw error || new Error('Không tải được payload phiếu mua cọc ngoài.')
  return toRecord((data as Record<string, unknown>).payload_json)
}

async function loadExternalPurchasePrintableLots(supabase: AnySupabase, poId: string, preferredLotIds: string[]) {
  const lotIds = Array.from(new Set(preferredLotIds.map((item) => normalizeText(item)).filter(Boolean)))
  let resolvedLotIds = lotIds

  if (!resolvedLotIds.length) {
    const { data: historyRows, error: historyError } = await supabase
      .from('pile_serial_history')
      .select('serial_id')
      .eq('ref_type', 'EXTERNAL_PURCHASE')
      .eq('ref_id', poId)

    if (historyError) throw historyError

    const serialIds = Array.from(
      new Set(safeArray<Record<string, unknown>>(historyRows).map((row) => String(row.serial_id || '')).filter(Boolean))
    )

    if (serialIds.length) {
      const { data: serialRows, error: serialError } = await supabase
        .from('pile_serial')
        .select('lot_id')
        .in('serial_id', serialIds)
        .eq('is_active', true)

      if (serialError) throw serialError

      resolvedLotIds = Array.from(
        new Set(safeArray<Record<string, unknown>>(serialRows).map((row) => String(row.lot_id || '')).filter(Boolean))
      )
    }
  }

  if (!resolvedLotIds.length) return []

  const labels = await loadPrintableSerialLabelsByLotIds(supabase, resolvedLotIds)
  const lotMap = new Map<string, { lotId: string; lotCode: string; serialCount: number }>()
  for (const label of labels) {
    const current = lotMap.get(label.lotId)
    if (current) {
      current.serialCount += 1
      continue
    }
    lotMap.set(label.lotId, {
      lotId: label.lotId,
      lotCode: label.lotCode,
      serialCount: 1,
    })
  }

  return Array.from(lotMap.values()).sort((left, right) => left.lotCode.localeCompare(right.lotCode, 'vi'))
}

async function loadExternalPurchaseLotsByPo(supabase: AnySupabase, poId: string) {
  const { data: historyRows, error: historyError } = await supabase
    .from('pile_serial_history')
    .select('serial_id')
    .eq('ref_type', 'EXTERNAL_PURCHASE')
    .eq('ref_id', poId)

  if (historyError) throw historyError

  const serialIds = Array.from(
    new Set(safeArray<Record<string, unknown>>(historyRows).map((row) => String(row.serial_id || '')).filter(Boolean))
  )
  if (!serialIds.length) return []

  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select('serial_id, lot_id')
    .in('serial_id', serialIds)
    .eq('is_active', true)

  if (serialError) throw serialError

  const lotIds = Array.from(
    new Set(safeArray<Record<string, unknown>>(serialRows).map((row) => String(row.lot_id || '')).filter(Boolean))
  )
  if (!lotIds.length) return []

  const { data: lotRows, error: lotError } = await supabase
    .from('production_lot')
    .select('lot_id, lot_code, loai_coc, ten_doan, chieu_dai_m, actual_qty, created_at')
    .in('lot_id', lotIds)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (lotError) throw lotError

  return safeArray<Record<string, unknown>>(lotRows).map((row) => ({
    lotId: normalizeText(row.lot_id),
    lotCode: normalizeText(row.lot_code),
    itemLabel: buildItemLabel(
      normalizeText(row.loai_coc),
      normalizeText(row.ten_doan),
      round3(toNumber(row.chieu_dai_m))
    ),
    quantity: Math.max(Math.trunc(toNumber(row.actual_qty)), 0),
    createdAt: normalizeText(row.created_at),
  }))
}

function backfillMissingBatchLots(
  batches: Array<{
    items: Array<{ itemLabel: string; receiveQty: number; lotId: string; lotCode: string }>
  }>,
  lots: Array<{ lotId: string; lotCode: string; itemLabel: string; quantity: number; createdAt: string }>
) {
  if (!batches.length || !lots.length) return

  const remainingLots = [...lots].sort((left, right) => left.createdAt.localeCompare(right.createdAt, 'vi'))

  for (const batch of batches) {
    for (const item of batch.items) {
      if (item.lotId) continue
      const exactIndex = remainingLots.findIndex((lot) => lot.itemLabel === item.itemLabel && lot.quantity === item.receiveQty)
      const fallbackIndex = remainingLots.findIndex((lot) => lot.itemLabel === item.itemLabel)
      const lotIndex = exactIndex >= 0 ? exactIndex : fallbackIndex
      if (lotIndex < 0) continue
      const [matchedLot] = remainingLots.splice(lotIndex, 1)
      if (!matchedLot) continue
      item.lotId = matchedLot.lotId
      item.lotCode = matchedLot.lotCode
    }
  }
}

export async function createExternalPilePurchaseRequest(input: {
  supabase: AnySupabase
  userId: string
  note?: string
  lines: ExternalPileLineDraft[]
}) {
  const validLines = input.lines.filter(
    (line) =>
      normalizeText(line.loaiCoc) &&
      normalizeText(line.tenDoan) &&
      round3(toNumber(line.chieuDaiM)) > 0 &&
      Math.max(Math.trunc(toNumber(line.soLuong)), 0) > 0
  )

  if (!validLines.length) {
    throw new Error('Cần ít nhất 1 dòng cọc ngoài hợp lệ để gửi đề xuất mua.')
  }

  const requestCode = await buildRequestCode(input.supabase)
  const payloadJson = {
    inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
    createdFrom: 'EXTERNAL_PILE_PROCUREMENT',
    lineCount: validLines.length,
  }

  const { data: headerRow, error: headerError } = await input.supabase
    .from('material_purchase_request')
    .insert({
      request_code: requestCode,
      status: 'CHO_DUYET',
      source_mode: 'FULL',
      note: normalizeText(input.note) || null,
      payload_json: payloadJson,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('request_id, request_code')
    .single()

  if (headerError || !headerRow) throw headerError || new Error('Không tạo được đề xuất mua cọc ngoài.')

  const requestId = normalizeText((headerRow as Record<string, unknown>).request_id)
  if (!requestId) throw new Error('Không lấy được mã đề xuất mua cọc ngoài.')

  const { error: lineError } = await input.supabase.from('material_purchase_request_line').insert(
    validLines.map((line, index) => ({
      request_id: requestId,
      line_no: index + 1,
      material_code: buildItemLabel(line.loaiCoc, line.tenDoan, line.chieuDaiM),
      material_name: buildItemLabel(line.loaiCoc, line.tenDoan, line.chieuDaiM),
      unit: 'cây',
      proposed_qty: Math.max(Math.trunc(toNumber(line.soLuong)), 0),
      plan_count: 0,
      window_label: 'Cọc ngoài',
      basis_label: 'QLSX đề xuất mua cọc ngoài',
      urgency_label: 'Ngoài kế hoạch tự sản xuất',
      status: 'CHO_DUYET',
      source_mode: 'FULL',
      reason: normalizeText(line.ghiChu) || null,
      explanation: 'Mua cọc ngoài để nhập kho thành phẩm rồi xuất theo luồng hiện tại.',
      payload_json: {
        inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
        loaiCoc: normalizeText(line.loaiCoc),
        tenDoan: normalizeText(line.tenDoan),
        chieuDaiM: round3(toNumber(line.chieuDaiM)),
        ghiChu: normalizeText(line.ghiChu),
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (lineError) throw lineError

  return {
    requestId,
    requestCode: normalizeText((headerRow as Record<string, unknown>).request_code) || requestCode,
    lineCount: validLines.length,
  }
}

export async function approveExternalPilePurchaseRequest(input: {
  supabase: AnySupabase
  userId: string
  requestId: string
  vendorId: string
  vendorName: string
  expectedDate?: string
  note?: string
  lines?: Array<{ requestLineId: string; orderedQty: number }>
}) {
  if (!normalizeText(input.vendorId) || !normalizeText(input.vendorName)) {
    throw new Error('KTMH cần chọn nhà cung cấp trước khi lập phiếu mua cọc ngoài.')
  }

  const { data: requestHeader, error: requestHeaderError } = await input.supabase
    .from('material_purchase_request')
    .select('request_id, request_code, status, note, payload_json')
    .eq('request_id', input.requestId)
    .single()

  if (requestHeaderError || !requestHeader) throw requestHeaderError || new Error('Không tìm thấy đề xuất mua cọc ngoài.')
  if (!isExternalPileProcurementPayload((requestHeader as Record<string, unknown>).payload_json)) {
    throw new Error('Đây không phải đề xuất mua cọc ngoài.')
  }

  const currentStatus = mapRequestStatus((requestHeader as Record<string, unknown>).status)
  if (currentStatus === 'DA_CHUYEN_DAT_HANG') {
    throw new Error('Đề xuất này đã được chuyển thành phiếu mua.')
  }

  const { data: requestLineRows, error: requestLineError } = await input.supabase
    .from('material_purchase_request_line')
    .select('request_line_id, line_no, proposed_qty, reason, payload_json')
    .eq('request_id', input.requestId)
    .order('line_no', { ascending: true })

  if (requestLineError) throw requestLineError

  const requestLines = safeArray<Record<string, unknown>>(requestLineRows)
  if (!requestLines.length) {
    throw new Error('Đề xuất mua cọc ngoài chưa có dòng hàng hợp lệ.')
  }

  const orderedQtyByRequestLineId = new Map(
    safeArray(input.lines)
      .map((line) => [normalizeText(line.requestLineId), Math.max(Math.trunc(toNumber(line.orderedQty)), 0)] as const)
      .filter(([requestLineId]) => requestLineId)
  )

  const poCode = await buildPoCode(input.supabase)
  const orderPayload = {
    inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
    vendorId: normalizeText(input.vendorId),
    receivedBatches: [],
  }

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .insert({
      po_code: poCode,
      request_id: input.requestId,
      request_code: normalizeText((requestHeader as Record<string, unknown>).request_code),
      vendor_name: normalizeText(input.vendorName) || 'Chưa chọn NCC',
      expected_date: normalizeText(input.expectedDate) || null,
      status: 'DA_GUI_NCC',
      source_mode: 'FULL',
      note: normalizeText(input.note) || normalizeText((requestHeader as Record<string, unknown>).note) || null,
      payload_json: orderPayload,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('po_id, po_code')
    .single()

  if (poHeaderError || !poHeader) throw poHeaderError || new Error('Không tạo được phiếu mua cọc ngoài.')

  const poId = normalizeText((poHeader as Record<string, unknown>).po_id)
  if (!poId) throw new Error('Không lấy được mã phiếu mua cọc ngoài.')

  const { error: poLineError } = await input.supabase.from('material_purchase_order_line').insert(
    requestLines.map((row) => {
      const payload = toRecord(row.payload_json)
      const loaiCoc = normalizeText(payload.loaiCoc)
      const tenDoan = normalizeText(payload.tenDoan)
      const chieuDaiM = round3(toNumber(payload.chieuDaiM))
      const requestLineId = normalizeText(row.request_line_id)
      const orderedQty = orderedQtyByRequestLineId.has(requestLineId)
        ? orderedQtyByRequestLineId.get(requestLineId) || 0
        : Math.max(Math.trunc(toNumber(row.proposed_qty)), 0)
      return {
        po_id: poId,
        request_id: input.requestId,
        request_line_id: requestLineId,
        line_no: Math.max(Math.trunc(toNumber(row.line_no)), 1),
        material_code: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
        material_name: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
        unit: 'cây',
        ordered_qty: orderedQty,
        status: 'DA_GUI_NCC',
        source_mode: 'FULL',
        reason: normalizeText(row.reason) || null,
        payload_json: {
          inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
          loaiCoc,
          tenDoan,
          chieuDaiM,
          ghiChu: normalizeText(row.reason),
          receivedQty: 0,
        },
        created_by: input.userId,
        updated_by: input.userId,
      }
    })
  )

  if (poLineError) throw poLineError

  const { error: requestUpdateError } = await input.supabase
    .from('material_purchase_request')
    .update({
      status: 'DA_CHUYEN_DAT_HANG',
      updated_by: input.userId,
      payload_json: {
        ...toRecord((requestHeader as Record<string, unknown>).payload_json),
        inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
        approvedBy: input.userId,
        approvedAt: new Date().toISOString(),
        poId,
        poCode,
      },
    })
    .eq('request_id', input.requestId)

  if (requestUpdateError) throw requestUpdateError

  const { error: requestLineUpdateError } = await input.supabase
    .from('material_purchase_request_line')
    .update({
      status: 'DA_CHUYEN_DAT_HANG',
      updated_by: input.userId,
    })
    .eq('request_id', input.requestId)

  if (requestLineUpdateError) throw requestLineUpdateError

  return {
    poId,
    poCode: normalizeText((poHeader as Record<string, unknown>).po_code) || poCode,
    lineCount: requestLines.length,
  }
}

export async function receiveExternalPilePurchaseOrder(input: {
  supabase: AnySupabase
  userId: string
  poId: string
  receiveDate: string
  note?: string
  items: Array<{ poLineId: string; receiveQty: number }>
}) {
  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .select('po_id, po_code, request_id, request_code, vendor_name, status, note, payload_json')
    .eq('po_id', input.poId)
    .single()

  if (poHeaderError || !poHeader) throw poHeaderError || new Error('Không tìm thấy phiếu mua cọc ngoài.')
  if (!isExternalPileProcurementPayload((poHeader as Record<string, unknown>).payload_json)) {
    throw new Error('Đây không phải phiếu mua cọc ngoài.')
  }

  const poCode = normalizeText((poHeader as Record<string, unknown>).po_code)
  const requestId = normalizeText((poHeader as Record<string, unknown>).request_id)
  const vendorName = normalizeText((poHeader as Record<string, unknown>).vendor_name)
  const receiveDate = normalizeText(input.receiveDate)
  if (!receiveDate) throw new Error('Cần chọn ngày nhập kho.')

  const requestedReceiveMap = new Map(
    input.items
      .map((item) => [normalizeText(item.poLineId), Math.max(Math.trunc(toNumber(item.receiveQty)), 0)] as const)
      .filter(([poLineId, receiveQty]) => poLineId && receiveQty > 0)
  )
  if (!requestedReceiveMap.size) {
    throw new Error('Cần nhập ít nhất 1 dòng số lượng nhập kho lớn hơn 0.')
  }

  const { data: poLineRows, error: poLineError } = await input.supabase
    .from('material_purchase_order_line')
    .select('po_line_id, line_no, ordered_qty, reason, payload_json')
    .eq('po_id', input.poId)
    .order('line_no', { ascending: true })

  if (poLineError) throw poLineError

  const updates: Array<{ poLineId: string; payload: Record<string, unknown>; status: ExternalPileOrderStatus }> = []
  const batchItems: Array<{ poLineId: string; receiveQty: number; lotId: string; lotCode: string }> = []
  const createdLots: string[] = []

  for (const row of safeArray<Record<string, unknown>>(poLineRows)) {
    const poLineId = normalizeText(row.po_line_id)
    if (!poLineId) continue
    const orderedQty = Math.max(Math.trunc(toNumber(row.ordered_qty)), 0)
    const payload = toRecord(row.payload_json)
    const currentReceivedQty = Math.max(Math.trunc(toNumber(payload.receivedQty)), 0)
    const batchReceiveQty = requestedReceiveMap.get(poLineId) || 0
    if (!batchReceiveQty) {
      updates.push({
        poLineId,
        payload,
        status: currentReceivedQty >= orderedQty && orderedQty > 0 ? 'DA_NHAN_DU' : currentReceivedQty > 0 ? 'DA_NHAN_MOT_PHAN' : 'DA_GUI_NCC',
      })
      continue
    }

    if (currentReceivedQty + batchReceiveQty > orderedQty) {
      throw new Error(`Dòng ${Math.max(Math.trunc(toNumber(row.line_no)), 1)} đang nhập vượt số lượng đã đặt.`)
    }

    const result = await createExternalPurchaseLotAndSerials(input.supabase, {
      purchaseOrderId: input.poId,
      purchaseOrderCode: poCode,
      purchaseOrderLineId: poLineId,
      lineNo: Math.max(Math.trunc(toNumber(row.line_no)), 1),
      requestId,
      loaiCoc: normalizeText(payload.loaiCoc),
      tenDoan: normalizeText(payload.tenDoan),
      chieuDaiM: round3(toNumber(payload.chieuDaiM)),
      receivedDate: receiveDate,
      quantity: batchReceiveQty,
      note: normalizeText(input.note) || normalizeText(row.reason) || normalizeText((poHeader as Record<string, unknown>).note),
      vendorName,
      createdBy: input.userId,
    })

    if (result.lotId) createdLots.push(result.lotId)
    batchItems.push({
      poLineId,
      receiveQty: batchReceiveQty,
      lotId: result.lotId,
      lotCode: result.lotCode,
    })

    const nextReceivedQty = currentReceivedQty + batchReceiveQty
    updates.push({
      poLineId,
      payload: {
        ...payload,
        inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
        receivedQty: nextReceivedQty,
        lastReceivedQty: batchReceiveQty,
        lastReceivedAt: new Date().toISOString(),
        lastReceivedDate: receiveDate,
      },
      status: nextReceivedQty >= orderedQty && orderedQty > 0 ? 'DA_NHAN_DU' : 'DA_NHAN_MOT_PHAN',
    })
  }

  for (const update of updates) {
    const { error } = await input.supabase
      .from('material_purchase_order_line')
      .update({
        payload_json: update.payload,
        status: update.status,
        updated_by: input.userId,
      })
      .eq('po_line_id', update.poLineId)

    if (error) throw error
  }

  const totalOrderedQty = safeArray<Record<string, unknown>>(poLineRows).reduce(
    (sum, row) => sum + Math.max(Math.trunc(toNumber(row.ordered_qty)), 0),
    0
  )
  const totalReceivedQty = updates.reduce((sum, item) => sum + Math.max(Math.trunc(toNumber(item.payload.receivedQty)), 0), 0)
  const nextStatus: ExternalPileOrderStatus =
    totalReceivedQty >= totalOrderedQty && totalOrderedQty > 0 ? 'DA_NHAN_DU' : totalReceivedQty > 0 ? 'DA_NHAN_MOT_PHAN' : 'DA_GUI_NCC'

  const currentHeaderPayload = toRecord((poHeader as Record<string, unknown>).payload_json)
  const receivedBatches = safeArray<Record<string, unknown>>(currentHeaderPayload.receivedBatches)
  receivedBatches.push({
    receivedAt: new Date().toISOString(),
    receivedDate: receiveDate,
    note: normalizeText(input.note),
    items: batchItems,
  })

  const { error: poUpdateError } = await input.supabase
    .from('material_purchase_order')
    .update({
      status: nextStatus,
      note: normalizeText(input.note) || normalizeText((poHeader as Record<string, unknown>).note) || null,
      payload_json: {
        ...currentHeaderPayload,
        inventoryDomain: EXTERNAL_PILE_PROCUREMENT_DOMAIN,
        vendorName,
        receivedDate: receiveDate,
        receivedBatches,
        totalReceivedQty,
      },
      updated_by: input.userId,
    })
    .eq('po_id', input.poId)

  if (poUpdateError) throw poUpdateError

  const printableLabels = createdLots.length
    ? await loadPrintableSerialLabelsByLotIds(input.supabase, createdLots)
    : []

  return {
    poId: input.poId,
    poCode,
    status: nextStatus,
    totalReceivedQty,
    createdLotCount: createdLots.length,
    createdSerialCount: printableLabels.length,
  }
}

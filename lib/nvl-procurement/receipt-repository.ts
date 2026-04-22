import type { SupabaseClient } from '@supabase/supabase-js'
import type { NvlReceiptDetail, NvlReceiptSummaryRow } from '@/lib/nvl-procurement/types'

type AnySupabase = SupabaseClient

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

function toNumber(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function resolveVarianceDisposition(varianceQty: number, variancePct: number, haoHutPct = 0) {
  if (Math.abs(varianceQty) <= 0.0001) return 'KHONG_CHENH_LECH' as const
  return variancePct <= haoHutPct ? ('CHI_PHI_DOANH_NGHIEP' as const) : ('CHI_PHI_THAT_THOAT' as const)
}

async function buildReceiptCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `RCV-NVL-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('material_purchase_receipt')
    .select('receipt_code')
    .ilike('receipt_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const receiptCode = String(row.receipt_code || '').trim()
    if (!receiptCode.startsWith(prefix)) continue
    const suffix = receiptCode.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

export async function isReceiptSchemaReady(supabase: AnySupabase) {
  const [headerResult, lineResult] = await Promise.all([
    supabase.from('material_purchase_receipt').select('receipt_id').limit(1),
    supabase.from('material_purchase_receipt_line').select('receipt_line_id').limit(1),
  ])

  if (!headerResult.error && !lineResult.error) return true
  if (
    (headerResult.error && isMissingRelationError(headerResult.error, 'material_purchase_receipt')) ||
    (lineResult.error && isMissingRelationError(lineResult.error, 'material_purchase_receipt_line'))
  ) {
    return false
  }

  if (headerResult.error) throw headerResult.error
  if (lineResult.error) throw lineResult.error
  return true
}

export async function loadReceiptSummaries(
  supabase: AnySupabase
): Promise<{ schemaReady: boolean; rows: NvlReceiptSummaryRow[] }> {
  const schemaReady = await isReceiptSchemaReady(supabase)
  if (!schemaReady) return { schemaReady: false, rows: [] }

  const { data: headerRows, error: headerError } = await supabase
    .from('material_purchase_receipt')
    .select('receipt_id, receipt_code, po_id, po_code, vendor_name, status, batch_no, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(30)

  if (headerError) throw headerError

  const receiptIds = ((headerRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.receipt_id || ''))
    .filter(Boolean)

  if (!receiptIds.length) return { schemaReady: true, rows: [] }

  const { data: movementRows, error: movementError } = await supabase
    .from('material_stock_movement')
    .select('source_id')
    .eq('source_type', 'PURCHASE_RECEIPT')
    .in('source_id', receiptIds)

  if (movementError && !isMissingRelationError(movementError, 'material_stock_movement')) {
    throw movementError
  }

  const movementReceiptIds = new Set(
    ((movementRows ?? []) as Array<Record<string, unknown>>).map((row) => String(row.source_id || '')).filter(Boolean)
  )

  const { data: lineRows, error: lineError } = await supabase
    .from('material_purchase_receipt_line')
    .select('receipt_id, received_qty, accepted_qty, defective_qty, rejected_qty, payload_json')
    .in('receipt_id', receiptIds)

  if (lineError) throw lineError

  const lineBucket = new Map<
    string,
    {
      lineCount: number
      totalReceivedQty: number
      totalAcceptedQty: number
      totalDefectiveQty: number
      totalRejectedQty: number
      totalBilledQty: number
      totalAmount: number
    }
  >()

  for (const rawRow of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const receiptId = String(rawRow.receipt_id || '')
    if (!receiptId) continue
    const current = lineBucket.get(receiptId) || {
      lineCount: 0,
      totalReceivedQty: 0,
      totalAcceptedQty: 0,
      totalDefectiveQty: 0,
      totalRejectedQty: 0,
      totalBilledQty: 0,
      totalAmount: 0,
    }
    const payload = toRecord(rawRow.payload_json)
    current.lineCount += 1
    current.totalReceivedQty += toNumber(rawRow.received_qty)
    current.totalAcceptedQty += toNumber(rawRow.accepted_qty)
    current.totalDefectiveQty += toNumber(rawRow.defective_qty)
    current.totalRejectedQty += toNumber(rawRow.rejected_qty)
    current.totalBilledQty += toNumber(payload.billedQty)
    current.totalAmount += toNumber(payload.lineAmount)
    lineBucket.set(receiptId, current)
  }

  const rows: NvlReceiptSummaryRow[] = ((headerRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const receiptId = String(row.receipt_id || '')
    const totals = lineBucket.get(receiptId) || {
      lineCount: 0,
      totalReceivedQty: 0,
      totalAcceptedQty: 0,
      totalDefectiveQty: 0,
      totalRejectedQty: 0,
      totalBilledQty: 0,
      totalAmount: 0,
    }
    const headerPayload = toRecord(row.payload_json)
    return {
      receiptId,
      receiptCode: String(row.receipt_code || receiptId || '-'),
      poId: String(row.po_id || ''),
      poCode: String(row.po_code || '-'),
      vendorName: String(row.vendor_name || 'Chưa chọn NCC'),
      status:
        row.status === 'DA_NHAN' || row.status === 'DA_NHAN_MOT_PHAN' || row.status === 'DA_XU_LY_LOI'
          ? row.status
          : 'DRAFT',
      batchNo: Math.max(1, toNumber(row.batch_no)),
      lineCount: totals.lineCount,
      totalReceivedQty: Math.round(totals.totalReceivedQty * 1000) / 1000,
      totalAcceptedQty: Math.round(totals.totalAcceptedQty * 1000) / 1000,
      totalDefectiveQty: Math.round(totals.totalDefectiveQty * 1000) / 1000,
      totalRejectedQty: Math.round(totals.totalRejectedQty * 1000) / 1000,
      totalBilledQty: Math.round(totals.totalBilledQty * 1000) / 1000,
      totalAmount: Math.round(totals.totalAmount * 100) / 100,
      settlementStatus: String(headerPayload.settlementStatus || '').toUpperCase() === 'DA_CHOT' ? 'DA_CHOT' : 'CHUA_CHOT',
      movementRecorded: movementReceiptIds.has(receiptId),
      createdAt: String(row.created_at || ''),
      settledAt: String(headerPayload.settledAt || ''),
    }
  })

  return { schemaReady: true, rows }
}

export async function createReceiptDraftFromPurchaseOrder(input: {
  supabase: AnySupabase
  userId: string
  poId: string
}) {
  const schemaReady = await isReceiptSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error(
      'Schema receipt NVL chưa sẵn sàng. Cần tạo bảng material_purchase_receipt và material_purchase_receipt_line trước.'
    )
  }

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .select('po_id, po_code, vendor_name, status')
    .eq('po_id', input.poId)
    .single()

  if (poHeaderError || !poHeader) {
    throw poHeaderError || new Error('Không tìm thấy draft PO để tạo receipt.')
  }
  const poStatus = String((poHeader as Record<string, unknown>).status || '').toUpperCase()
  if (poStatus === 'XAC_NHAN_MOT_PHAN' || poStatus === 'DA_NHAN_DU' || poStatus === 'HUY') {
    throw new Error('Phiếu mua này đã kết thúc nhận hàng hoặc đã khóa, không thể tạo thêm phiếu nhập.')
  }

  const { data: poLines, error: poLineError } = await input.supabase
    .from('material_purchase_order_line')
    .select('po_line_id, line_no, material_code, material_name, unit, ordered_qty, status, source_mode, reason, payload_json')
    .eq('po_id', input.poId)
    .order('line_no', { ascending: true })

  if (poLineError) throw poLineError

  const lines = ((poLines ?? []) as Array<Record<string, unknown>>).filter((row) => toNumber(row.ordered_qty) > 0)
  if (!lines.length) {
    throw new Error('Draft PO không có dòng hợp lệ để tạo receipt.')
  }

  const { count: existingBatchCount, error: countError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id', { count: 'exact', head: true })
    .eq('po_id', input.poId)

  if (countError) throw countError

  const batchNo = Number(existingBatchCount || 0) + 1
  const receiptCode = await buildReceiptCode(input.supabase)
  const poCode = String((poHeader as Record<string, unknown>).po_code || '')
  const vendorName = String((poHeader as Record<string, unknown>).vendor_name || 'Chưa chọn NCC')

  const { data: receiptHeader, error: receiptHeaderError } = await input.supabase
    .from('material_purchase_receipt')
    .insert({
      receipt_code: receiptCode,
      po_id: input.poId,
      po_code: poCode,
      vendor_name: vendorName,
      batch_no: batchNo,
      status: 'DRAFT',
      note: `Tạo từ PO ${poCode}, đợt ${batchNo}.`,
      payload_json: {
        createdFromPoId: input.poId,
        createdFromPoCode: poCode,
        batchNo,
      },
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('receipt_id, receipt_code')
    .single()

  if (receiptHeaderError || !receiptHeader) throw receiptHeaderError || new Error('Không tạo được draft receipt NVL.')

  const receiptId = String((receiptHeader as Record<string, unknown>).receipt_id || '')
  if (!receiptId) throw new Error('Không lấy được receipt_id sau khi tạo draft receipt NVL.')

  const { error: receiptLineError } = await input.supabase.from('material_purchase_receipt_line').insert(
    lines.map((row) => ({
      receipt_id: receiptId,
      po_id: input.poId,
      po_line_id: String(row.po_line_id || ''),
      line_no: toNumber(row.line_no),
      material_code: String(row.material_code || ''),
      material_name: String(row.material_name || ''),
      unit: String(row.unit || ''),
      ordered_qty: toNumber(row.ordered_qty),
      received_qty: 0,
      accepted_qty: 0,
      defective_qty: 0,
      rejected_qty: 0,
      status: 'DRAFT',
      source_mode: String(row.source_mode || '') === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
      reason: String(row.reason || ''),
      payload_json:
        row.payload_json && typeof row.payload_json === 'object'
          ? row.payload_json
          : {},
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (receiptLineError) throw receiptLineError

  await input.supabase
    .from('material_purchase_order')
    .update({
      status: 'DA_NHAN_MOT_PHAN',
      updated_by: input.userId,
    })
    .eq('po_id', input.poId)

  return {
    receiptId,
    receiptCode: String((receiptHeader as Record<string, unknown>).receipt_code || receiptCode),
    lineCount: lines.length,
    batchNo,
  }
}

export async function loadReceiptDetail(input: {
  supabase: AnySupabase
  receiptId: string
}): Promise<NvlReceiptDetail | null> {
  const schemaReady = await isReceiptSchemaReady(input.supabase)
  if (!schemaReady) return null

  const { data: headerRow, error: headerError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id, receipt_code, po_id, po_code, vendor_name, batch_no, status, note, created_at, payload_json')
    .eq('receipt_id', input.receiptId)
    .single()

  if (headerError) {
    if (isMissingRelationError(headerError, 'material_purchase_receipt')) return null
    throw headerError
  }
  if (!headerRow) return null

  const { data: movementRows, error: movementError } = await input.supabase
    .from('material_stock_movement')
    .select('movement_id')
    .eq('source_type', 'PURCHASE_RECEIPT')
    .eq('source_id', input.receiptId)
    .limit(1)

  if (movementError && !isMissingRelationError(movementError, 'material_stock_movement')) {
    throw movementError
  }

  const { data: lineRows, error: lineError } = await input.supabase
    .from('material_purchase_receipt_line')
    .select(
      'receipt_line_id, line_no, material_code, material_name, unit, ordered_qty, received_qty, accepted_qty, defective_qty, rejected_qty, status, payload_json'
    )
    .eq('receipt_id', input.receiptId)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const headerPayload = toRecord((headerRow as Record<string, unknown>).payload_json)
  const parsedLines = ((lineRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const payload = toRecord(row.payload_json)
    const billedQty = toNumber(payload.billedQty)
    const unitPrice = toNumber(payload.unitPrice)
    const lineAmount = toNumber(payload.lineAmount)
    const varianceQty = toNumber(payload.varianceQty)
    const variancePct = toNumber(payload.variancePct)
    const varianceDisposition =
      String(payload.varianceDisposition || '') === 'CHI_PHI_DOANH_NGHIEP' ||
      String(payload.varianceDisposition || '') === 'CHI_PHI_THAT_THOAT' ||
      String(payload.varianceDisposition || '') === 'KHONG_CHENH_LECH'
        ? (String(payload.varianceDisposition) as NvlReceiptDetail['lines'][number]['varianceDisposition'])
        : resolveVarianceDisposition(varianceQty, variancePct)

    return {
      receiptLineId: String(row.receipt_line_id || ''),
      lineNo: toNumber(row.line_no),
      materialCode: String(row.material_code || ''),
      materialName: String(row.material_name || row.material_code || ''),
      unit: String(row.unit || ''),
      orderedQty: toNumber(row.ordered_qty),
      receivedQty: toNumber(row.received_qty),
      acceptedQty: toNumber(row.accepted_qty),
      defectiveQty: toNumber(row.defective_qty),
      rejectedQty: toNumber(row.rejected_qty),
      status:
        String(row.status || '').toUpperCase() === 'DA_NHAN'
          ? 'DA_NHAN'
          : String(row.status || '').toUpperCase() === 'DA_NHAN_MOT_PHAN'
            ? 'DA_NHAN_MOT_PHAN'
            : String(row.status || '').toUpperCase() === 'DA_XU_LY_LOI'
              ? 'DA_XU_LY_LOI'
              : 'DRAFT',
      billedQty,
      unitPrice,
      lineAmount,
      varianceQty,
      variancePct,
      varianceDisposition,
    }
  })

  return {
    receiptId: String((headerRow as Record<string, unknown>).receipt_id || ''),
    receiptCode: String((headerRow as Record<string, unknown>).receipt_code || ''),
    poId: String((headerRow as Record<string, unknown>).po_id || ''),
    poCode: String((headerRow as Record<string, unknown>).po_code || ''),
    vendorName: String((headerRow as Record<string, unknown>).vendor_name || 'Chưa chọn NCC'),
    batchNo: Math.max(1, toNumber((headerRow as Record<string, unknown>).batch_no)),
    status:
      (String((headerRow as Record<string, unknown>).status || '').toUpperCase() as NvlReceiptDetail['status']) || 'DRAFT',
    note: String((headerRow as Record<string, unknown>).note || ''),
    createdAt: String((headerRow as Record<string, unknown>).created_at || ''),
    movementRecorded: (movementRows ?? []).length > 0,
    settlementStatus: String(headerPayload.settlementStatus || '').toUpperCase() === 'DA_CHOT' ? 'DA_CHOT' : 'CHUA_CHOT',
    settledAt: String(headerPayload.settledAt || ''),
    totalBilledQty: Math.round(parsedLines.reduce((sum, line) => sum + line.billedQty, 0) * 1000) / 1000,
    totalAmount: Math.round(parsedLines.reduce((sum, line) => sum + line.lineAmount, 0) * 100) / 100,
    lines: parsedLines,
  }
}

export async function saveReceiptDraft(input: {
  supabase: AnySupabase
  userId: string
  receiptId: string
  note?: string
  lines: Array<{
    receiptLineId: string
    receivedQty: number
    acceptedQty: number
    defectiveQty: number
    rejectedQty: number
  }>
}) {
  const schemaReady = await isReceiptSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error(
      'Schema receipt NVL chưa sẵn sàng. Cần tạo bảng material_purchase_receipt và material_purchase_receipt_line trước.'
    )
  }

  if (!input.lines.length) {
    throw new Error('Không có dòng receipt để lưu.')
  }

  for (const line of input.lines) {
    if (!String(line.receiptLineId || '').trim()) {
      throw new Error('Thiếu receiptLineId trong draft receipt.')
    }
    const receivedQty = toNumber(line.receivedQty)
    const acceptedQty = toNumber(line.acceptedQty)
    const defectiveQty = toNumber(line.defectiveQty)
    const rejectedQty = toNumber(line.rejectedQty)
    if (receivedQty < 0 || acceptedQty < 0 || defectiveQty < 0 || rejectedQty < 0) {
      throw new Error('Số lượng receipt không được âm.')
    }
    if (acceptedQty + defectiveQty + rejectedQty > receivedQty) {
      throw new Error('SL đạt + lỗi + từ chối không được vượt SL nhận.')
    }
  }

  for (const line of input.lines) {
    const receivedQty = toNumber(line.receivedQty)
    const acceptedQty = toNumber(line.acceptedQty)
    const defectiveQty = toNumber(line.defectiveQty)
    const rejectedQty = toNumber(line.rejectedQty)
    const nextStatus =
      defectiveQty > 0 || rejectedQty > 0
        ? 'DA_XU_LY_LOI'
        : receivedQty > 0
          ? 'DA_NHAN_MOT_PHAN'
          : 'DRAFT'

    const { error } = await input.supabase
      .from('material_purchase_receipt_line')
      .update({
        received_qty: receivedQty,
        accepted_qty: acceptedQty,
        defective_qty: defectiveQty,
        rejected_qty: rejectedQty,
        status: nextStatus,
        updated_by: input.userId,
      })
      .eq('receipt_line_id', line.receiptLineId)

    if (error) throw error
  }

  const hasReceipt = input.lines.some((line) => toNumber(line.receivedQty) > 0)
  const hasIssue = input.lines.some((line) => toNumber(line.defectiveQty) > 0 || toNumber(line.rejectedQty) > 0)
  const headerStatus = hasIssue ? 'DA_XU_LY_LOI' : hasReceipt ? 'DA_NHAN_MOT_PHAN' : 'DRAFT'

  const { error: headerError } = await input.supabase
    .from('material_purchase_receipt')
    .update({
      note: String(input.note || ''),
      status: headerStatus,
      updated_by: input.userId,
    })
    .eq('receipt_id', input.receiptId)

  if (headerError) throw headerError

  const detail = await loadReceiptDetail({
    supabase: input.supabase,
    receiptId: input.receiptId,
  })

  if (!detail) {
    throw new Error('Không tải lại được receipt sau khi lưu.')
  }

  return detail
}

export async function confirmReceiptAndCreateStockMovements(input: {
  supabase: AnySupabase
  userId: string
  receiptId: string
}) {
  const schemaReady = await isReceiptSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error(
      'Schema receipt NVL chưa sẵn sàng. Cần tạo bảng material_purchase_receipt và material_purchase_receipt_line trước.'
    )
  }

  const { error: movementSchemaError } = await input.supabase.from('material_stock_movement').select('movement_id').limit(1)
  if (movementSchemaError) {
    if (isMissingRelationError(movementSchemaError, 'material_stock_movement')) {
      throw new Error('Schema stock movement NVL chưa sẵn sàng. Cần tạo bảng material_stock_movement trước.')
    }
    throw movementSchemaError
  }

  const { data: receiptHeader, error: receiptHeaderError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id, receipt_code, po_id, po_code, vendor_name, batch_no, status')
    .eq('receipt_id', input.receiptId)
    .single()

  if (receiptHeaderError || !receiptHeader) {
    throw receiptHeaderError || new Error('Không tìm thấy receipt để ghi movement kho.')
  }

  const { data: existingMovements, error: existingMovementError } = await input.supabase
    .from('material_stock_movement')
    .select('movement_id')
    .eq('source_type', 'PURCHASE_RECEIPT')
    .eq('source_id', input.receiptId)
    .limit(1)

  if (existingMovementError) throw existingMovementError
  if ((existingMovements ?? []).length > 0) {
    throw new Error('Receipt này đã ghi stock movement rồi, không thể ghi lặp lại.')
  }

  const { data: receiptLines, error: receiptLineError } = await input.supabase
    .from('material_purchase_receipt_line')
    .select(
      'receipt_line_id, line_no, material_code, material_name, unit, ordered_qty, received_qty, accepted_qty, defective_qty, rejected_qty'
    )
    .eq('receipt_id', input.receiptId)
    .order('line_no', { ascending: true })

  if (receiptLineError) throw receiptLineError

  const rows = (receiptLines ?? []) as Array<Record<string, unknown>>
  if (!rows.length) {
    throw new Error('Receipt chưa có dòng nào để ghi movement kho.')
  }

  const hasRealReceiptQty = rows.some(
    (row) =>
      toNumber(row.received_qty) > 0 ||
      toNumber(row.accepted_qty) > 0 ||
      toNumber(row.defective_qty) > 0 ||
      toNumber(row.rejected_qty) > 0
  )

  if (!hasRealReceiptQty) {
    throw new Error('Receipt vẫn chưa có số nhận thực tế. Cần nhập received/accepted/defective/rejected trước khi ghi stock movement.')
  }

  const movements = rows.flatMap((row) => {
    const receiptLineId = String(row.receipt_line_id || '')
    const lineNo = toNumber(row.line_no)
    const materialCode = String(row.material_code || '')
    const materialName = String(row.material_name || materialCode)
    const unit = String(row.unit || '')
    const acceptedQty = toNumber(row.accepted_qty)
    const defectiveQty = toNumber(row.defective_qty)
    const rejectedQty = toNumber(row.rejected_qty)
    const movementDate = new Date().toISOString().slice(0, 10)
    const basePayload = {
      poId: String((receiptHeader as Record<string, unknown>).po_id || ''),
      poCode: String((receiptHeader as Record<string, unknown>).po_code || ''),
      receiptCode: String((receiptHeader as Record<string, unknown>).receipt_code || ''),
      batchNo: toNumber((receiptHeader as Record<string, unknown>).batch_no) || 1,
      lineNo,
      orderedQty: toNumber(row.ordered_qty),
      receivedQty: toNumber(row.received_qty),
    }

    return [
      acceptedQty > 0
        ? {
            movement_type: 'PURCHASE_RECEIPT_ACCEPTED',
            material_code: materialCode,
            material_name: materialName,
            unit,
            quantity: acceptedQty,
            physical_effect: 'IN',
            available_effect: 'ENABLE',
            blocked_effect: 'NONE',
            quality_effect: 'ACCEPTED',
            source_type: 'PURCHASE_RECEIPT',
            source_id: input.receiptId,
            source_line_id: receiptLineId,
            movement_date: movementDate,
            warehouse_code: 'MAIN',
            warehouse_label: 'Kho NVL',
            note: `Receipt accepted từ ${String((receiptHeader as Record<string, unknown>).receipt_code || '')}`,
            payload_json: basePayload,
            created_by: input.userId,
          }
        : null,
      defectiveQty > 0
        ? {
            movement_type: 'PURCHASE_RECEIPT_DEFECTIVE',
            material_code: materialCode,
            material_name: materialName,
            unit,
            quantity: defectiveQty,
            physical_effect: 'IN',
            available_effect: 'NONE',
            blocked_effect: 'ENABLE',
            quality_effect: 'DEFECTIVE',
            source_type: 'PURCHASE_RECEIPT',
            source_id: input.receiptId,
            source_line_id: receiptLineId,
            movement_date: movementDate,
            warehouse_code: 'MAIN',
            warehouse_label: 'Kho NVL',
            note: `Receipt defective từ ${String((receiptHeader as Record<string, unknown>).receipt_code || '')}`,
            payload_json: basePayload,
            created_by: input.userId,
          }
        : null,
      rejectedQty > 0
        ? {
            movement_type: 'PURCHASE_RECEIPT_REJECTED',
            material_code: materialCode,
            material_name: materialName,
            unit,
            quantity: rejectedQty,
            physical_effect: 'NONE',
            available_effect: 'NONE',
            blocked_effect: 'NONE',
            quality_effect: 'REJECTED',
            source_type: 'PURCHASE_RECEIPT',
            source_id: input.receiptId,
            source_line_id: receiptLineId,
            movement_date: movementDate,
            warehouse_code: 'MAIN',
            warehouse_label: 'Kho NVL',
            note: `Receipt rejected từ ${String((receiptHeader as Record<string, unknown>).receipt_code || '')}`,
            payload_json: basePayload,
            created_by: input.userId,
          }
        : null,
    ].filter(Boolean)
  }) as Array<Record<string, unknown>>

  if (!movements.length) {
    throw new Error('Receipt chưa có accepted/defective/rejected hợp lệ để ghi stock movement.')
  }

  const { error: insertMovementError } = await input.supabase.from('material_stock_movement').insert(movements)
  if (insertMovementError) throw insertMovementError

  const hasIssue = rows.some((row) => toNumber(row.defective_qty) > 0 || toNumber(row.rejected_qty) > 0)
  const nextStatus = hasIssue ? 'DA_XU_LY_LOI' : 'DA_NHAN'

  const { error: updateHeaderError } = await input.supabase
    .from('material_purchase_receipt')
    .update({
      status: nextStatus,
      updated_by: input.userId,
    })
    .eq('receipt_id', input.receiptId)

  if (updateHeaderError) throw updateHeaderError

  const { error: updateLineError } = await input.supabase
    .from('material_purchase_receipt_line')
    .update({
      status: nextStatus,
      updated_by: input.userId,
    })
    .eq('receipt_id', input.receiptId)

  if (updateLineError) throw updateLineError

  await input.supabase
    .from('material_purchase_order')
    .update({
      status: 'DA_NHAN_MOT_PHAN',
      updated_by: input.userId,
    })
    .eq('po_id', String((receiptHeader as Record<string, unknown>).po_id || ''))

  return {
    receiptId: input.receiptId,
    receiptCode: String((receiptHeader as Record<string, unknown>).receipt_code || ''),
    movementCount: movements.length,
    status: nextStatus,
  }
}

export async function finalizeReceiptForPurchase(input: {
  supabase: AnySupabase
  userId: string
  receiptId: string
  vendorName?: string
  lines: Array<{
    receiptLineId: string
    billedQty: number
    unitPrice: number
  }>
}) {
  const schemaReady = await isReceiptSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error(
      'Schema receipt NVL chưa sẵn sàng. Cần tạo bảng material_purchase_receipt và material_purchase_receipt_line trước.'
    )
  }

  const { data: receiptHeader, error: receiptHeaderError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id, receipt_code, po_id, po_code, vendor_name, status, payload_json')
    .eq('receipt_id', input.receiptId)
    .single()

  if (receiptHeaderError || !receiptHeader) {
    throw receiptHeaderError || new Error('Không tìm thấy phiếu nhập để KTMH chốt đợt.')
  }

  const existingHeaderPayload = toRecord((receiptHeader as Record<string, unknown>).payload_json)
  if (String(existingHeaderPayload.settlementStatus || '').toUpperCase() === 'DA_CHOT') {
    throw new Error('Phiếu nhập này đã được KTMH chốt rồi.')
  }

  const { data: movementRows, error: movementError } = await input.supabase
    .from('material_stock_movement')
    .select('movement_id')
    .eq('source_type', 'PURCHASE_RECEIPT')
    .eq('source_id', input.receiptId)
    .limit(1)

  if (movementError && !isMissingRelationError(movementError, 'material_stock_movement')) {
    throw movementError
  }
  if ((movementRows ?? []).length === 0) {
    throw new Error('Phiếu nhập phải được Thủ kho ghi sổ trước khi KTMH chốt đợt.')
  }

  const { data: receiptLineRows, error: receiptLineError } = await input.supabase
    .from('material_purchase_receipt_line')
    .select('receipt_line_id, po_line_id, material_code, material_name, ordered_qty, received_qty, accepted_qty, payload_json')
    .eq('receipt_id', input.receiptId)
    .order('line_no', { ascending: true })

  if (receiptLineError) throw receiptLineError

  const receiptLines = (receiptLineRows ?? []) as Array<Record<string, unknown>>
  if (!receiptLines.length) {
    throw new Error('Phiếu nhập chưa có dòng nào để KTMH chốt.')
  }

  const inputLineMap = new Map(
    input.lines
      .map((line) => ({
        receiptLineId: String(line.receiptLineId || '').trim(),
        billedQty: toNumber(line.billedQty),
        unitPrice: toNumber(line.unitPrice),
      }))
      .filter((line) => line.receiptLineId)
      .map((line) => [line.receiptLineId, line])
  )

  if (!inputLineMap.size) {
    throw new Error('Cần nhập ít nhất một dòng số lượng tính tiền để KTMH chốt đợt.')
  }

  let totalBilledQty = 0
  let totalAmount = 0

  for (const row of receiptLines) {
    const receiptLineId = String(row.receipt_line_id || '')
    const payload = toRecord(row.payload_json)
    const lineInput = inputLineMap.get(receiptLineId)
    const billedQty = lineInput ? lineInput.billedQty : toNumber(payload.billedQty)
    const unitPrice = lineInput ? lineInput.unitPrice : toNumber(payload.unitPrice)
    const receivedQty = toNumber(row.received_qty)
    const varianceQty = Math.round((billedQty - receivedQty) * 1000) / 1000
    const variancePct = billedQty > 0 ? Math.round((Math.abs(varianceQty) / billedQty) * 10000) / 100 : 0
    const lineAmount = Math.round(billedQty * unitPrice * 100) / 100

    if (billedQty < 0 || unitPrice < 0) {
      throw new Error('Số lượng tính tiền và đơn giá không được âm.')
    }

    const nextPayload = {
      ...payload,
      billedQty: Math.round(billedQty * 1000) / 1000,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineAmount,
      varianceQty,
      variancePct,
      varianceDisposition: resolveVarianceDisposition(varianceQty, variancePct),
      settledAt: new Date().toISOString(),
      settledBy: input.userId,
    }

    const { error } = await input.supabase
      .from('material_purchase_receipt_line')
      .update({
        payload_json: nextPayload,
        updated_by: input.userId,
      })
      .eq('receipt_line_id', receiptLineId)

    if (error) throw error

    totalBilledQty += billedQty
    totalAmount += lineAmount
  }

  const finalVendorName = String(input.vendorName || '').trim() || String((receiptHeader as Record<string, unknown>).vendor_name || '').trim()
  if (!finalVendorName || finalVendorName === 'Chưa chọn NCC') {
    throw new Error('KTMH cần chọn nhà cung cấp trước khi chốt đợt nhập.')
  }

  const settledAt = new Date().toISOString()

  const { error: headerUpdateError } = await input.supabase
    .from('material_purchase_receipt')
    .update({
      vendor_name: finalVendorName,
      payload_json: {
        ...existingHeaderPayload,
        settlementStatus: 'DA_CHOT',
        settledAt,
        settledBy: input.userId,
        totalBilledQty: Math.round(totalBilledQty * 1000) / 1000,
        totalAmount: Math.round(totalAmount * 100) / 100,
      },
      updated_by: input.userId,
    })
    .eq('receipt_id', input.receiptId)

  if (headerUpdateError) throw headerUpdateError

  const poId = String((receiptHeader as Record<string, unknown>).po_id || '')
  if (poId) {
    const { data: settledReceiptHeaders, error: settledHeaderError } = await input.supabase
      .from('material_purchase_receipt')
      .select('receipt_id, vendor_name, payload_json')
      .eq('po_id', poId)

    if (settledHeaderError) throw settledHeaderError

    const settledReceiptIds = ((settledReceiptHeaders ?? []) as Array<Record<string, unknown>>)
      .filter((row) => String(toRecord(row.payload_json).settlementStatus || '').toUpperCase() === 'DA_CHOT')
      .map((row) => String(row.receipt_id || ''))
      .filter(Boolean)

    if (settledReceiptIds.length) {
      const { data: settledReceiptLines, error: settledLinesError } = await input.supabase
        .from('material_purchase_receipt_line')
        .select('po_line_id, received_qty, accepted_qty, payload_json')
        .in('receipt_id', settledReceiptIds)

      if (settledLinesError) throw settledLinesError

      const aggregatedByPoLine = new Map<string, { billedQty: number; totalAmount: number; actualReceivedQty: number; acceptedQty: number }>()

      for (const row of (settledReceiptLines ?? []) as Array<Record<string, unknown>>) {
        const poLineId = String(row.po_line_id || '')
        if (!poLineId) continue
        const payload = toRecord(row.payload_json)
        const current = aggregatedByPoLine.get(poLineId) || {
          billedQty: 0,
          totalAmount: 0,
          actualReceivedQty: 0,
          acceptedQty: 0,
        }
        current.billedQty += toNumber(payload.billedQty)
        current.totalAmount += toNumber(payload.lineAmount)
        current.actualReceivedQty += toNumber(row.received_qty)
        current.acceptedQty += toNumber(row.accepted_qty)
        aggregatedByPoLine.set(poLineId, current)
      }

      const { data: poLineRows, error: poLineRowsError } = await input.supabase
        .from('material_purchase_order_line')
        .select('po_line_id, payload_json')
        .eq('po_id', poId)

      if (poLineRowsError) throw poLineRowsError

      for (const row of (poLineRows ?? []) as Array<Record<string, unknown>>) {
        const poLineId = String(row.po_line_id || '')
        if (!poLineId) continue
        const aggregate = aggregatedByPoLine.get(poLineId) || {
          billedQty: 0,
          totalAmount: 0,
          actualReceivedQty: 0,
          acceptedQty: 0,
        }
        const billedQty = Math.round(aggregate.billedQty * 1000) / 1000
        const unitPrice = billedQty > 0 ? Math.round((aggregate.totalAmount / billedQty) * 100) / 100 : 0
        const varianceQty = Math.round((billedQty - aggregate.actualReceivedQty) * 1000) / 1000
        const variancePct = billedQty > 0 ? Math.round((Math.abs(varianceQty) / billedQty) * 10000) / 100 : 0

        const nextPayload = {
          ...toRecord(row.payload_json),
          billedQty,
          unitPrice,
          lineAmount: Math.round(aggregate.totalAmount * 100) / 100,
          actualReceivedQty: Math.round(aggregate.actualReceivedQty * 1000) / 1000,
          acceptedQty: Math.round(aggregate.acceptedQty * 1000) / 1000,
          varianceQty,
          variancePct,
          varianceDisposition: resolveVarianceDisposition(varianceQty, variancePct),
          settledReceiptRollupAt: settledAt,
        }

        const { error: poLineUpdateError } = await input.supabase
          .from('material_purchase_order_line')
          .update({
            payload_json: nextPayload,
            updated_by: input.userId,
          })
          .eq('po_line_id', poLineId)

        if (poLineUpdateError) throw poLineUpdateError
      }
    }

    const { error: poHeaderUpdateError } = await input.supabase
      .from('material_purchase_order')
      .update({
        vendor_name: finalVendorName,
        updated_by: input.userId,
      })
      .eq('po_id', poId)

    if (poHeaderUpdateError) throw poHeaderUpdateError
  }

  return {
    receiptId: input.receiptId,
    receiptCode: String((receiptHeader as Record<string, unknown>).receipt_code || ''),
    poId,
    poCode: String((receiptHeader as Record<string, unknown>).po_code || ''),
    totalBilledQty: Math.round(totalBilledQty * 1000) / 1000,
    totalAmount: Math.round(totalAmount * 100) / 100,
    settlementStatus: 'DA_CHOT' as const,
    settledAt,
  }
}

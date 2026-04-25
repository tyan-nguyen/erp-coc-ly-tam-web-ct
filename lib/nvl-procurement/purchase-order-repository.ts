import type { SupabaseClient } from '@supabase/supabase-js'
import { isNvlProcurementPayload } from '@/lib/external-pile-procurement/domain'
import { deriveDisplayCode } from '@/lib/master-data/nvl'
import type { NvlPurchaseOrderSummaryRow } from '@/lib/nvl-procurement/types'

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

function normalizeLookupKey(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function buildHaoHutPctResolver(rows: Array<Record<string, unknown>>) {
  const byCode = new Map<string, number>()
  const byName = new Map<string, number>()

  for (const row of rows) {
    const code = normalizeLookupKey(deriveDisplayCode(row))
    const explicitCode = normalizeLookupKey(row.ma_nvl)
    const name = normalizeLookupKey(row.ten_hang)
    const haoHutPct = toNumber(row.hao_hut_pct)

    if (code) byCode.set(code, haoHutPct)
    if (explicitCode) byCode.set(explicitCode, haoHutPct)
    if (name) byName.set(name, haoHutPct)
  }

  return (materialCode: unknown, materialName: unknown) => {
    const codeKey = normalizeLookupKey(materialCode)
    if (codeKey && byCode.has(codeKey)) return byCode.get(codeKey) || 0

    const nameKey = normalizeLookupKey(materialName)
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey) || 0

    return 0
  }
}

function resolveVarianceDisposition(varianceQty: number, variancePct: number, haoHutPct: number) {
  if (Math.abs(varianceQty) <= 0.0001) return 'KHONG_CHENH_LECH' as const
  return variancePct <= haoHutPct ? ('CHI_PHI_DOANH_NGHIEP' as const) : ('CHI_PHI_THAT_THOAT' as const)
}

function resolveWorkflowLabel(input: {
  status: string
  receiptBatchCount: number
  totalReceivedQty: number
}) {
  if (input.status === 'DA_NHAN_DU') return 'Đã xác nhận cuối'
  if (input.status === 'XAC_NHAN_MOT_PHAN') return 'Chờ KTMH xác nhận cuối'
  if (input.receiptBatchCount > 0 || input.totalReceivedQty > 0) return 'Đang nhập hàng'
  return 'Phiếu mua đang mở'
}

async function buildPoCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `PO-NVL-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('material_purchase_order')
    .select('po_code')
    .ilike('po_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const poCode = String(row.po_code || '').trim()
    if (!poCode.startsWith(prefix)) continue
    const suffix = poCode.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

export async function isPurchaseOrderSchemaReady(supabase: AnySupabase) {
  const [headerResult, lineResult] = await Promise.all([
    supabase.from('material_purchase_order').select('po_id').limit(1),
    supabase.from('material_purchase_order_line').select('po_line_id').limit(1),
  ])

  if (!headerResult.error && !lineResult.error) return true
  if (
    (headerResult.error && isMissingRelationError(headerResult.error, 'material_purchase_order')) ||
    (lineResult.error && isMissingRelationError(lineResult.error, 'material_purchase_order_line'))
  ) {
    return false
  }

  if (headerResult.error) throw headerResult.error
  if (lineResult.error) throw lineResult.error
  return true
}

export async function loadPurchaseOrderSummaries(
  supabase: AnySupabase
): Promise<{ schemaReady: boolean; rows: NvlPurchaseOrderSummaryRow[] }> {
  const schemaReady = await isPurchaseOrderSchemaReady(supabase)
  if (!schemaReady) return { schemaReady: false, rows: [] }

  const { data: headerRows, error: headerError } = await supabase
    .from('material_purchase_order')
    .select('po_id, po_code, request_id, request_code, vendor_name, status, source_mode, expected_date, note, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(20)

  if (headerError) throw headerError

  const filteredHeaderRows = ((headerRows ?? []) as Array<Record<string, unknown>>).filter((row) =>
    isNvlProcurementPayload(row.payload_json)
  )

  const poIds = filteredHeaderRows
    .map((row) => String(row.po_id || ''))
    .filter(Boolean)

  if (!poIds.length) return { schemaReady: true, rows: [] }

  const { data: lineRows, error: lineError } = await supabase
    .from('material_purchase_order_line')
    .select('po_id, po_line_id, request_id, request_line_id, material_code, material_name, unit, ordered_qty, payload_json')
    .in('po_id', poIds)

  if (lineError) throw lineError

  const { data: receiptHeaderRows, error: receiptHeaderError } = await supabase
    .from('material_purchase_receipt')
    .select('receipt_id, po_id')
    .in('po_id', poIds)

  if (receiptHeaderError) throw receiptHeaderError

  const receiptIds = ((receiptHeaderRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.receipt_id || ''))
    .filter(Boolean)

  const receiptHeaderBucket = new Map<string, number>()
  for (const rawRow of (receiptHeaderRows ?? []) as Array<Record<string, unknown>>) {
    const poId = String(rawRow.po_id || '')
    if (!poId) continue
    receiptHeaderBucket.set(poId, (receiptHeaderBucket.get(poId) || 0) + 1)
  }

  const receiptLineBucket = new Map<string, { actualReceivedQty: number; acceptedQty: number }>()
  if (receiptIds.length) {
    const { data: receiptLineRows, error: receiptLineError } = await supabase
      .from('material_purchase_receipt_line')
      .select('po_line_id, received_qty, accepted_qty')
      .in('receipt_id', receiptIds)

    if (receiptLineError) throw receiptLineError

    for (const rawRow of (receiptLineRows ?? []) as Array<Record<string, unknown>>) {
      const poLineId = String(rawRow.po_line_id || '')
      if (!poLineId) continue
      const current = receiptLineBucket.get(poLineId) || { actualReceivedQty: 0, acceptedQty: 0 }
      current.actualReceivedQty += toNumber(rawRow.received_qty)
      current.acceptedQty += toNumber(rawRow.accepted_qty)
      receiptLineBucket.set(poLineId, current)
    }
  }

  const { data: nvlRows, error: nvlError } = await supabase.from('nvl').select('*').limit(2000)
  if (nvlError) throw nvlError

  const resolveHaoHutPct = buildHaoHutPctResolver((nvlRows ?? []) as Array<Record<string, unknown>>)

  const lineBucket = new Map<string, {
    lineCount: number
    totalOrderedQty: number
    totalReceivedQty: number
    totalAcceptedQty: number
    lines: NvlPurchaseOrderSummaryRow['lines']
  }>()
  for (const rawRow of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const poId = String(rawRow.po_id || '')
    if (!poId) continue
    const poLineId = String(rawRow.po_line_id || '')
    const materialCode = String(rawRow.material_code || '')
    const payload = toRecord(rawRow.payload_json)
    const receiptTotals = receiptLineBucket.get(poLineId) || { actualReceivedQty: 0, acceptedQty: 0 }
    const orderedQty = toNumber(rawRow.ordered_qty)
    const billedQty = toNumber(payload.billedQty) || orderedQty
    const unitPrice = toNumber(payload.unitPrice)
    const varianceQty = Math.round((billedQty - receiptTotals.actualReceivedQty) * 1000) / 1000
    const variancePct =
      billedQty > 0 ? Math.round((Math.abs(varianceQty) / billedQty) * 10000) / 100 : 0
    const haoHutPct = resolveHaoHutPct(materialCode, rawRow.material_name)
    const varianceDisposition =
      String(payload.varianceDisposition || '') === 'CHI_PHI_DOANH_NGHIEP' ||
      String(payload.varianceDisposition || '') === 'CHI_PHI_THAT_THOAT' ||
      String(payload.varianceDisposition || '') === 'KHONG_CHENH_LECH'
        ? (String(payload.varianceDisposition) as NvlPurchaseOrderSummaryRow['lines'][number]['varianceDisposition'])
        : resolveVarianceDisposition(varianceQty, variancePct, haoHutPct)

    const current = lineBucket.get(poId) || {
      lineCount: 0,
      totalOrderedQty: 0,
      totalReceivedQty: 0,
      totalAcceptedQty: 0,
      lines: [],
    }
    current.lineCount += 1
    current.totalOrderedQty += orderedQty
    current.totalReceivedQty += receiptTotals.actualReceivedQty
    current.totalAcceptedQty += receiptTotals.acceptedQty
    current.lines.push({
      poLineId,
      requestId: String(rawRow.request_id || ''),
      requestLineId: String(rawRow.request_line_id || ''),
      materialCode,
      materialName: String(rawRow.material_name || materialCode || '-'),
      unit: String(rawRow.unit || ''),
      orderedQty,
      actualReceivedQty: Math.round(receiptTotals.actualReceivedQty * 1000) / 1000,
      acceptedQty: Math.round(receiptTotals.acceptedQty * 1000) / 1000,
      billedQty: Math.round(billedQty * 1000) / 1000,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineAmount: Math.round(billedQty * unitPrice * 100) / 100,
      varianceQty,
      variancePct,
      varianceDisposition,
      haoHutPct,
    })
    lineBucket.set(poId, current)
  }

  const rows: NvlPurchaseOrderSummaryRow[] = filteredHeaderRows.map((row) => {
    const poId = String(row.po_id || '')
    const lineMeta = lineBucket.get(poId) || {
      lineCount: 0,
      totalOrderedQty: 0,
      totalReceivedQty: 0,
      totalAcceptedQty: 0,
      lines: [],
    }
    const status =
      row.status === 'DA_GUI_NCC' ||
      row.status === 'XAC_NHAN_MOT_PHAN' ||
      row.status === 'DA_NHAN_MOT_PHAN' ||
      row.status === 'DA_NHAN_DU' ||
      row.status === 'HUY'
        ? row.status
        : 'DRAFT'
    return {
      poId,
      poCode: String(row.po_code || poId || '-'),
      requestId: String(row.request_id || ''),
      requestCode: String(row.request_code || '-'),
      vendorName: String(row.vendor_name || 'Chưa chọn NCC'),
      status,
      sourceMode: row.source_mode === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
      lineCount: lineMeta.lineCount,
      totalOrderedQty: Math.round(lineMeta.totalOrderedQty * 1000) / 1000,
      totalReceivedQty: Math.round(lineMeta.totalReceivedQty * 1000) / 1000,
      totalAcceptedQty: Math.round(lineMeta.totalAcceptedQty * 1000) / 1000,
      receiptBatchCount: receiptHeaderBucket.get(poId) || 0,
      workflowLabel: resolveWorkflowLabel({
        status,
        receiptBatchCount: receiptHeaderBucket.get(poId) || 0,
        totalReceivedQty: lineMeta.totalReceivedQty,
      }),
      expectedDate: String(row.expected_date || ''),
      note: String(row.note || ''),
      createdAt: String(row.created_at || ''),
      lines: [...lineMeta.lines].sort((a, b) => a.materialName.localeCompare(b.materialName)),
    }
  })

  return { schemaReady: true, rows }
}

export async function createPurchaseOrderDraftFromRequest(input: {
  supabase: AnySupabase
  userId: string
  requestId: string
}) {
  const schemaReady = await isPurchaseOrderSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Schema PO NVL chưa sẵn sàng. Cần tạo bảng material_purchase_order và material_purchase_order_line trước.')
  }

  const { data: requestHeader, error: requestHeaderError } = await input.supabase
    .from('material_purchase_request')
    .select('request_id, request_code, source_mode, note')
    .eq('request_id', input.requestId)
    .single()

  if (requestHeaderError || !requestHeader) {
    throw requestHeaderError || new Error('Không tìm thấy draft đề xuất mua để tạo PO.')
  }

  const { data: requestLines, error: requestLineError } = await input.supabase
    .from('material_purchase_request_line')
    .select(
      'request_line_id, line_no, material_code, material_name, unit, proposed_qty, plan_count, window_label, basis_label, urgency_label, reason, explanation, source_mode'
    )
    .eq('request_id', input.requestId)
    .order('line_no', { ascending: true })

  if (requestLineError) throw requestLineError

  const lines = ((requestLines ?? []) as Array<Record<string, unknown>>).filter((row) => toNumber(row.proposed_qty) > 0)
  if (!lines.length) {
    throw new Error('Draft đề xuất mua không có dòng hợp lệ để tạo PO.')
  }

  const poCode = await buildPoCode(input.supabase)
  const expectedDate = ''
  const sourceMode = String((requestHeader as Record<string, unknown>).source_mode || '') === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY'
  const requestCode = String((requestHeader as Record<string, unknown>).request_code || '')

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .insert({
      po_code: poCode,
      request_id: input.requestId,
      request_code: requestCode,
      vendor_name: 'Chưa chọn NCC',
      expected_date: expectedDate || null,
      status: 'DRAFT',
      source_mode: sourceMode,
      note: `Tạo từ draft đề xuất ${requestCode}.`,
      payload_json: {
        createdFromRequestId: input.requestId,
        createdFromRequestCode: requestCode,
      },
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('po_id, po_code')
    .single()

  if (poHeaderError || !poHeader) throw poHeaderError || new Error('Không tạo được draft PO NVL.')

  const poId = String((poHeader as Record<string, unknown>).po_id || '')
  if (!poId) throw new Error('Không lấy được po_id sau khi tạo draft PO NVL.')

  const { error: poLineError } = await input.supabase.from('material_purchase_order_line').insert(
    lines.map((row) => ({
      po_id: poId,
      request_id: input.requestId,
      request_line_id: String(row.request_line_id || ''),
      line_no: toNumber(row.line_no),
      material_code: String(row.material_code || ''),
      material_name: String(row.material_name || ''),
      unit: String(row.unit || ''),
      ordered_qty: toNumber(row.proposed_qty),
      status: 'DRAFT',
      source_mode: String(row.source_mode || '') === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
      reason: String(row.reason || ''),
      payload_json: {
        planCount: toNumber(row.plan_count),
        windowLabel: String(row.window_label || ''),
        basisLabel: String(row.basis_label || ''),
        urgencyLabel: String(row.urgency_label || ''),
        explanation: String(row.explanation || ''),
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (poLineError) throw poLineError

  return {
    poId,
    poCode: String((poHeader as Record<string, unknown>).po_code || poCode),
    lineCount: lines.length,
  }
}

export async function createPurchaseOrderDraftFromSelection(input: {
  supabase: AnySupabase
  userId: string
  requestId?: string
  vendorName: string
  expectedDate?: string
  note?: string
  lines: Array<{
    requestId?: string
    requestLineId: string
    orderedQty: number
  }>
}) {
  const schemaReady = await isPurchaseOrderSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng lập phiếu mua đang trong giai đoạn nối dữ liệu, nên hiện chưa tạo riêng được.')
  }

  const vendorName = String(input.vendorName || '').trim()

  const requestedLineIds = input.lines
    .map((line) => ({
      requestId: String(line.requestId || input.requestId || '').trim(),
      requestLineId: String(line.requestLineId || '').trim(),
      orderedQty: Number(line.orderedQty || 0),
    }))
    .filter((line) => line.requestId && line.requestLineId && line.orderedQty > 0)

  if (!requestedLineIds.length) {
    throw new Error('Cần chọn ít nhất một dòng vật tư và nhập số lượng đặt lớn hơn 0.')
  }

  const requestIds = Array.from(new Set(requestedLineIds.map((line) => line.requestId)))

  const { data: requestHeaders, error: requestHeaderError } = await input.supabase
    .from('material_purchase_request')
    .select('request_id, request_code, source_mode')
    .in('request_id', requestIds)

  if (requestHeaderError) {
    throw requestHeaderError
  }
  const requestHeaderMap = new Map(
    ((requestHeaders ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.request_id || ''), row])
  )
  if (requestIds.some((id) => !requestHeaderMap.has(id))) {
    throw new Error('Có bản đề xuất không còn tồn tại, chưa thể lập phiếu mua.')
  }

  const { data: requestLines, error: requestLineError } = await input.supabase
    .from('material_purchase_request_line')
    .select(
      'request_id, request_line_id, line_no, material_code, material_name, unit, proposed_qty, plan_count, window_label, basis_label, urgency_label, reason, explanation, source_mode, status'
    )
    .in('request_id', requestIds)
    .in(
      'request_line_id',
      requestedLineIds.map((line) => line.requestLineId)
    )
    .order('line_no', { ascending: true })

  if (requestLineError) throw requestLineError

  const requestLineMap = new Map(
    ((requestLines ?? []) as Array<Record<string, unknown>>).map((row) => [
      `${String(row.request_id || '')}::${String(row.request_line_id || '')}`,
      row,
    ])
  )

  const selectedLines = requestedLineIds
    .map((line) => {
      const source = requestLineMap.get(`${line.requestId}::${line.requestLineId}`)
      if (!source) return null
      if (String(source.status || '') === 'DA_CHUYEN_DAT_HANG') return null
      return { requestId: line.requestId, source, orderedQty: line.orderedQty }
    })
    .filter(Boolean) as Array<{ requestId: string; source: Record<string, unknown>; orderedQty: number }>

  if (!selectedLines.length) {
    throw new Error('Không tìm thấy các dòng đề xuất đã chọn để lập phiếu mua.')
  }

  const poCode = await buildPoCode(input.supabase)
  const sourceMode = selectedLines.some(
    ({ source }) => String(source.source_mode || '') === 'FULL'
  )
    ? 'FULL'
    : 'LIVE_DEMAND_ONLY'
  const selectedRequestCodes = Array.from(
    new Set(
      requestIds.map((requestId) => String((requestHeaderMap.get(requestId) as Record<string, unknown> | undefined)?.request_code || ''))
    )
  ).filter(Boolean)
  const singleRequestId = requestIds.length === 1 ? requestIds[0] : null
  const singleRequestCode = selectedRequestCodes.length === 1 ? selectedRequestCodes[0] : null

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .insert({
      po_code: poCode,
      request_id: singleRequestId,
      request_code: singleRequestCode,
      vendor_name: vendorName || null,
      expected_date: input.expectedDate || null,
      status: 'DRAFT',
      source_mode: sourceMode,
      note: String(
        input.note ||
          (selectedRequestCodes.length === 1
            ? `Lập từ bản đề xuất ${selectedRequestCodes[0]}.`
            : `Lập từ ${selectedRequestCodes.length} bản đề xuất.`)
      ),
      payload_json: {
        sourceRequestIds: requestIds,
        sourceRequestCodes: selectedRequestCodes,
        selectedLineCount: selectedLines.length,
      },
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('po_id, po_code')
    .single()

  if (poHeaderError || !poHeader) throw poHeaderError || new Error('Không tạo được phiếu mua NVL.')

  const poId = String((poHeader as Record<string, unknown>).po_id || '')
  if (!poId) throw new Error('Không lấy được mã phiếu mua sau khi tạo.')

  const { error: poLineError } = await input.supabase.from('material_purchase_order_line').insert(
    selectedLines.map(({ requestId, source, orderedQty }, index) => ({
      po_id: poId,
      request_id: requestId,
      request_line_id: String(source.request_line_id || ''),
      line_no: index + 1,
      material_code: String(source.material_code || ''),
      material_name: String(source.material_name || ''),
      unit: String(source.unit || ''),
      ordered_qty: orderedQty,
      status: 'DRAFT',
      source_mode: String(source.source_mode || '') === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
      reason: String(source.reason || ''),
      payload_json: {
        proposedQty: toNumber(source.proposed_qty),
        planCount: toNumber(source.plan_count),
        windowLabel: String(source.window_label || ''),
        basisLabel: String(source.basis_label || ''),
        urgencyLabel: String(source.urgency_label || ''),
        explanation: String(source.explanation || ''),
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (poLineError) throw poLineError

  const selectedRequestLineIds = selectedLines.map(({ source }) => String(source.request_line_id || '')).filter(Boolean)

  if (selectedRequestLineIds.length) {
    const { error: updateLineError } = await input.supabase
      .from('material_purchase_request_line')
      .update({
        status: 'DA_CHUYEN_DAT_HANG',
        updated_by: input.userId,
      })
      .in('request_line_id', selectedRequestLineIds)

    if (updateLineError) throw updateLineError
  }

  const { data: remainingLines, error: remainingLineError } = await input.supabase
    .from('material_purchase_request_line')
    .select('request_id, status')
    .in('request_id', requestIds)
    .eq('is_active', true)

  if (remainingLineError) throw remainingLineError

  const remainingBucket = new Map<string, string[]>()
  for (const rawRow of (remainingLines ?? []) as Array<Record<string, unknown>>) {
    const requestId = String(rawRow.request_id || '')
    if (!requestId) continue
    const current = remainingBucket.get(requestId) || []
    current.push(String(rawRow.status || 'DRAFT'))
    remainingBucket.set(requestId, current)
  }

  const fullyTransferredRequestIds = requestIds.filter((requestId) => {
    const statuses = remainingBucket.get(requestId) || []
    return statuses.length > 0 && statuses.every((status) => status === 'DA_CHUYEN_DAT_HANG')
  })

  if (fullyTransferredRequestIds.length) {
    const { error: updateRequestError } = await input.supabase
      .from('material_purchase_request')
      .update({
        status: 'DA_CHUYEN_DAT_HANG',
        updated_by: input.userId,
      })
      .in('request_id', fullyTransferredRequestIds)

    if (updateRequestError) throw updateRequestError
  }

  return {
    poId,
    poCode: String((poHeader as Record<string, unknown>).po_code || poCode),
    lineCount: selectedLines.length,
  }
}

export async function finishPurchaseOrderReceiving(input: {
  supabase: AnySupabase
  userId: string
  poId: string
}) {
  const schemaReady = await isPurchaseOrderSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng kết thúc nhập đang trong giai đoạn nối dữ liệu.')
  }

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .select('po_id, po_code, status, payload_json')
    .eq('po_id', input.poId)
    .single()

  if (poHeaderError || !poHeader) {
    throw poHeaderError || new Error('Không tìm thấy phiếu mua để kết thúc nhập.')
  }

  const currentStatus = String((poHeader as Record<string, unknown>).status || '').toUpperCase()
  if (currentStatus === 'DA_NHAN_DU') {
    throw new Error('Phiếu mua này đã được KTMH xác nhận cuối rồi.')
  }

  const { data: receiptRows, error: receiptError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id, status, payload_json')
    .eq('po_id', input.poId)

  if (receiptError) throw receiptError

  const receipts = (receiptRows ?? []) as Array<Record<string, unknown>>
  if (!receipts.length) {
    throw new Error('Phiếu mua chưa có đợt nhập nào nên chưa thể kết thúc.')
  }
  if (receipts.some((row) => String(row.status || '').toUpperCase() === 'DRAFT')) {
    throw new Error('Vẫn còn phiếu nhập chưa ghi xong. Cần hoàn tất các đợt nhập trước khi kết thúc.')
  }
  if (receipts.some((row) => String(toRecord(row.payload_json).settlementStatus || '').toUpperCase() !== 'DA_CHOT')) {
    throw new Error('KTMH phải chốt hết các đợt nhập của phiếu mua trước khi kết thúc đơn.')
  }

  const payload = toRecord((poHeader as Record<string, unknown>).payload_json)
  payload.receivingClosedAt = new Date().toISOString()
  payload.receivingClosedBy = input.userId

  const { error: updateError } = await input.supabase
    .from('material_purchase_order')
    .update({
      status: 'XAC_NHAN_MOT_PHAN',
      payload_json: payload,
      updated_by: input.userId,
    })
    .eq('po_id', input.poId)

  if (updateError) throw updateError

  return {
    poId: input.poId,
    poCode: String((poHeader as Record<string, unknown>).po_code || ''),
    status: 'XAC_NHAN_MOT_PHAN',
  }
}

export async function finalizePurchaseOrder(input: {
  supabase: AnySupabase
  userId: string
  poId: string
  vendorName?: string
  lines: Array<{
    poLineId: string
    billedQty: number
    unitPrice: number
  }>
}) {
  const schemaReady = await isPurchaseOrderSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng KTMH xác nhận cuối đang trong giai đoạn nối dữ liệu.')
  }

  const { data: poHeader, error: poHeaderError } = await input.supabase
    .from('material_purchase_order')
    .select('po_id, po_code, status, vendor_name, payload_json')
    .eq('po_id', input.poId)
    .single()

  if (poHeaderError || !poHeader) {
    throw poHeaderError || new Error('Không tìm thấy phiếu mua để KTMH xác nhận cuối.')
  }

  const currentStatus = String((poHeader as Record<string, unknown>).status || '').toUpperCase()
  if (currentStatus !== 'XAC_NHAN_MOT_PHAN') {
    throw new Error('Phiếu mua phải được Thủ kho bấm kết thúc trước khi KTMH xác nhận cuối.')
  }

  const { data: receiptHeaders, error: receiptHeaderError } = await input.supabase
    .from('material_purchase_receipt')
    .select('receipt_id, vendor_name, payload_json')
    .eq('po_id', input.poId)

  if (receiptHeaderError) throw receiptHeaderError

  const receipts = (receiptHeaders ?? []) as Array<Record<string, unknown>>
  if (!receipts.length) {
    throw new Error('Phiếu mua chưa có đợt nhập nào nên chưa thể KTMH xác nhận cuối.')
  }
  if (receipts.some((row) => String(toRecord(row.payload_json).settlementStatus || '').toUpperCase() !== 'DA_CHOT')) {
    throw new Error('Vẫn còn đợt nhập chưa được KTMH chốt. Cần chốt hết các đợt trước khi xác nhận cuối phiếu mua.')
  }

  const receiptIds = receipts.map((row) => String(row.receipt_id || '')).filter(Boolean)

  const { data: poLines, error: poLineError } = await input.supabase
    .from('material_purchase_order_line')
    .select('po_line_id, material_code, material_name, ordered_qty, payload_json')
    .eq('po_id', input.poId)
    .order('line_no', { ascending: true })

  if (poLineError) throw poLineError

  const { data: receiptLineRows, error: receiptLineError } = await input.supabase
    .from('material_purchase_receipt_line')
    .select('po_line_id, received_qty, accepted_qty, payload_json')
    .in('receipt_id', receiptIds)

  if (receiptLineError) throw receiptLineError

  const receiptBucket = new Map<string, { actualReceivedQty: number; acceptedQty: number; billedQty: number; totalAmount: number }>()
  for (const rawRow of (receiptLineRows ?? []) as Array<Record<string, unknown>>) {
    const poLineId = String(rawRow.po_line_id || '')
    if (!poLineId) continue
    const payload = toRecord(rawRow.payload_json)
    const current = receiptBucket.get(poLineId) || { actualReceivedQty: 0, acceptedQty: 0, billedQty: 0, totalAmount: 0 }
    current.actualReceivedQty += toNumber(rawRow.received_qty)
    current.acceptedQty += toNumber(rawRow.accepted_qty)
    current.billedQty += toNumber(payload.billedQty)
    current.totalAmount += toNumber(payload.lineAmount)
    receiptBucket.set(poLineId, current)
  }

  const { data: nvlRows, error: nvlError } = await input.supabase.from('nvl').select('*').limit(2000)
  if (nvlError) throw nvlError
  const resolveHaoHutPct = buildHaoHutPctResolver((nvlRows ?? []) as Array<Record<string, unknown>>)

  const finalConfirmedAt = new Date().toISOString()
  for (const rawRow of (poLines ?? []) as Array<Record<string, unknown>>) {
    const poLineId = String(rawRow.po_line_id || '')
    const aggregate = receiptBucket.get(poLineId) || { actualReceivedQty: 0, acceptedQty: 0, billedQty: 0, totalAmount: 0 }
    const payload = toRecord(rawRow.payload_json)
    const billedQty = Math.round(aggregate.billedQty * 1000) / 1000
    const unitPrice = billedQty > 0 ? Math.round((aggregate.totalAmount / billedQty) * 100) / 100 : 0
    const actualReceivedQty = Math.round(aggregate.actualReceivedQty * 1000) / 1000
    const haoHutPct = resolveHaoHutPct(rawRow.material_code, rawRow.material_name)
    const varianceQty = Math.round((billedQty - actualReceivedQty) * 1000) / 1000
    const variancePct = billedQty > 0 ? Math.round((Math.abs(varianceQty) / billedQty) * 10000) / 100 : 0
    const varianceDisposition = resolveVarianceDisposition(varianceQty, variancePct, haoHutPct)

    payload.billedQty = billedQty
    payload.unitPrice = unitPrice
    payload.actualReceivedQty = actualReceivedQty
    payload.acceptedQty = Math.round(aggregate.acceptedQty * 1000) / 1000
    payload.haoHutPct = haoHutPct
    payload.varianceQty = varianceQty
    payload.variancePct = variancePct
    payload.varianceDisposition = varianceDisposition
    payload.lineAmount = Math.round(aggregate.totalAmount * 100) / 100
    payload.finalConfirmedAt = finalConfirmedAt
    payload.finalConfirmedBy = input.userId

    const { error: updateLineError } = await input.supabase
      .from('material_purchase_order_line')
      .update({
        payload_json: payload,
        updated_by: input.userId,
      })
      .eq('po_line_id', poLineId)

    if (updateLineError) throw updateLineError
  }

  const headerPayload = toRecord((poHeader as Record<string, unknown>).payload_json)
  headerPayload.finalConfirmedAt = finalConfirmedAt
  headerPayload.finalConfirmedBy = input.userId

  const uniqueVendors = Array.from(
    new Set(receipts.map((row) => String(row.vendor_name || '').trim()).filter((value) => value && value !== 'Chưa chọn NCC'))
  )
  const finalVendorName =
    String(input.vendorName || '').trim() ||
    (uniqueVendors.length === 1 ? uniqueVendors[0] : '') ||
    String((poHeader as Record<string, unknown>).vendor_name || '').trim()
  if (!finalVendorName) {
    throw new Error('KTMH cần chọn nhà cung cấp trước khi xác nhận cuối phiếu mua.')
  }
  if (uniqueVendors.length > 1 && !String(input.vendorName || '').trim()) {
    throw new Error('PO có nhiều NCC ở các đợt đã chốt. Cần chọn NCC cuối trước khi xác nhận cuối phiếu mua.')
  }

  const { error: updateHeaderError } = await input.supabase
    .from('material_purchase_order')
    .update({
      vendor_name: finalVendorName,
      status: 'DA_NHAN_DU',
      payload_json: headerPayload,
      updated_by: input.userId,
    })
    .eq('po_id', input.poId)

  if (updateHeaderError) throw updateHeaderError

  return {
    poId: input.poId,
    poCode: String((poHeader as Record<string, unknown>).po_code || ''),
    vendorName: finalVendorName,
    status: 'DA_NHAN_DU',
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canConfirmMaterialIssue,
  canCreateMaterialIssue,
  canViewMaterialIssue,
} from '@/lib/auth/roles'
import { deriveDisplayCode } from '@/lib/master-data/nvl'
import { loadNvlStockTruthPageData } from '@/lib/nvl-stock/page-data'
import type {
  MaterialIssueCreateBootstrap,
  MaterialIssueCustomerOption,
  MaterialIssueLineDraft,
  MaterialIssuePageData,
  MaterialIssueProjectOption,
  MaterialIssueStatus,
  MaterialIssueVoucherDetail,
  MaterialIssueVoucherLine,
  MaterialIssueVoucherSummary,
} from '@/lib/nvl-issue/types'

type AnySupabase = SupabaseClient

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

function isMissingRelationError(error: unknown, relationName: string) {
  const message = String(
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  ).toLowerCase()

  return (
    (message.includes('relation') && message.includes(relationName.toLowerCase())) ||
    (message.includes('schema cache') && message.includes(relationName.toLowerCase()))
  )
}

async function isMaterialIssueSchemaReady(supabase: AnySupabase) {
  const [header, line, movement] = await Promise.all([
    supabase.from('material_issue_voucher').select('voucher_id').limit(1),
    supabase.from('material_issue_voucher_line').select('voucher_line_id').limit(1),
    supabase.from('material_stock_movement').select('movement_id').limit(1),
  ])

  if (!header.error && !line.error && !movement.error) return true
  if (
    (header.error && isMissingRelationError(header.error, 'material_issue_voucher')) ||
    (line.error && isMissingRelationError(line.error, 'material_issue_voucher_line')) ||
    (movement.error && isMissingRelationError(movement.error, 'material_stock_movement'))
  ) {
    return false
  }

  throw header.error || line.error || movement.error
}

async function buildVoucherCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `PX-NVL-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('material_issue_voucher')
    .select('voucher_code')
    .ilike('voucher_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const voucherCode = normalizeText(row.voucher_code)
    if (!voucherCode.startsWith(prefix)) continue
    const suffix = voucherCode.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

async function loadCustomerOptions(supabase: AnySupabase) {
  const { data, error } = await supabase.from('dm_kh').select('kh_id, ten_kh, is_active').limit(300)
  if (error) return [] satisfies MaterialIssueCustomerOption[]

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      khId: normalizeText(row.kh_id),
      tenKh: normalizeText(row.ten_kh) || normalizeText(row.kh_id),
    }))
    .filter((row) => row.khId)
}

async function loadProjectOptions(supabase: AnySupabase) {
  const { data, error } = await supabase.from('dm_duan').select('da_id, ten_da, ma_da, kh_id, is_active').limit(300)
  if (error) return [] satisfies MaterialIssueProjectOption[]

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      daId: normalizeText(row.da_id),
      tenDa: normalizeText(row.ten_da) || normalizeText(row.ma_da) || normalizeText(row.da_id),
      khId: normalizeText(row.kh_id),
    }))
    .filter((row) => row.daId)
}

async function loadMaterialOptions(supabase: AnySupabase) {
  const stockData = await loadNvlStockTruthPageData(supabase)
  const { data, error } = await supabase.from('nvl').select('*').limit(2000)
  if (error) return []

  const stockMap = new Map(
    (stockData.schemaReady ? stockData.rows : []).map((row) => [
      normalizeText(row.materialCode),
      round3(row.availableQty),
    ] as const)
  )

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const materialCode = normalizeText(row.nvl_id)
      const materialName = normalizeText(row.ten_hang)
      if (!materialCode || !materialName) return null
      const displayCode = deriveDisplayCode(row)
      return {
        materialCode,
        materialName,
        unit: normalizeText(row.dvt) || 'cái',
        availableQty: round3(stockMap.get(displayCode) || stockMap.get(materialCode) || 0),
        displayCode,
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(left?.materialName || '').localeCompare(String(right?.materialName || ''), 'vi'))
}

function mapStatus(value: unknown): MaterialIssueStatus {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'DA_XUAT' || normalized === 'XUAT_MOT_PHAN' || normalized === 'HUY') return normalized
  return 'CHO_XAC_NHAN'
}

function mapIssueKind(value: unknown) {
  return normalizeText(value).toUpperCase() === 'DIEU_CHUYEN' ? 'DIEU_CHUYEN' : 'BAN_VAT_TU'
}

export async function loadMaterialIssuePageData(
  supabase: AnySupabase,
  viewerRole: string | null | undefined
): Promise<MaterialIssuePageData> {
  if (!canViewMaterialIssue(viewerRole)) {
    return {
      schemaReady: false,
      customers: [],
      projects: [],
      materialOptions: [],
      vouchers: [],
    }
  }

  const schemaReady = await isMaterialIssueSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      customers: [],
      projects: [],
      materialOptions: [],
      vouchers: [],
    }
  }

  const vouchers = await loadMaterialIssueVoucherSummaries(supabase)

  return {
    schemaReady: true,
    customers: [],
    projects: [],
    materialOptions: [],
    vouchers,
  }
}

export async function loadMaterialIssueCreateBootstrap(
  supabase: AnySupabase,
  viewerRole: string | null | undefined
): Promise<MaterialIssueCreateBootstrap> {
  if (!canCreateMaterialIssue(viewerRole)) {
    return {
      customers: [],
      projects: [],
      materialOptions: [],
    }
  }

  const [customers, projects, materialOptions] = await Promise.all([
    loadCustomerOptions(supabase),
    loadProjectOptions(supabase),
    loadMaterialOptions(supabase),
  ])

  return {
    customers,
    projects,
    materialOptions,
  }
}

export async function loadMaterialIssueVoucherSummaries(supabase: AnySupabase): Promise<MaterialIssueVoucherSummary[]> {
  const { data: headerRows, error: headerError } = await supabase
    .from('material_issue_voucher')
    .select('voucher_id, voucher_code, issue_kind, status, kh_id, da_id, operation_date, note, payload_json, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (headerError) throw headerError

  const voucherIds = ((headerRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => normalizeText(row.voucher_id))
    .filter(Boolean)

  const { data: lineRows, error: lineError } = voucherIds.length
    ? await supabase
        .from('material_issue_voucher_line')
        .select('voucher_id, requested_qty, actual_qty, unit_price')
        .in('voucher_id', voucherIds)
    : { data: [], error: null }

  if (lineError) throw lineError

  const lineBucket = new Map<string, { requestedQtyTotal: number; actualQtyTotal: number; totalAmount: number }>()
  for (const row of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const voucherId = normalizeText(row.voucher_id)
    const current = lineBucket.get(voucherId) || { requestedQtyTotal: 0, actualQtyTotal: 0, totalAmount: 0 }
    current.requestedQtyTotal += toNumber(row.requested_qty)
    current.actualQtyTotal += toNumber(row.actual_qty)
    current.totalAmount += toNumber(row.requested_qty) * toNumber(row.unit_price)
    lineBucket.set(voucherId, current)
  }

  return ((headerRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const payload = (row.payload_json as Record<string, unknown> | null) || {}
    const totals = lineBucket.get(normalizeText(row.voucher_id)) || {
      requestedQtyTotal: 0,
      actualQtyTotal: 0,
      totalAmount: 0,
    }

    return {
      voucherId: normalizeText(row.voucher_id),
      voucherCode: normalizeText(row.voucher_code),
      issueKind: mapIssueKind(row.issue_kind),
      status: mapStatus(row.status),
      customerName: normalizeText(payload.customerName),
      projectName: normalizeText(payload.projectName),
      requestedQtyTotal: round3(totals.requestedQtyTotal),
      actualQtyTotal: round3(totals.actualQtyTotal),
      totalAmount: round3(totals.totalAmount),
      operationDate: normalizeText(row.operation_date),
      createdAt: normalizeText(row.created_at),
    }
  })
}

export async function loadMaterialIssueVoucherDetail(
  supabase: AnySupabase,
  voucherId: string
): Promise<MaterialIssueVoucherDetail | null> {
  const { data: headerRow, error: headerError } = await supabase
    .from('material_issue_voucher')
    .select('voucher_id, voucher_code, issue_kind, status, kh_id, da_id, operation_date, note, payload_json, created_at')
    .eq('voucher_id', voucherId)
    .eq('is_active', true)
    .maybeSingle()

  if (headerError) throw headerError
  if (!headerRow) return null

  const { data: lineRows, error: lineError } = await supabase
    .from('material_issue_voucher_line')
    .select('voucher_line_id, line_no, material_code, material_name, unit, requested_qty, actual_qty, unit_price, note, payload_json')
    .eq('voucher_id', voucherId)
    .eq('is_active', true)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const payload = (headerRow.payload_json as Record<string, unknown> | null) || {}
  const lines = ((lineRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const linePayload = (row.payload_json as Record<string, unknown> | null) || {}
    const requestedQty = round3(toNumber(row.requested_qty))
    const actualQty = round3(toNumber(row.actual_qty))
    const unitPrice = round3(toNumber(row.unit_price))

    return {
      voucherLineId: normalizeText(row.voucher_line_id),
      lineNo: Math.max(Math.trunc(toNumber(row.line_no)), 1),
      materialCode: normalizeText(row.material_code),
      displayCode: normalizeText(linePayload.displayCode),
      materialName: normalizeText(row.material_name),
      unit: normalizeText(row.unit),
      requestedQty,
      actualQty,
      unitPrice,
      lineTotal: round3(requestedQty * unitPrice),
      note: normalizeText(row.note),
      availableQtySnapshot: round3(toNumber(linePayload.availableQtySnapshot)),
    } satisfies MaterialIssueVoucherLine
  })

  return {
    voucherId: normalizeText(headerRow.voucher_id),
    voucherCode: normalizeText(headerRow.voucher_code),
    issueKind: mapIssueKind(headerRow.issue_kind),
    status: mapStatus(headerRow.status),
    khId: normalizeText(headerRow.kh_id),
    daId: normalizeText(headerRow.da_id),
    customerName: normalizeText(payload.customerName),
    projectName: normalizeText(payload.projectName),
    requestedQtyTotal: round3(lines.reduce((sum, line) => sum + line.requestedQty, 0)),
    actualQtyTotal: round3(lines.reduce((sum, line) => sum + line.actualQty, 0)),
    totalAmount: round3(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    operationDate: normalizeText(headerRow.operation_date),
    createdAt: normalizeText(headerRow.created_at),
    note: normalizeText(headerRow.note),
    lines,
  }
}

export async function createMaterialIssueVoucher(input: {
  supabase: AnySupabase
  userId: string
  viewerRole: string | null | undefined
  issueKind: 'BAN_VAT_TU' | 'DIEU_CHUYEN'
  khId?: string
  daId?: string
  note?: string
  lines: MaterialIssueLineDraft[]
}) {
  if (!canCreateMaterialIssue(input.viewerRole)) {
    throw new Error('Chỉ KTBH hoặc Admin mới được lập phiếu xuất NVL.')
  }

  const materialOptions = await loadMaterialOptions(input.supabase)
  const materialMap = new Map(materialOptions.map((item) => [item.materialCode, item] as const))
  const customers = await loadCustomerOptions(input.supabase)
  const customerName = customers.find((item) => item.khId === normalizeText(input.khId))?.tenKh || ''

  const normalizedLines = input.lines
    .map((line, index) => {
      const material = materialMap.get(normalizeText(line.materialCode))
      if (!material) throw new Error(`Không tìm thấy vật tư ${line.materialCode}.`)
      const requestedQty = round3(toNumber(line.requestedQty))
      if (requestedQty <= 0) throw new Error(`Dòng ${index + 1} chưa có số lượng hợp lệ.`)
      return {
        lineNo: index + 1,
        materialCode: material.materialCode,
        displayCode: normalizeText(material.displayCode) || material.materialCode,
        materialName: material.materialName,
        unit: material.unit,
        requestedQty,
        unitPrice: round3(toNumber(line.unitPrice)),
        note: normalizeText(line.note),
        availableQtySnapshot: material.availableQty,
      }
    })

  const voucherCode = await buildVoucherCode(input.supabase)
  const payloadJson = {
    issueKind: input.issueKind,
    customerName,
  }

  const { data: headerRow, error: headerError } = await input.supabase
    .from('material_issue_voucher')
    .insert({
      voucher_code: voucherCode,
      issue_kind: input.issueKind,
      status: 'CHO_XAC_NHAN',
      kh_id: normalizeText(input.khId) || null,
      da_id: normalizeText(input.daId) || null,
      note: normalizeText(input.note) || null,
      payload_json: payloadJson,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('voucher_id')
    .maybeSingle()

  if (headerError) throw headerError
  if (!headerRow) throw new Error('Không tạo được phiếu xuất NVL.')

  const voucherId = normalizeText(headerRow.voucher_id)

  const { error: lineError } = await input.supabase.from('material_issue_voucher_line').insert(
    normalizedLines.map((line) => ({
      voucher_id: voucherId,
      line_no: line.lineNo,
      material_code: line.materialCode,
      material_name: line.materialName,
      unit: line.unit,
      requested_qty: line.requestedQty,
      actual_qty: 0,
      unit_price: line.unitPrice,
      note: line.note || null,
      payload_json: {
        availableQtySnapshot: line.availableQtySnapshot,
        displayCode: line.displayCode,
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (lineError) throw lineError

  return {
    voucherId,
    voucherCode,
    lineCount: normalizedLines.length,
  }
}

export async function confirmMaterialIssueVoucher(input: {
  supabase: AnySupabase
  userId: string
  viewerRole: string | null | undefined
  voucherId: string
  note?: string
  lines: Array<{ voucherLineId: string; actualQty: number }>
}) {
  if (!canConfirmMaterialIssue(input.viewerRole)) {
    throw new Error('Chỉ Thủ kho hoặc Admin mới được xác nhận xuất NVL.')
  }

  const detail = await loadMaterialIssueVoucherDetail(input.supabase, input.voucherId)
  if (!detail) throw new Error('Không tìm thấy phiếu xuất NVL.')
  if (detail.status !== 'CHO_XAC_NHAN') throw new Error('Phiếu này đã được xác nhận hoặc không còn mở.')

  const materialOptions = await loadMaterialOptions(input.supabase)
  const availableMap = new Map(materialOptions.map((item) => [item.materialCode, item.availableQty] as const))
  const materialOptionMap = new Map(materialOptions.map((item) => [item.materialCode, item] as const))
  const actualMap = new Map(input.lines.map((line) => [normalizeText(line.voucherLineId), round3(toNumber(line.actualQty))] as const))

  for (const line of detail.lines) {
    const actualQty = actualMap.get(line.voucherLineId) ?? line.actualQty
    if (actualQty < 0) throw new Error(`Dòng ${line.materialName} có số lượng thực xuất không hợp lệ.`)
    if (actualQty > line.requestedQty) throw new Error(`Dòng ${line.materialName} vượt quá số lượng đề xuất.`)
    if (actualQty > round3(toNumber(availableMap.get(line.materialCode)))) {
      throw new Error(`Dòng ${line.materialName} vượt quá tồn khả dụng hiện tại.`)
    }
  }

  const { data: existingMovements, error: existingMovementError } = await input.supabase
    .from('material_stock_movement')
    .select('movement_id')
    .eq('source_type', 'NVL_ISSUE_VOUCHER')
    .eq('source_id', input.voucherId)
    .limit(1)

  if (existingMovementError) throw existingMovementError
  if ((existingMovements ?? []).length > 0) {
    throw new Error('Phiếu này đã ghi stock movement rồi, không thể ghi lặp lại.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const issueNote = normalizeText(input.note) || detail.note
  const updatedLines = detail.lines.map((line) => ({
    ...line,
    actualQty: actualMap.get(line.voucherLineId) ?? line.actualQty,
  }))

  const movements = updatedLines
    .filter((line) => line.actualQty > 0)
    .map((line) => {
      const materialOption = materialOptionMap.get(line.materialCode)
      const stockMaterialCode =
        normalizeText(materialOption?.displayCode) ||
        normalizeText(line.displayCode) ||
        normalizeText(line.materialCode)

      return {
        movement_type: detail.issueKind === 'DIEU_CHUYEN' ? 'TRANSFER_ISSUE' : 'SALES_ISSUE',
        material_code: stockMaterialCode,
        material_name: line.materialName,
        unit: line.unit,
        quantity: line.actualQty,
        physical_effect: 'OUT',
        available_effect: 'DISABLE',
        blocked_effect: 'NONE',
        quality_effect: 'NONE',
        source_type: 'NVL_ISSUE_VOUCHER',
        source_id: input.voucherId,
        source_line_id: line.voucherLineId,
        movement_date: today,
        warehouse_code: 'MAIN',
        warehouse_label: 'Kho NVL',
        note:
          detail.issueKind === 'DIEU_CHUYEN'
            ? `Điều chuyển NVL ${detail.voucherCode}`
            : `Xuất bán NVL ${detail.voucherCode}`,
        payload_json: {
          voucherCode: detail.voucherCode,
          issueKind: detail.issueKind,
          customerName: detail.customerName,
          projectName: detail.projectName,
          unitPrice: line.unitPrice,
          requestedQty: line.requestedQty,
          actualQty: line.actualQty,
          displayCode: stockMaterialCode,
          rawMaterialCode: line.materialCode,
        },
        created_by: input.userId,
      }
    })

  if (movements.length) {
    const { error: insertMovementError } = await input.supabase.from('material_stock_movement').insert(movements)
    if (insertMovementError) throw insertMovementError
  }

  for (const line of updatedLines) {
    const { error: updateLineError } = await input.supabase
      .from('material_issue_voucher_line')
      .update({
        actual_qty: line.actualQty,
        updated_by: input.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('voucher_line_id', line.voucherLineId)

    if (updateLineError) throw updateLineError
  }

  const requestedQtyTotal = round3(updatedLines.reduce((sum, line) => sum + line.requestedQty, 0))
  const actualQtyTotal = round3(updatedLines.reduce((sum, line) => sum + line.actualQty, 0))
  const status: MaterialIssueStatus = actualQtyTotal >= requestedQtyTotal ? 'DA_XUAT' : 'XUAT_MOT_PHAN'

  const { error: updateHeaderError } = await input.supabase
    .from('material_issue_voucher')
    .update({
      status,
      operation_date: today,
      note: issueNote || null,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('voucher_id', input.voucherId)

  if (updateHeaderError) throw updateHeaderError

  return {
    voucherId: input.voucherId,
    voucherCode: detail.voucherCode,
    status,
    actualQtyTotal,
    createdMovementCount: movements.length,
  }
}

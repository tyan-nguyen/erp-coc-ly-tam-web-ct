import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveCanonicalMaterialCode, deriveDisplayCode } from '@/lib/master-data/nvl'
import type { NvlStockMovementHistoryPageData, NvlStockTruthPageData, NvlStockTruthRow } from '@/lib/nvl-stock/types'

type AnySupabase = SupabaseClient
type RawMovementRow = Record<string, unknown>
const NVL_STOCK_MODEL_NAME = 'material_stock_balance'

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

async function isNvlStockSchemaReady(supabase: AnySupabase) {
  const { error } = await supabase.from('material_stock_movement').select('movement_id').limit(1)
  if (!error) return true
  if (isMissingRelationError(error, 'material_stock_movement')) return false
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

async function loadNvlDisplayMap(supabase: AnySupabase) {
  const { data, error } = await supabase.from('nvl').select('*').limit(2000)
  if (error) return new Map<string, { displayCode: string; materialName: string; unit: string }>()

  return new Map(
    ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => row.is_active !== false)
      .map((row) => [
        String(row.nvl_id || '').trim(),
        {
          displayCode: deriveDisplayCode(row),
          materialName: String(row.ten_hang || '').trim(),
          unit: String(row.dvt || '').trim(),
        },
      ] as const)
      .filter(([code]) => code)
  )
}

async function loadRawMaterialMovementRows(supabase: AnySupabase): Promise<RawMovementRow[]> {
  const nvlDisplayMap = await loadNvlDisplayMap(supabase)
  const { data: movementRows, error: movementError } = await supabase
    .from('material_stock_movement')
    .select(
      'movement_id, movement_type, material_code, material_name, unit, quantity, physical_effect, available_effect, blocked_effect, quality_effect, source_type, source_id, source_line_id, movement_date, warehouse_label, note'
    )
    .order('movement_date', { ascending: false })
    .limit(5000)

  if (movementError) throw movementError

  const rows = [...(((movementRows ?? []) as Array<Record<string, unknown>>) || [])].map((row) => {
    const rawMaterialCode = String(row.material_code || '').trim()
    const nvlMeta = nvlDisplayMap.get(rawMaterialCode)

    if (!nvlMeta) return row

    return {
      ...row,
      material_code: nvlMeta.displayCode || rawMaterialCode,
      material_name: String(row.material_name || '').trim() || nvlMeta.materialName,
      unit: String(row.unit || '').trim() || nvlMeta.unit,
    }
  })
  const existingIssueLineIds = new Set(
    rows
      .filter((row) => String(row.source_type || '').trim().toUpperCase() === 'NVL_ISSUE_VOUCHER')
      .map((row) => String(row.source_line_id || '').trim())
      .filter(Boolean)
  )

  const { data: issueHeaders, error: issueHeaderError } = await supabase
    .from('material_issue_voucher')
    .select('voucher_id, voucher_code, issue_kind, status, operation_date, created_at, is_active')
    .eq('is_active', true)
    .in('status', ['DA_XUAT', 'XUAT_MOT_PHAN'])
    .limit(500)

  if (issueHeaderError) return rows

  const voucherById = new Map(
    ((issueHeaders ?? []) as Array<Record<string, unknown>>)
      .map((row) => [String(row.voucher_id || '').trim(), row] as const)
      .filter(([voucherId]) => voucherId)
  )

  const voucherIds = Array.from(voucherById.keys())
  if (!voucherIds.length) return rows

  const { data: issueLines, error: issueLineError } = await supabase
    .from('material_issue_voucher_line')
    .select('voucher_id, voucher_line_id, material_code, material_name, unit, actual_qty, payload_json, is_active')
    .eq('is_active', true)
    .in('voucher_id', voucherIds)
    .limit(2000)

  if (issueLineError) return rows

  let syntheticIndex = 1

  for (const line of (issueLines ?? []) as Array<Record<string, unknown>>) {
    const voucherLineId = String(line.voucher_line_id || '').trim()
    if (!voucherLineId || existingIssueLineIds.has(voucherLineId)) continue

    const actualQty = Number(line.actual_qty || 0)
    if (!(actualQty > 0)) continue

    const voucherId = String(line.voucher_id || '').trim()
    const header = voucherById.get(voucherId)
    if (!header) continue

    const payload = (line.payload_json as Record<string, unknown> | null) || {}
    const displayCode = String(payload.displayCode || '').trim()
    const rawMaterialCode = String(line.material_code || '').trim()
    const nvlMeta = nvlDisplayMap.get(rawMaterialCode)
    const materialCode = displayCode || nvlMeta?.displayCode || rawMaterialCode
    const voucherCode = String(header.voucher_code || '').trim()
    const issueKind = String(header.issue_kind || '').trim().toUpperCase()
    const movementDate =
      String(header.operation_date || '').trim() ||
      String(header.created_at || '').trim().slice(0, 10)

    rows.push({
      movement_id: `synthetic-nvl-issue-${syntheticIndex++}`,
      movement_type: issueKind === 'DIEU_CHUYEN' ? 'TRANSFER_ISSUE' : 'SALES_ISSUE',
      material_code: materialCode,
      material_name: String(line.material_name || '').trim() || nvlMeta?.materialName || materialCode,
      unit: String(line.unit || '').trim() || nvlMeta?.unit || '',
      quantity: actualQty,
      physical_effect: 'OUT',
      available_effect: 'DISABLE',
      blocked_effect: 'NONE',
      quality_effect: 'NONE',
      source_type: 'NVL_ISSUE_VOUCHER',
      source_id: voucherId,
      source_line_id: voucherLineId,
      movement_date: movementDate,
      warehouse_label: 'Kho NVL',
      note: issueKind === 'DIEU_CHUYEN' ? `Điều chuyển NVL ${voucherCode}` : `Xuất bán NVL ${voucherCode}`,
    })
  }

  return rows
}

function buildNvlStockTruthRowsFromMovements(movementRows: RawMovementRow[]): NvlStockTruthRow[] {
  const bucket = new Map<
    string,
    {
      materialCode: string
      materialName: string
      unit: string
      stockQty: number
      availableQty: number
      blockedQty: number
      defectiveQty: number
      lastMovementDate: string
    }
  >()

  for (const row of movementRows) {
    const materialCode = deriveCanonicalMaterialCode({
      materialCode: row.material_code,
      materialName: row.material_name,
    })
    if (!materialCode) continue
    const current =
      bucket.get(materialCode) || {
        materialCode,
        materialName: String(row.material_name || materialCode),
        unit: String(row.unit || ''),
        stockQty: 0,
        availableQty: 0,
        blockedQty: 0,
        defectiveQty: 0,
        lastMovementDate: '',
      }

    const quantity = Number(row.quantity || 0)
    const movementType = String(row.movement_type || '').toUpperCase()
    const physicalEffect = String(row.physical_effect || '').toUpperCase()
    const availableEffect = String(row.available_effect || '').toUpperCase()
    const blockedEffect = String(row.blocked_effect || '').toUpperCase()
    const qualityEffect = String(row.quality_effect || '').toUpperCase()
    const movementDate = String(row.movement_date || '')

    if (movementType === 'PURCHASE_RECEIPT_ACCEPTED') {
      current.stockQty += quantity
      current.availableQty += quantity
    } else if (movementType === 'PURCHASE_RECEIPT_DEFECTIVE') {
      current.stockQty += quantity
      current.blockedQty += quantity
      current.defectiveQty += quantity
    } else if (movementType === 'PURCHASE_RECEIPT_REJECTED') {
      // rejected does not enter physical or available stock
    } else if (movementType === 'ISSUE_TO_PRODUCTION') {
      current.stockQty -= quantity
      current.availableQty -= quantity
    } else {
      if (physicalEffect === 'IN') current.stockQty += quantity
      if (physicalEffect === 'OUT') current.stockQty -= quantity

      if (availableEffect === 'ENABLE') current.availableQty += quantity
      if (availableEffect === 'DISABLE') current.availableQty -= quantity

      if (blockedEffect === 'ENABLE') current.blockedQty += quantity
      if (blockedEffect === 'DISABLE') current.blockedQty -= quantity

      if (qualityEffect === 'DEFECTIVE') current.defectiveQty += quantity
    }

    if (current.availableQty < 0) current.availableQty = 0
    if (current.blockedQty < 0) current.blockedQty = 0

    if (!current.lastMovementDate || movementDate > current.lastMovementDate) {
      current.lastMovementDate = movementDate
    }

    bucket.set(materialCode, current)
  }

  for (const current of bucket.values()) {
    const maxBlocked = Math.max(current.stockQty, 0)
    if (current.blockedQty > maxBlocked) current.blockedQty = maxBlocked

    const maxAvailable = Math.max(current.stockQty - current.blockedQty, 0)
    if (current.availableQty > maxAvailable) current.availableQty = maxAvailable
    if (current.availableQty < 0) current.availableQty = 0
  }

  return Array.from(bucket.values()).sort(
    (a, b) => b.stockQty - a.stockQty || a.materialName.localeCompare(b.materialName)
  )
}

function round3(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 1000) / 1000
}

function mapNvlStockBalanceRow(row: Record<string, unknown>): NvlStockTruthRow {
  return {
    materialCode: String(row.material_code || '').trim(),
    materialName: String(row.material_name || row.material_code || '').trim(),
    unit: String(row.unit || '').trim(),
    stockQty: round3(row.stock_qty),
    availableQty: round3(row.available_qty),
    blockedQty: round3(row.blocked_qty),
    defectiveQty: round3(row.defective_qty),
    lastMovementDate: String(row.last_movement_date || '').trim(),
  }
}

async function loadNvlStockReadModelRows(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('material_stock_balance')
    .select('material_code, material_name, unit, stock_qty, available_qty, blocked_qty, defective_qty, last_movement_date')
    .order('stock_qty', { ascending: false })
    .order('material_name', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'material_stock_balance')) return null
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapNvlStockBalanceRow)
}

async function buildNvlStockTruthRowsFromLegacy(supabase: AnySupabase) {
  const movementRows = await loadRawMaterialMovementRows(supabase)
  return buildNvlStockTruthRowsFromMovements(movementRows)
}

function compareNvlStockRows(sourceRows: NvlStockTruthRow[], readModelRows: NvlStockTruthRow[]) {
  const sourceMap = new Map(sourceRows.map((row) => [row.materialCode, row]))
  const readModelMap = new Map(readModelRows.map((row) => [row.materialCode, row]))
  const keys = Array.from(new Set([...sourceMap.keys(), ...readModelMap.keys()])).sort()
  const mismatches: Array<{ materialCode: string; reason: string }> = []

  for (const materialCode of keys) {
    const source = sourceMap.get(materialCode)
    const readModel = readModelMap.get(materialCode)
    if (!source || !readModel) {
      mismatches.push({ materialCode, reason: source ? 'missing_read_model_row' : 'extra_read_model_row' })
      continue
    }

    for (const field of ['stockQty', 'availableQty', 'blockedQty', 'defectiveQty'] as const) {
      if (round3(source[field]) !== round3(readModel[field])) {
        mismatches.push({ materialCode, reason: `mismatch_${field}` })
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

export async function refreshNvlStockReadModel(supabase: SupabaseClient) {
  const rows = await buildNvlStockTruthRowsFromLegacy(supabase)
  const now = new Date().toISOString()

  const deleteResult = await supabase.from('material_stock_balance').delete().neq('material_code', '')
  if (deleteResult.error) throw deleteResult.error

  if (rows.length) {
    const { error } = await supabase.from('material_stock_balance').insert(
      rows.map((row) => ({
        material_code: row.materialCode,
        material_name: row.materialName,
        unit: row.unit || null,
        stock_qty: row.stockQty,
        available_qty: row.availableQty,
        blocked_qty: row.blockedQty,
        defective_qty: row.defectiveQty,
        last_movement_date: row.lastMovementDate || null,
        refreshed_at: now,
      }))
    )
    if (error) throw error
  }

  const { error: healthError } = await supabase.from('stock_read_model_health').upsert({
    model_name: NVL_STOCK_MODEL_NAME,
    is_verified: false,
    source_row_count: rows.length,
    read_model_row_count: rows.length,
    mismatch_count: 0,
    refreshed_at: now,
    verified_at: null,
    note: 'Refreshed from legacy NVL stock truth calculation.',
  })
  if (healthError) throw healthError

  return rows
}

export async function verifyNvlStockReadModel(supabase: SupabaseClient) {
  const sourceRows = await buildNvlStockTruthRowsFromLegacy(supabase)
  const readModelRows = (await loadNvlStockReadModelRows(supabase)) ?? []
  const comparison = compareNvlStockRows(sourceRows, readModelRows)
  const now = new Date().toISOString()

  const { error } = await supabase.from('stock_read_model_health').upsert({
    model_name: NVL_STOCK_MODEL_NAME,
    is_verified: comparison.matched,
    source_row_count: sourceRows.length,
    read_model_row_count: readModelRows.length,
    mismatch_count: comparison.mismatchCount,
    verified_at: comparison.matched ? now : null,
    note: comparison.matched ? 'Read model matches legacy NVL stock truth calculation.' : JSON.stringify(comparison.mismatches),
  })
  if (error) throw error

  return {
    modelName: NVL_STOCK_MODEL_NAME,
    sourceRowCount: sourceRows.length,
    readModelRowCount: readModelRows.length,
    ...comparison,
  }
}

export async function loadNvlStockTruthPageData(supabase: AnySupabase): Promise<NvlStockTruthPageData> {
  const schemaReady = await isNvlStockSchemaReady(supabase)

  if (!schemaReady) {
    return {
      schemaReady: false,
      summaryCards: [
        {
          label: 'Stock truth',
          value: 'Chưa sẵn sàng',
          helpText: 'Schema tồn kho NVL chưa được dựng trong v2 nên chưa thể hiện số tồn thật.',
        },
        {
          label: 'Nguyên tắc',
          value: 'Không bịa số',
          helpText: 'Màn này sẽ không tự đoán tồn chỉ từ kế hoạch hay đơn mua.',
        },
      ],
      rows: [],
    }
  }

  const readModelVerified = await isStockReadModelVerified(supabase, NVL_STOCK_MODEL_NAME)
  const rows = readModelVerified
    ? (await loadNvlStockReadModelRows(supabase)) ?? (await buildNvlStockTruthRowsFromLegacy(supabase))
    : await buildNvlStockTruthRowsFromLegacy(supabase)

  return {
    schemaReady: true,
    summaryCards: [
      {
        label: 'Stock truth',
        value: 'Đã sẵn sàng',
        helpText: 'Read-model tồn kho NVL đang đọc trực tiếp từ material_stock_movement.',
      },
      {
        label: 'Dòng NVL',
        value: String(rows.length),
        helpText: 'Số NVL đã có movement kho thực tế.',
      },
    ],
    rows,
  }
}

function formatMovementLabel(value: string) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PURCHASE_RECEIPT_ACCEPTED') return 'Nhập kho đạt'
  if (normalized === 'PURCHASE_RECEIPT_DEFECTIVE') return 'Nhập kho lỗi'
  if (normalized === 'PURCHASE_RECEIPT_REJECTED') return 'Nhập kho từ chối'
  if (normalized === 'ISSUE_TO_PRODUCTION') return 'Xuất cho sản xuất'
  if (normalized === 'SALES_ISSUE') return 'Xuất bán NVL'
  if (normalized === 'TRANSFER_ISSUE') return 'Điều chuyển NVL'
  if (normalized === 'OPENING_BALANCE_IN') return 'Nhập tồn đầu kỳ'
  if (normalized === 'OPENING_BALANCE_OUT') return 'Giảm tồn đầu kỳ'
  if (normalized === 'STOCK_COUNT_GAIN') return 'Kiểm kê tăng'
  if (normalized === 'STOCK_COUNT_LOSS') return 'Kiểm kê giảm'
  return normalized || '-'
}

export async function loadNvlStockMovementHistoryPageData(input: {
  supabase: AnySupabase
  materialCode: string
}): Promise<NvlStockMovementHistoryPageData> {
  const schemaReady = await isNvlStockSchemaReady(input.supabase)
  const materialCode = deriveCanonicalMaterialCode({ materialCode: input.materialCode })

  if (!schemaReady) {
    return {
      schemaReady: false,
      materialCode,
      materialName: materialCode,
      unit: '',
      summaryCards: [
        {
          label: 'Lịch sử biến động',
          value: 'Chưa sẵn sàng',
          helpText: 'Schema stock movement chưa có nên chưa thể giải thích biến động tồn.',
        },
      ],
      rows: [],
    }
  }

  const movementRows = await loadRawMaterialMovementRows(input.supabase)

  const rows = movementRows
    .map((row) => ({
      movementId: String(row.movement_id || ''),
      movementType: formatMovementLabel(String(row.movement_type || '')),
      materialCode: deriveCanonicalMaterialCode({
        materialCode: row.material_code,
        materialName: row.material_name,
      }),
      materialName: String(row.material_name || row.material_code || ''),
      unit: String(row.unit || ''),
      quantity: Number(row.quantity || 0),
      physicalEffect: String(row.physical_effect || ''),
      availableEffect: String(row.available_effect || ''),
      blockedEffect: String(row.blocked_effect || ''),
      qualityEffect: String(row.quality_effect || ''),
      sourceType: String(row.source_type || ''),
      sourceId: String(row.source_id || ''),
      sourceLineId: String(row.source_line_id || ''),
      movementDate: String(row.movement_date || ''),
      warehouseLabel: String(row.warehouse_label || ''),
      note: String(row.note || ''),
    }))
    .filter((row) => row.materialCode === materialCode)

  const firstRow = rows[0]
  const totalIn = rows
    .filter((row) => row.physicalEffect === 'IN')
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const totalOut = rows
    .filter((row) => row.physicalEffect === 'OUT')
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0)

  return {
    schemaReady: true,
    materialCode,
    materialName: firstRow?.materialName || materialCode,
    unit: firstRow?.unit || '',
    summaryCards: [
      {
        label: 'Số biến động',
        value: String(rows.length),
        helpText: 'Tổng số movement đã ghi cho vật tư này.',
      },
      {
        label: 'Tổng nhập',
        value: String(Math.round(totalIn * 1000) / 1000),
        helpText: 'Tổng số lượng đã đi vào kho qua các movement.',
      },
      {
        label: 'Tổng xuất',
        value: String(Math.round(totalOut * 1000) / 1000),
        helpText: 'Tổng số lượng đã đi ra khỏi kho qua các movement.',
      },
      {
        label: 'Biến động cuối',
        value: firstRow?.movementDate || '-',
        helpText: 'Ngày gần nhất có movement ảnh hưởng tới NVL này.',
      },
    ],
    rows,
  }
}

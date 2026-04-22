import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveDisplayCode, formatNhomHangLabel } from '@/lib/master-data/nvl'
import { loadNvlStockTruthPageData } from '@/lib/nvl-stock/page-data'
import type {
  InventoryCountCatalogOption,
  InventoryCountCostClassification,
  InventoryCountDetail,
  InventoryCountDraftLine,
  InventoryCountItemType,
  InventoryCountSheetSummaryRow,
  InventoryCountType,
} from '@/lib/inventory-counting/types'

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

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function normalizeLookupKey(value: unknown) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
}

function resolveItemTypeFromGroup(group: unknown): InventoryCountItemType {
  const normalized = String(group || '').trim().toUpperCase()
  if (normalized === 'CONG_CU_DUNG_CU') return 'TOOL'
  if (normalized === 'TAI_SAN') return 'ASSET'
  return 'NVL'
}

function normalizeCountType(value: unknown): InventoryCountType {
  return String(value || '').toUpperCase() === 'OPENING_BALANCE' ? 'OPENING_BALANCE' : 'OPERATIONAL'
}

function classifyInventoryCountLine(input: {
  itemType: InventoryCountItemType
  varianceQty: number
  variancePct: number
  allowedLossPct: number
}): InventoryCountCostClassification {
  const varianceQty = round3(toNumber(input.varianceQty))
  if (varianceQty === 0) return 'KHONG_AP_DUNG'
  if (varianceQty > 0) return 'TON_TANG'

  if (input.itemType === 'FINISHED_GOOD' || input.itemType === 'TOOL' || input.itemType === 'ASSET') {
    return 'CHI_PHI_THAT_THOAT'
  }

  return Math.abs(round4(toNumber(input.variancePct))) <= round4(toNumber(input.allowedLossPct))
    ? 'CHI_PHI_QUAN_LY'
    : 'CHI_PHI_THAT_THOAT'
}

async function buildCountSheetCode(supabase: AnySupabase, countType: InventoryCountType) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = countType === 'OPENING_BALANCE' ? 'KK-ODK' : 'KK-VH'
  const datePrefix = `${prefix}-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_code')
    .ilike('count_sheet_code', `${datePrefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const code = String(row.count_sheet_code || '').trim()
    if (!code.startsWith(datePrefix)) continue
    const suffix = code.slice(datePrefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${datePrefix}${String(nextSequence).padStart(3, '0')}`
}

export async function isInventoryCountingSchemaReady(supabase: AnySupabase) {
  const [sheetResult, lineResult, serialResult] = await Promise.all([
    supabase.from('inventory_count_sheet').select('count_sheet_id').limit(1),
    supabase.from('inventory_count_line').select('count_line_id').limit(1),
    supabase.from('inventory_count_serial').select('count_serial_id').limit(1),
  ])

  if (!sheetResult.error && !lineResult.error && !serialResult.error) return true
  if (
    (sheetResult.error && isMissingRelationError(sheetResult.error, 'inventory_count_sheet')) ||
    (lineResult.error && isMissingRelationError(lineResult.error, 'inventory_count_line')) ||
    (serialResult.error && isMissingRelationError(serialResult.error, 'inventory_count_serial'))
  ) {
    return false
  }

  if (sheetResult.error) throw sheetResult.error
  if (lineResult.error) throw lineResult.error
  if (serialResult.error) throw serialResult.error
  return true
}

export async function loadInventoryCountCatalogOptions(supabase: AnySupabase): Promise<InventoryCountCatalogOption[]> {
  const [stockPageData, materialResult] = await Promise.all([
    loadNvlStockTruthPageData(supabase).catch(() => ({ schemaReady: false, rows: [] })),
    supabase.from('nvl').select('*').limit(2000),
  ])

  if (materialResult.error) return []

  const stockRows = stockPageData.rows || []
  const stockByCode = new Map(
    stockRows.map((row) => [
      normalizeLookupKey(row.materialCode),
      {
        materialCode: String(row.materialCode || '').trim(),
        stockQty: round3(toNumber(row.stockQty)),
      },
    ])
  )
  const stockByName = new Map(
    stockRows.map((row) => [
      normalizeLookupKey(row.materialName),
      {
        materialCode: String(row.materialCode || '').trim(),
        stockQty: round3(toNumber(row.stockQty)),
      },
    ])
  )

  return ((materialResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const value = String(row.nvl_id || '').trim()
      const itemName = String(row.ten_hang || '').trim()
      if (!value || !itemName) return null
      const derivedCode = deriveDisplayCode(row)
      const normalizedItemName = normalizeLookupKey(itemName)
      const matchedStock =
        stockByCode.get(normalizeLookupKey(derivedCode)) ||
        stockByName.get(normalizedItemName) ||
        stockRows
          .map((stockRow) => ({
            materialCode: String(stockRow.materialCode || '').trim(),
            stockQty: round3(toNumber(stockRow.stockQty)),
            normalizedName: normalizeLookupKey(stockRow.materialName),
          }))
          .find(
            (stockRow) =>
              !!stockRow.normalizedName &&
              !!normalizedItemName &&
              (stockRow.normalizedName.includes(normalizedItemName) ||
                normalizedItemName.includes(stockRow.normalizedName))
          ) ||
        null
      const itemCode = matchedStock?.materialCode || derivedCode
      const systemQty = matchedStock?.stockQty || 0
      return {
        value,
        itemType: resolveItemTypeFromGroup(row.nhom_hang),
        itemCode,
        itemName,
        itemGroup: formatNhomHangLabel(row.nhom_hang),
        unit: String(row.dvt || '').trim() || 'cái',
        allowedLossPct: round4(toNumber(row.hao_hut_pct)),
        systemQty,
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a!.itemName).localeCompare(String(b!.itemName), 'vi')) as InventoryCountCatalogOption[]
}

export async function loadInventoryCountSheetSummaries(
  supabase: AnySupabase
): Promise<{ schemaReady: boolean; rows: InventoryCountSheetSummaryRow[] }> {
  const schemaReady = await isInventoryCountingSchemaReady(supabase)
  if (!schemaReady) return { schemaReady: false, rows: [] }

  const { data: headerRows, error: headerError } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, scope_type, count_date, status, note, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (headerError) throw headerError

  const sheetIds = ((headerRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.count_sheet_id || ''))
    .filter(Boolean)

  if (!sheetIds.length) return { schemaReady: true, rows: [] }

  const { data: lineRows, error: lineError } = await supabase
    .from('inventory_count_line')
    .select('count_sheet_id, count_line_id, system_qty, counted_qty, variance_qty')
    .in('count_sheet_id', sheetIds)

  if (lineError) throw lineError

  const lineMeta = new Map<string, { lineCount: number; systemQtyTotal: number; countedQtyTotal: number; varianceQtyTotal: number }>()

  for (const row of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const countSheetId = String(row.count_sheet_id || '')
    if (!countSheetId) continue
    const current = lineMeta.get(countSheetId) || { lineCount: 0, systemQtyTotal: 0, countedQtyTotal: 0, varianceQtyTotal: 0 }
    current.lineCount += 1
    current.systemQtyTotal += toNumber(row.system_qty)
    current.countedQtyTotal += toNumber(row.counted_qty)
    current.varianceQtyTotal += toNumber(row.variance_qty)
    lineMeta.set(countSheetId, current)
  }

  const rows: InventoryCountSheetSummaryRow[] = ((headerRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const countSheetId = String(row.count_sheet_id || '')
    const meta = lineMeta.get(countSheetId) || { lineCount: 0, systemQtyTotal: 0, countedQtyTotal: 0, varianceQtyTotal: 0 }
    return {
      countSheetId,
      countSheetCode: String(row.count_sheet_code || countSheetId || '-'),
      countType: normalizeCountType(row.count_type),
      scopeType: String(row.scope_type || 'SELECTED_ITEMS') as InventoryCountSheetSummaryRow['scopeType'],
      countDate: String(row.count_date || ''),
      status: String(row.status || 'NHAP') as InventoryCountSheetSummaryRow['status'],
      note: String(row.note || ''),
      lineCount: meta.lineCount,
      systemQtyTotal: round3(meta.systemQtyTotal),
      countedQtyTotal: round3(meta.countedQtyTotal),
      varianceQtyTotal: round3(meta.varianceQtyTotal),
      createdAt: String(row.created_at || ''),
    }
  })

  return { schemaReady: true, rows }
}

export async function createInventoryCountSheetDraft(input: {
  supabase: AnySupabase
  userId: string
  countType: InventoryCountType
  countDate: string
  note?: string
  rows: InventoryCountDraftLine[]
}) {
  const schemaReady = await isInventoryCountingSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng kiểm kê vật tư chưa sẵn sàng trên DB. Cần chạy schema inventory_count trước.')
  }

  const lines = input.rows.filter(
    (row) => String(row.itemCode || '').trim() && String(row.itemName || '').trim() && Number.isFinite(Number(row.countedQty))
  )

  if (!lines.length) {
    throw new Error('Phiếu kiểm kê cần ít nhất một dòng vật tư hợp lệ.')
  }

  const countDate = String(input.countDate || '').trim()
  if (!countDate) {
    throw new Error('Phiếu kiểm kê cần có ngày kiểm kê.')
  }

  const countSheetCode = await buildCountSheetCode(input.supabase, input.countType)
  const payloadSnapshot = {
    countType: input.countType,
    lineCount: lines.length,
  }

  const { data: headerRow, error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .insert({
      count_sheet_code: countSheetCode,
      count_type: input.countType,
      scope_type: 'SELECTED_ITEMS',
      count_date: countDate,
      status: 'NHAP',
      note: String(input.note || '').trim(),
      payload_json: payloadSnapshot,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('count_sheet_id, count_sheet_code')
    .single()

  if (headerError || !headerRow) throw headerError || new Error('Không tạo được phiếu kiểm kê.')

  const countSheetId = String((headerRow as Record<string, unknown>).count_sheet_id || '')
  if (!countSheetId) {
    throw new Error('Không lấy được mã phiếu kiểm kê sau khi lưu.')
  }

  const linePayload = lines.map((row, index) => {
    const systemQty = round3(toNumber(row.systemQty))
    const countedQty = round3(toNumber(row.countedQty))
    const varianceQty = round3(countedQty - systemQty)
    const variancePct = systemQty === 0 ? 0 : round4((varianceQty / systemQty) * 100)
    return {
      count_sheet_id: countSheetId,
      line_no: index + 1,
      item_type: row.itemType,
      item_id: String(row.itemId || '').trim() || null,
      item_code: String(row.itemCode || '').trim(),
      item_name: String(row.itemName || '').trim(),
      item_group: String(row.itemGroup || '').trim() || null,
      unit: String(row.unit || '').trim() || null,
      system_qty: systemQty,
      counted_qty: countedQty,
      variance_qty: varianceQty,
      variance_pct: variancePct,
      allowed_loss_pct: round4(toNumber(row.allowedLossPct)),
      note: String(row.note || '').trim() || null,
      payload_json: {
        allowedLossPct: round4(toNumber(row.allowedLossPct)),
      },
      created_by: input.userId,
      updated_by: input.userId,
    }
  })

  const { error: lineError } = await input.supabase.from('inventory_count_line').insert(linePayload)
  if (lineError) throw lineError

  return {
    countSheetId,
    countSheetCode: String((headerRow as Record<string, unknown>).count_sheet_code || countSheetCode),
    lineCount: linePayload.length,
  }
}

export async function loadInventoryCountDetail(input: {
  supabase: AnySupabase
  countSheetId: string
}): Promise<InventoryCountDetail | null> {
  const schemaReady = await isInventoryCountingSchemaReady(input.supabase)
  if (!schemaReady) return null

  const { data: headerRow, error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, scope_type, count_date, status, note, created_at')
    .eq('count_sheet_id', input.countSheetId)
    .single()

  if (headerError) {
    if (isMissingRelationError(headerError, 'inventory_count_sheet')) return null
    throw headerError
  }
  if (!headerRow) return null

  const { data: lineRows, error: lineError } = await input.supabase
    .from('inventory_count_line')
    .select(
      'count_line_id, line_no, item_type, item_id, item_code, item_name, item_group, unit, system_qty, counted_qty, variance_qty, variance_pct, allowed_loss_pct, cost_classification, note'
    )
    .eq('count_sheet_id', input.countSheetId)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  return {
    countSheetId: String((headerRow as Record<string, unknown>).count_sheet_id || ''),
    countSheetCode: String((headerRow as Record<string, unknown>).count_sheet_code || ''),
    countType: normalizeCountType((headerRow as Record<string, unknown>).count_type),
    scopeType: String((headerRow as Record<string, unknown>).scope_type || 'SELECTED_ITEMS') as InventoryCountDetail['scopeType'],
    countDate: String((headerRow as Record<string, unknown>).count_date || ''),
    status: String((headerRow as Record<string, unknown>).status || 'NHAP') as InventoryCountDetail['status'],
    note: String((headerRow as Record<string, unknown>).note || ''),
    createdAt: String((headerRow as Record<string, unknown>).created_at || ''),
    lines: ((lineRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      countLineId: String(row.count_line_id || ''),
      lineNo: toNumber(row.line_no),
      itemType: String(row.item_type || 'NVL') as InventoryCountDetail['lines'][number]['itemType'],
      itemId: String(row.item_id || ''),
      itemCode: String(row.item_code || ''),
      itemName: String(row.item_name || ''),
      itemGroup: String(row.item_group || ''),
      unit: String(row.unit || ''),
      systemQty: round3(toNumber(row.system_qty)),
      countedQty: round3(toNumber(row.counted_qty)),
      varianceQty: round3(toNumber(row.variance_qty)),
      variancePct: round4(toNumber(row.variance_pct)),
      allowedLossPct: round4(toNumber(row.allowed_loss_pct)),
      costClassification: row.cost_classification
        ? (String(row.cost_classification) as InventoryCountDetail['lines'][number]['costClassification'])
        : null,
      note: String(row.note || ''),
    })),
  }
}

export async function saveInventoryCountDraft(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  note: string
  lines: Array<{
    countLineId: string
    countedQty: number
    note: string
  }>
}) {
  const detail = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê để lưu.')
  }
  if (detail.status !== 'NHAP' && detail.status !== 'CHO_XAC_NHAN_KHO') {
    throw new Error('Phiếu kiểm kê này đã qua bước nhập, không thể sửa tiếp.')
  }

  const detailLineMap = new Map(detail.lines.map((line) => [line.countLineId, line]))
  const updatePayload = input.lines.map((line) => {
    const base = detailLineMap.get(line.countLineId)
    if (!base) {
      throw new Error('Có dòng kiểm kê không còn tồn tại trên phiếu.')
    }
    const countedQty = round3(toNumber(line.countedQty))
    const varianceQty = round3(countedQty - base.systemQty)
    const variancePct = base.systemQty === 0 ? 0 : round4((varianceQty / base.systemQty) * 100)
    return {
      count_line_id: line.countLineId,
      counted_qty: countedQty,
      variance_qty: varianceQty,
      variance_pct: variancePct,
      note: String(line.note || '').trim() || null,
      updated_by: input.userId,
    }
  })

  for (const row of updatePayload) {
    const { error } = await input.supabase
      .from('inventory_count_line')
      .update({
        counted_qty: row.counted_qty,
        variance_qty: row.variance_qty,
        variance_pct: row.variance_pct,
        note: row.note,
        updated_by: row.updated_by,
      })
      .eq('count_line_id', row.count_line_id)

    if (error) throw error
  }

  const { error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .update({
      note: String(input.note || '').trim(),
      status: 'CHO_XAC_NHAN_KHO',
      updated_by: input.userId,
    })
    .eq('count_sheet_id', input.countSheetId)

  if (headerError) throw headerError

  const refreshed = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê sau khi lưu.')
  return refreshed
}

export async function confirmInventoryCountByWarehouse(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  const detail = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê để xác nhận kho.')
  }
  if (detail.status !== 'CHO_XAC_NHAN_KHO' && detail.status !== 'NHAP') {
    throw new Error('Phiếu kiểm kê này không còn ở bước xác nhận kho.')
  }

  const { error } = await input.supabase
    .from('inventory_count_sheet')
    .update({
      status: 'CHO_DUYET_CHENH_LECH',
      warehouse_confirmed_by: input.userId,
      warehouse_confirmed_at: new Date().toISOString(),
      updated_by: input.userId,
    })
    .eq('count_sheet_id', input.countSheetId)

  if (error) throw error

  const refreshed = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê sau khi xác nhận kho.')
  return refreshed
}

export async function approveInventoryCountAndPostMovements(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  const detail = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê để duyệt.')
  }
  if (detail.status !== 'CHO_DUYET_CHENH_LECH') {
    throw new Error('Phiếu kiểm kê này chưa ở bước chờ duyệt chênh lệch.')
  }

  const { error: movementSchemaError } = await input.supabase.from('material_stock_movement').select('movement_id').limit(1)
  if (movementSchemaError) {
    if (isMissingRelationError(movementSchemaError, 'material_stock_movement')) {
      throw new Error('Schema stock movement chưa sẵn sàng. Cần tạo bảng material_stock_movement trước.')
    }
    throw movementSchemaError
  }

  const { data: existingMovements, error: existingMovementError } = await input.supabase
    .from('material_stock_movement')
    .select('movement_id')
    .eq('source_type', 'INVENTORY_COUNT_SHEET')
    .eq('source_id', input.countSheetId)
    .limit(1)

  if (existingMovementError) throw existingMovementError
  if (Array.isArray(existingMovements) && existingMovements.length > 0) {
    throw new Error('Phiếu kiểm kê này đã được ghi điều chỉnh tồn rồi.')
  }

  const lineUpdates = detail.lines.map((line) => {
    const classification = classifyInventoryCountLine({
      itemType: line.itemType,
      varianceQty: line.varianceQty,
      variancePct: line.variancePct,
      allowedLossPct: line.allowedLossPct,
    })
    return {
      countLineId: line.countLineId,
      classification,
    }
  })

  for (const row of lineUpdates) {
    const { error } = await input.supabase
      .from('inventory_count_line')
      .update({
        cost_classification: row.classification,
        updated_by: input.userId,
      })
      .eq('count_line_id', row.countLineId)

    if (error) throw error
  }

  const movementDate = detail.countDate || new Date().toISOString().slice(0, 10)
  const baseSourceType = 'INVENTORY_COUNT_SHEET'
  const movements = detail.lines.flatMap((line) => {
    const varianceQty = round3(toNumber(line.varianceQty))
    if (varianceQty === 0) return []

    const classification =
      lineUpdates.find((item) => item.countLineId === line.countLineId)?.classification || 'KHONG_AP_DUNG'
    const isOpeningBalance = detail.countType === 'OPENING_BALANCE'
    const quantity = Math.abs(varianceQty)
    const payload = {
      countSheetCode: detail.countSheetCode,
      countType: detail.countType,
      lineNo: line.lineNo,
      systemQty: line.systemQty,
      countedQty: line.countedQty,
      varianceQty,
      variancePct: line.variancePct,
      allowedLossPct: line.allowedLossPct,
      costClassification: classification,
      itemType: line.itemType,
    }

    if (varianceQty > 0) {
      return [
        {
          movement_type: isOpeningBalance ? 'OPENING_BALANCE_IN' : 'STOCK_COUNT_GAIN',
          material_code: line.itemCode,
          material_name: line.itemName,
          unit: line.unit,
          quantity,
          physical_effect: 'IN',
          available_effect: 'ENABLE',
          blocked_effect: 'NONE',
          quality_effect: 'ACCEPTED',
          source_type: baseSourceType,
          source_id: detail.countSheetId,
          source_line_id: line.countLineId,
          movement_date: movementDate,
          warehouse_code: 'MAIN',
          warehouse_label: 'Kho tổng',
          note: `${isOpeningBalance ? 'Nhập tồn đầu kỳ' : 'Điều chỉnh tăng từ kiểm kê'} - ${detail.countSheetCode}`,
          payload_json: payload,
          created_by: input.userId,
        },
      ]
    }

    return [
      {
        movement_type: isOpeningBalance ? 'OPENING_BALANCE_OUT' : 'STOCK_COUNT_LOSS',
        material_code: line.itemCode,
        material_name: line.itemName,
        unit: line.unit,
        quantity,
        physical_effect: 'OUT',
        available_effect: 'DISABLE',
        blocked_effect: 'NONE',
        quality_effect: 'NONE',
        source_type: baseSourceType,
        source_id: detail.countSheetId,
        source_line_id: line.countLineId,
        movement_date: movementDate,
        warehouse_code: 'MAIN',
        warehouse_label: 'Kho tổng',
        note: `${isOpeningBalance ? 'Xuất tồn đầu kỳ' : 'Điều chỉnh giảm từ kiểm kê'} - ${detail.countSheetCode}`,
        payload_json: payload,
        created_by: input.userId,
      },
    ]
  })

  if (movements.length > 0) {
    const { error: insertMovementError } = await input.supabase.from('material_stock_movement').insert(movements)
    if (insertMovementError) throw insertMovementError
  }

  const nowIso = new Date().toISOString()
  const { error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .update({
      status: 'DA_DIEU_CHINH_TON',
      approved_by: input.userId,
      approved_at: nowIso,
      posted_by: input.userId,
      posted_at: nowIso,
      updated_by: input.userId,
    })
    .eq('count_sheet_id', input.countSheetId)

  if (headerError) throw headerError

  const refreshed = await loadInventoryCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê sau khi duyệt.')
  return refreshed
}

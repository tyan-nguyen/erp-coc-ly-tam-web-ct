import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadFinishedGoodsCurrentInventoryRows,
  loadFinishedGoodsInventoryPageData,
} from '@/lib/ton-kho-thanh-pham/repository'
import { isInventoryCountingSchemaReady } from '@/lib/inventory-counting/repository'
import {
  activateDraftOpeningBalanceLots,
  createDraftOpeningBalanceLotAndSerials,
  createOpeningBalanceLotAndSerials,
} from '@/lib/pile-serial/repository'
import type {
  FinishedGoodsCountCatalogOption,
  FinishedGoodsCountDetail,
  FinishedGoodsCountDetailLine,
  FinishedGoodsCountDetailSerialRow,
  FinishedGoodsCountDraftCreateResult,
  FinishedGoodsCountDraftLine,
  FinishedGoodsCountSheetSummaryRow,
  FinishedGoodsCountingPageData,
  FinishedGoodsCountQualityProposal,
} from '@/lib/finished-goods-counting/types'

type AnySupabase = SupabaseClient

function normalizeText(value: unknown) {
  return String(value || '').trim()
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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round3(value: number) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000
  return Number.isFinite(rounded) ? rounded : 0
}

async function buildCountSheetCode(supabase: AnySupabase) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `KK-TP-${yy}${mm}${dd}-`

  const { data, error } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_code')
    .ilike('count_sheet_code', `${prefix}%`)
    .limit(500)

  if (error) throw error

  let nextSequence = 1
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const code = normalizeText(row.count_sheet_code)
    if (!code.startsWith(prefix)) continue
    const suffix = code.slice(prefix.length)
    const sequence = Math.trunc(toNumber(suffix))
    if (sequence >= nextSequence) nextSequence = sequence + 1
  }

  return `${prefix}${String(nextSequence).padStart(3, '0')}`
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

function buildCountAdjustmentLotCodeBase(input: { countDate: string; tenDoan: string; chieuDaiM: number }) {
  return `KKTP-${formatCompactDate(input.countDate)}-${sanitizeSegment(input.tenDoan || 'DOAN')}-${buildLengthCode(input.chieuDaiM)}`
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

function parseOpeningBalanceLineNo(note: string, countSheetCode: string) {
  const normalizedNote = normalizeText(note)
  const normalizedCode = normalizeText(countSheetCode)
  if (!normalizedNote || !normalizedCode) return 0
  const match = normalizedNote.match(new RegExp(`Mở tồn từ phiếu\\s+${normalizedCode}\\s+-\\s+dòng\\s+(\\d+)`, 'i'))
  return match ? Math.max(Math.trunc(Number(match[1] || 0)), 0) : 0
}

function buildOpeningBalanceSystemNote(countSheetCode: string, lineNo: number, userNote?: string) {
  const marker = `Mở tồn từ phiếu ${normalizeText(countSheetCode)} - dòng ${Math.max(Math.trunc(lineNo), 0)}`
  const normalizedUserNote = normalizeText(userNote)
  if (!normalizedUserNote) return marker
  if (normalizedUserNote.includes(marker)) return normalizedUserNote
  return `${marker} | ${normalizedUserNote}`
}

function isUuidText(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeText(value))
}

function readNonUuidText(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized && !isUuidText(normalized)) return normalized
  }
  return ''
}

function buildFinishedGoodsCountItemLabel(input: {
  itemLabel?: string | null
  maCoc?: string | null
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
}) {
  const maCoc = normalizeText(input.maCoc)
  const loaiCoc = normalizeText(input.loaiCoc)
  const tenDoan = normalizeText(input.tenDoan)
  const chieuDaiM = round3(input.chieuDaiM)
  if (maCoc && !isUuidText(maCoc)) {
    return `${maCoc} | ${tenDoan} | ${chieuDaiM}m`
  }
  return normalizeText(input.itemLabel) || `${loaiCoc} | ${tenDoan} | ${chieuDaiM}m`
}

async function loadOpeningBalancePrintableLotsByLine(input: {
  supabase: AnySupabase
  countSheetCode: string
}) {
  const normalizedCode = normalizeText(input.countSheetCode)
  if (!normalizedCode) return new Map<number, Array<{ lotId: string; lotCode: string; serialCount: number }>>()

  const { data: serialRows, error: serialError } = await input.supabase
    .from('pile_serial')
    .select('notes, lot_id')
    .ilike('notes', `%Mở tồn từ phiếu ${normalizedCode}%`)
    .eq('is_active', true)
    .order('serial_code', { ascending: true })

  if (serialError) {
    const message = String(serialError.message || '')
    if (serialError.code === '42703' || message.includes('schema cache')) {
      return new Map<number, Array<{ lotId: string; lotCode: string; serialCount: number }>>()
    }
    throw serialError
  }

  const lotIds = Array.from(
    new Set(
      ((serialRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => normalizeText(row.lot_id))
        .filter(Boolean)
    )
  )

  const lotCodeById = new Map<string, string>()
  if (lotIds.length) {
    const { data: lotRows, error: lotError } = await input.supabase
      .from('production_lot')
      .select('lot_id, lot_code')
      .in('lot_id', lotIds)

    if (lotError) {
      const message = String(lotError.message || '')
      if (lotError.code === '42703' || message.includes('schema cache')) {
        return new Map<number, Array<{ lotId: string; lotCode: string; serialCount: number }>>()
      }
      throw lotError
    }

    for (const row of (lotRows ?? []) as Array<Record<string, unknown>>) {
      const lotId = normalizeText(row.lot_id)
      const lotCode = normalizeText(row.lot_code)
      if (!lotId || !lotCode) continue
      lotCodeById.set(lotId, lotCode)
    }
  }

  const lotsByLine = new Map<number, Map<string, { lotId: string; lotCode: string; serialCount: number }>>()
  for (const row of (serialRows ?? []) as Array<Record<string, unknown>>) {
    const lineNo = parseOpeningBalanceLineNo(String(row.notes || ''), normalizedCode)
    if (!lineNo) continue
    const lotId = normalizeText(row.lot_id)
    const lotCode = lotCodeById.get(lotId) || ''
    if (!lotId || !lotCode) continue

    const currentLineMap = lotsByLine.get(lineNo) || new Map<string, { lotId: string; lotCode: string; serialCount: number }>()
    const currentLot = currentLineMap.get(lotId)
    if (currentLot) {
      currentLot.serialCount += 1
    } else {
      currentLineMap.set(lotId, {
        lotId,
        lotCode,
        serialCount: 1,
      })
    }
    lotsByLine.set(lineNo, currentLineMap)
  }

  return new Map(
    Array.from(lotsByLine.entries()).map(([lineNo, lots]) => [
      lineNo,
      Array.from(lots.values()).sort((a, b) => a.lotCode.localeCompare(b.lotCode, 'vi')),
    ])
  )
}

function deriveGeneratedLotMeta(input: {
  serialCode: string
  generatedFromCount: boolean
  generatedLotId: string
  generatedLotCode: string
}) {
  const serialCode = normalizeText(input.serialCode)
  const explicitLotCode = normalizeText(input.generatedLotCode)
  const explicitLotId = normalizeText(input.generatedLotId)
  const explicitGenerated = input.generatedFromCount || Boolean(explicitLotCode || explicitLotId)

  if (explicitGenerated) {
    return {
      generatedFromCount: true,
      generatedLotId: explicitLotId,
      generatedLotCode: explicitLotCode || serialCode.replace(/-\d{3}$/u, ''),
    }
  }

  return {
    generatedFromCount: false,
    generatedLotId: '',
    generatedLotCode: '',
  }
}

function mapVisibilityLabel(input: { visibleInProject: boolean; visibleInRetail: boolean }) {
  if (input.visibleInProject && input.visibleInRetail) return 'Dự án + Khách lẻ'
  if (input.visibleInProject) return 'Dự án'
  if (input.visibleInRetail) return 'Khách lẻ'
  return 'Ẩn / chờ xử lý'
}

function deriveQualityProposal(input: { qcStatus: string; visibleInRetail: boolean }): FinishedGoodsCountQualityProposal {
  if (input.qcStatus === 'LOI' || !input.visibleInRetail) return 'LOI'
  return 'DAT'
}

function resolveSerialStateFromProposal(input: {
  qualityProposal: FinishedGoodsCountQualityProposal
  countStatus: FinishedGoodsCountDetailSerialRow['countStatus']
}) {
  if (input.countStatus === 'MISSING_IN_COUNT' || input.qualityProposal === 'HUY') {
    return {
      lifecycleStatus: 'HUY_BO',
      qcStatus: 'LOI',
      dispositionStatus: 'HUY_BO',
      visibleInProject: false,
      visibleInRetail: false,
      defaultLocationCode: '',
    }
  }

  if (input.qualityProposal === 'LOI') {
    return {
      lifecycleStatus: 'TRONG_KHO',
      qcStatus: 'LOI',
      dispositionStatus: 'THANH_LY',
      visibleInProject: false,
      visibleInRetail: true,
      defaultLocationCode: 'KHU_LOI',
    }
  }

  return {
    lifecycleStatus: 'TRONG_KHO',
    qcStatus: 'DAT',
    dispositionStatus: 'BINH_THUONG',
    visibleInProject: true,
    visibleInRetail: true,
    defaultLocationCode: 'KHO_THANH_PHAM',
  }
}

function resolvePendingUnexpectedFoundState(input: {
  qualityProposal: Exclude<FinishedGoodsCountQualityProposal, 'HUY'>
}) {
  if (input.qualityProposal === 'LOI') {
    return {
      lifecycleStatus: 'CHO_DUYET_KIEM_KE',
      qcStatus: 'LOI',
      dispositionStatus: 'THANH_LY',
      visibleInProject: false,
      visibleInRetail: false,
      defaultLocationCode: 'KHU_LOI',
    }
  }

  return {
    lifecycleStatus: 'CHO_DUYET_KIEM_KE',
    qcStatus: 'DAT',
    dispositionStatus: 'BINH_THUONG',
    visibleInProject: false,
    visibleInRetail: false,
    defaultLocationCode: 'KHO_THANH_PHAM',
  }
}

function isFinishedGoodsDomain(payload: unknown) {
  return (
    payload &&
    typeof payload === 'object' &&
    String((payload as Record<string, unknown>).inventoryDomain || '').trim().toUpperCase() === 'FINISHED_GOODS'
  )
}

async function updatePileSerialWithFallback(input: {
  supabase: AnySupabase
  serialId: string
  payload: Record<string, unknown>
}) {
  const working = { ...input.payload }
  const attempt = async () =>
    input.supabase
      .from('pile_serial')
      .update(working)
      .eq('serial_id', input.serialId)

  let result = await attempt()
  if (result.error && String(result.error.message || '').includes(`'updated_by'`)) {
    delete working.updated_by
    result = await attempt()
  }
  if (result.error) throw result.error
}

export async function isFinishedGoodsCountingReady(supabase: AnySupabase) {
  const [countSchemaReady, currentRows] = await Promise.all([
    isInventoryCountingSchemaReady(supabase),
    loadFinishedGoodsCurrentInventoryRows(supabase).catch(() => null),
  ])
  return countSchemaReady && Array.isArray(currentRows)
}

export async function loadFinishedGoodsCountCatalogOptions(
  supabase: AnySupabase
): Promise<FinishedGoodsCountCatalogOption[]> {
  const pageData = await loadFinishedGoodsInventoryPageData(supabase, { scope: 'ALL' })
  if (!pageData.schemaReady) return []

  return pageData.summaryRows.map((row) => ({
    itemKey: row.itemKey,
    itemLabel: row.itemLabel,
    templateId: row.templateId,
    maCoc: row.maCoc,
    loaiCoc: row.loaiCoc,
    tenDoan: row.tenDoan,
    chieuDaiM: row.chieuDaiM,
    systemQty: row.physicalQty,
    projectQty: row.projectQty,
    retailQty: row.retailQty,
    holdQty: row.holdQty,
  }))
}

export async function loadFinishedGoodsCountSheetSummaries(
  supabase: AnySupabase
): Promise<{ schemaReady: boolean; rows: FinishedGoodsCountSheetSummaryRow[] }> {
  const schemaReady = await isInventoryCountingSchemaReady(supabase)
  if (!schemaReady) return { schemaReady: false, rows: [] }

  const { data: headerRows, error: headerError } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, count_date, status, note, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(50)

  if (headerError) throw headerError

  const sheetRows = (headerRows ?? []).filter((row) => isFinishedGoodsDomain((row as Record<string, unknown>).payload_json))
  const sheetIds = sheetRows.map((row) => String((row as Record<string, unknown>).count_sheet_id || '')).filter(Boolean)
  if (!sheetIds.length) return { schemaReady: true, rows: [] }

  const { data: lineRows, error: lineError } = await supabase
    .from('inventory_count_line')
    .select('count_sheet_id, count_line_id, system_qty, counted_qty, variance_qty')
    .in('count_sheet_id', sheetIds)

  if (lineError) throw lineError

  const lineMeta = new Map<string, { lineCount: number; systemQtyTotal: number; countedQtyTotal: number; varianceQtyTotal: number }>()
  for (const row of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const countSheetId = String(row.count_sheet_id || '')
    const current = lineMeta.get(countSheetId) || { lineCount: 0, systemQtyTotal: 0, countedQtyTotal: 0, varianceQtyTotal: 0 }
    current.lineCount += 1
    current.systemQtyTotal += toNumber(row.system_qty)
    current.countedQtyTotal += toNumber(row.counted_qty)
    current.varianceQtyTotal += toNumber(row.variance_qty)
    lineMeta.set(countSheetId, current)
  }

  return {
    schemaReady: true,
    rows: sheetRows.map((row) => {
      const record = row as Record<string, unknown>
      const countSheetId = String(record.count_sheet_id || '')
      const meta = lineMeta.get(countSheetId) || { lineCount: 0, systemQtyTotal: 0, countedQtyTotal: 0, varianceQtyTotal: 0 }
      return {
        countSheetId,
        countSheetCode: String(record.count_sheet_code || countSheetId || '-'),
        countMode:
          String(record.count_type || '').toUpperCase() === 'OPENING_BALANCE' ||
          String(((record.payload_json as Record<string, unknown> | null) || {}).countMode || '').toUpperCase() === 'TON_DAU_KY'
            ? 'TON_DAU_KY'
            : 'VAN_HANH',
        countDate: String(record.count_date || ''),
        status: String(record.status || 'NHAP') as FinishedGoodsCountSheetSummaryRow['status'],
        note: String(record.note || ''),
        lineCount: meta.lineCount,
        systemQtyTotal: round3(meta.systemQtyTotal),
        countedQtyTotal: round3(meta.countedQtyTotal),
        varianceQtyTotal: round3(meta.varianceQtyTotal),
        createdAt: String(record.created_at || ''),
      }
    }),
  }
}

export async function loadFinishedGoodsCountingPageData(
  supabase: AnySupabase
): Promise<FinishedGoodsCountingPageData> {
  const [summaryData, catalogOptions] = await Promise.all([
    loadFinishedGoodsCountSheetSummaries(supabase),
    loadFinishedGoodsCountCatalogOptions(supabase),
  ])

  const varianceAbs = summaryData.rows.reduce((sum, row) => sum + Math.abs(Number(row.varianceQtyTotal || 0)), 0)

  return {
    schemaReady: summaryData.schemaReady,
    summaryCards: [
      {
        label: 'Phiếu gần đây',
        value: String(summaryData.rows.length),
        helpText: 'Các phiếu kiểm kê cọc thành phẩm gần nhất đọc được từ DB.',
      },
      {
        label: 'Pool có thể kiểm',
        value: String(catalogOptions.length),
        helpText: 'Số pool Mũi/Thân + chiều dài hiện có để lập phiếu kiểm kê.',
      },
      {
        label: 'Tổng chênh lệch',
        value: new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(varianceAbs),
        helpText: 'Tổng trị tuyệt đối chênh lệch trên các phiếu kiểm kê cọc gần đây.',
      },
      {
        label: 'Schema kiểm kê',
        value: summaryData.schemaReady ? 'Sẵn sàng' : 'Chưa sẵn sàng',
        helpText: summaryData.schemaReady
          ? 'Có thể tạo phiếu kiểm kê cọc và lưu DB thật.'
          : 'Cần chạy inventory_counting_setup.sql trước khi lưu phiếu.',
      },
    ],
    catalogOptions,
    savedSheets: summaryData.rows,
  }
}

export async function createFinishedGoodsCountSheetDraft(input: {
  supabase: AnySupabase
  userId: string
  countType: 'VAN_HANH' | 'TON_DAU_KY'
  countDate: string
  note?: string
  rows: FinishedGoodsCountDraftLine[]
}): Promise<FinishedGoodsCountDraftCreateResult> {
  const schemaReady = await isInventoryCountingSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng kiểm kê chưa sẵn sàng trên DB. Cần chạy schema inventory_counting trước.')
  }

  const lines = input.rows.filter((row) => normalizeText(row.itemKey) && row.systemQty >= 0)
  if (!lines.length) {
    throw new Error('Phiếu kiểm kê cọc cần ít nhất một dòng hợp lệ.')
  }

  const currentRows = await loadFinishedGoodsCurrentInventoryRows(input.supabase)
  const countSheetCode = await buildCountSheetCode(input.supabase)
  const note = normalizeText(input.note)
  const countDate = normalizeText(input.countDate)
  if (!countDate) throw new Error('Phiếu kiểm kê cọc cần có ngày kiểm kê.')

  const { data: headerRow, error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .insert({
      count_sheet_code: countSheetCode,
      count_type: input.countType === 'TON_DAU_KY' ? 'OPENING_BALANCE' : 'OPERATIONAL',
      scope_type: 'SELECTED_ITEMS',
      count_date: countDate,
      status: input.countType === 'TON_DAU_KY' ? 'CHO_XAC_NHAN_KHO' : 'NHAP',
      note,
      payload_json: {
        inventoryDomain: 'FINISHED_GOODS',
        lineCount: lines.length,
        countMode: input.countType,
      },
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('count_sheet_id, count_sheet_code')
    .single()

  if (headerError || !headerRow) throw headerError || new Error('Không tạo được phiếu kiểm kê cọc.')

  const countSheetId = String((headerRow as Record<string, unknown>).count_sheet_id || '')
  const linePayload = lines.map((row, index) => ({
    count_sheet_id: countSheetId,
    line_no: index + 1,
    item_type: 'FINISHED_GOOD',
    item_id: row.itemKey,
    item_code: row.itemKey,
    item_name: buildFinishedGoodsCountItemLabel(row),
    item_group: 'CỌC THÀNH PHẨM',
    unit: 'cây',
    system_qty: round3(input.countType === 'TON_DAU_KY' ? 0 : row.systemQty),
    counted_qty: round3(input.countType === 'TON_DAU_KY' ? Number(row.openingQty || 0) : row.systemQty),
    variance_qty: round3(input.countType === 'TON_DAU_KY' ? Number(row.openingQty || 0) : 0),
    variance_pct: 0,
    allowed_loss_pct: 0,
    note: normalizeText(row.note) || null,
      payload_json: {
        inventoryDomain: 'FINISHED_GOODS',
        itemKey: row.itemKey,
        templateId: row.templateId || '',
        maCoc: row.maCoc || '',
        loaiCoc: row.loaiCoc,
      tenDoan: row.tenDoan,
      chieuDaiM: row.chieuDaiM,
      countMode: input.countType,
      unexpectedFoundDatQty: input.countType === 'TON_DAU_KY' && row.qualityStatus !== 'LOI' ? Number(row.openingQty || 0) : 0,
      unexpectedFoundLoiQty: input.countType === 'TON_DAU_KY' && row.qualityStatus === 'LOI' ? Number(row.openingQty || 0) : 0,
      qualityStatus: input.countType === 'TON_DAU_KY' ? row.qualityStatus === 'LOI' ? 'LOI' : 'DAT' : '',
      locationId: input.countType === 'TON_DAU_KY' ? String(row.locationId || '') : '',
    },
    created_by: input.userId,
    updated_by: input.userId,
  }))

  const { data: insertedLines, error: lineError } = await input.supabase
    .from('inventory_count_line')
    .insert(linePayload)
    .select('count_line_id, item_id, line_no')

  if (lineError) throw lineError

  const countLineIdByItemKey = new Map(
    (insertedLines ?? []).map((row) => [String((row as Record<string, unknown>).item_id || ''), String((row as Record<string, unknown>).count_line_id || '')])
  )

  if (input.countType === 'TON_DAU_KY') {
    for (const row of insertedLines ?? []) {
      const record = row as Record<string, unknown>
      const itemKey = String(record.item_id || '')
      const sourceLine = lines.find((line) => line.itemKey === itemKey)
      if (!sourceLine) continue

      const quantity = Math.max(Math.trunc(toNumber(sourceLine.openingQty)), 0)
      if (!quantity) continue

      const systemNote = buildOpeningBalanceSystemNote(countSheetCode, toNumber(record.line_no), sourceLine.note)
      const createdLot = await createDraftOpeningBalanceLotAndSerials(input.supabase, {
        loaiCoc: sourceLine.loaiCoc,
        templateId: sourceLine.templateId || '',
        maCoc: sourceLine.maCoc || '',
        tenDoan: sourceLine.tenDoan,
        chieuDaiM: sourceLine.chieuDaiM,
        openingDate: countDate,
        quantity,
        qualityStatus: sourceLine.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
        locationId: sourceLine.locationId || null,
        note: systemNote,
        createdBy: input.userId,
      })

      const { error: updateLinePayloadError } = await input.supabase
        .from('inventory_count_line')
        .update({
          payload_json: {
            inventoryDomain: 'FINISHED_GOODS',
            itemKey: sourceLine.itemKey,
            templateId: sourceLine.templateId || '',
            maCoc: sourceLine.maCoc || '',
            loaiCoc: sourceLine.loaiCoc,
            tenDoan: sourceLine.tenDoan,
            chieuDaiM: sourceLine.chieuDaiM,
            countMode: input.countType,
            unexpectedFoundDatQty: sourceLine.qualityStatus === 'LOI' ? 0 : quantity,
            unexpectedFoundLoiQty: sourceLine.qualityStatus === 'LOI' ? quantity : 0,
            qualityStatus: sourceLine.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
            locationId: sourceLine.locationId || '',
            draftPrintableLots: [
              {
                lotId: createdLot.lotId,
                lotCode: createdLot.lotCode,
                serialCount: createdLot.generatedSerialCount,
              },
            ],
          },
          updated_by: input.userId,
        })
        .eq('count_line_id', String(record.count_line_id || ''))

      if (updateLinePayloadError) throw updateLinePayloadError
    }
  }

  const serialPayload =
    input.countType === 'TON_DAU_KY'
      ? []
      : currentRows
          .filter((row) => countLineIdByItemKey.has(row.itemKey))
          .map((row) => ({
            count_sheet_id: countSheetId,
            count_line_id: countLineIdByItemKey.get(row.itemKey),
            serial_id: row.serialId,
            serial_code: row.serialCode,
            count_status: 'COUNTED',
            system_location_id: row.currentLocationId || null,
            counted_location_id: row.currentLocationId || null,
            note: null,
            payload_json: {
              inventoryDomain: 'FINISHED_GOODS',
              itemKey: row.itemKey,
              templateId: row.templateId,
              maCoc: row.maCoc,
              loaiCoc: row.loaiCoc,
              tenDoan: row.tenDoan,
              chieuDaiM: row.chieuDaiM,
              visibleInProject: row.visibleInProject,
              visibleInRetail: row.visibleInRetail,
              systemVisibilityLabel: mapVisibilityLabel(row),
              qcStatus: row.qcStatus,
              lifecycleStatus: row.lifecycleStatus,
              dispositionStatus: row.dispositionStatus,
              qualityProposal: deriveQualityProposal(row),
            },
            created_by: input.userId,
            updated_by: input.userId,
          }))

  if (serialPayload.length) {
    const { error: serialError } = await input.supabase.from('inventory_count_serial').insert(serialPayload)
    if (serialError) throw serialError
  }

  return {
    countSheetId,
    countSheetCode: String((headerRow as Record<string, unknown>).count_sheet_code || countSheetCode),
    lineCount: linePayload.length,
    serialCount: serialPayload.length,
  }
}

export async function loadFinishedGoodsCountDetail(input: {
  supabase: AnySupabase
  countSheetId: string
}): Promise<FinishedGoodsCountDetail | null> {
  const { data: headerRow, error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, count_date, status, note, created_at, payload_json')
    .eq('count_sheet_id', input.countSheetId)
    .single()

  if (headerError) throw headerError
  if (!headerRow || !isFinishedGoodsDomain((headerRow as Record<string, unknown>).payload_json)) return null

  const countSheetCode = String((headerRow as Record<string, unknown>).count_sheet_code || '')
  const countMode =
    String((headerRow as Record<string, unknown>).count_type || '').toUpperCase() === 'OPENING_BALANCE' ||
    String((((headerRow as Record<string, unknown>).payload_json as Record<string, unknown> | null) || {}).countMode || '')
      .toUpperCase() === 'TON_DAU_KY'
      ? 'TON_DAU_KY'
      : 'VAN_HANH'

  const { data: lineRows, error: lineError } = await input.supabase
    .from('inventory_count_line')
    .select('count_line_id, line_no, item_id, item_name, system_qty, counted_qty, variance_qty, note, payload_json')
    .eq('count_sheet_id', input.countSheetId)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const { data: serialRows, error: serialError } = await input.supabase
    .from('inventory_count_serial')
    .select('count_serial_id, count_line_id, serial_id, serial_code, count_status, system_location_id, counted_location_id, note, payload_json')
    .eq('count_sheet_id', input.countSheetId)
    .order('serial_code', { ascending: true })

  if (serialError) throw serialError

  const serialsByLine = new Map<string, FinishedGoodsCountDetailSerialRow[]>()
  for (const row of (serialRows ?? []) as Array<Record<string, unknown>>) {
    const payload = ((row.payload_json as Record<string, unknown> | null) || {}) as Record<string, unknown>
    const lineId = String(row.count_line_id || '')
    const current = serialsByLine.get(lineId) || []
    const generatedMeta = deriveGeneratedLotMeta({
      serialCode: normalizeText(row.serial_code),
      generatedFromCount: Boolean(payload.generatedFromCount),
      generatedLotId: normalizeText(payload.generatedLotId),
      generatedLotCode: normalizeText(payload.generatedLotCode),
    })
    current.push({
      countSerialId: String(row.count_serial_id || ''),
      serialId: normalizeText(row.serial_id) || null,
      serialCode: normalizeText(row.serial_code),
      countStatus: (String(row.count_status || 'COUNTED') as FinishedGoodsCountDetailSerialRow['countStatus']),
      qualityProposal: (String(payload.qualityProposal || 'DAT') as FinishedGoodsCountQualityProposal),
      systemLocationId: normalizeText(row.system_location_id),
      countedLocationId: normalizeText(row.counted_location_id),
      note: normalizeText(row.note),
      systemVisibilityLabel: normalizeText(payload.systemVisibilityLabel),
      generatedFromCount: generatedMeta.generatedFromCount,
      generatedLotId: generatedMeta.generatedLotId,
      generatedLotCode: generatedMeta.generatedLotCode,
    })
    serialsByLine.set(lineId, current)
  }

  const missingGeneratedLotIds = Array.from(serialsByLine.values())
    .flat()
    .filter((row) => row.generatedFromCount && row.generatedLotCode && !row.generatedLotId)
    .map((row) => row.generatedLotCode)

  if (missingGeneratedLotIds.length) {
    const uniqueLotCodes = Array.from(new Set(missingGeneratedLotIds))
    const { data: generatedLotRows, error: generatedLotError } = await input.supabase
      .from('production_lot')
      .select('lot_id, lot_code')
      .in('lot_code', uniqueLotCodes)

    if (generatedLotError) throw generatedLotError

    const lotIdByCode = new Map<string, string>()
    for (const row of (generatedLotRows ?? []) as Array<Record<string, unknown>>) {
      const lotCode = normalizeText(row.lot_code)
      const lotId = normalizeText(row.lot_id)
      if (lotCode && lotId) lotIdByCode.set(lotCode, lotId)
    }

    for (const rows of serialsByLine.values()) {
      for (const row of rows) {
        if (!row.generatedFromCount || row.generatedLotId || !row.generatedLotCode) continue
        row.generatedLotId = lotIdByCode.get(row.generatedLotCode) || ''
      }
    }
  }

  let printableLotsByLine = new Map<number, Array<{ lotId: string; lotCode: string; serialCount: number }>>()
  if (countMode === 'TON_DAU_KY') {
    try {
      printableLotsByLine = await loadOpeningBalancePrintableLotsByLine({ supabase: input.supabase, countSheetCode })
    } catch (printableLotsError) {
      console.error('loadOpeningBalancePrintableLotsByLine failed', printableLotsError)
      printableLotsByLine = new Map<number, Array<{ lotId: string; lotCode: string; serialCount: number }>>()
    }
  }

  const templateIdsInLines = Array.from(
    new Set(
      ((lineRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => normalizeText(((row.payload_json as Record<string, unknown> | null) || {}).templateId))
        .filter(Boolean)
    )
  )
  const maCocByTemplateId = new Map<string, string>()
  if (templateIdsInLines.length) {
    const { data: templateRows, error: templateError } = await input.supabase
      .from('dm_coc_template')
      .select('*')
      .in('template_id', templateIdsInLines)

    if (templateError) {
      if (!isMissingRelationError(templateError, 'dm_coc_template')) throw templateError
    } else {
      for (const row of (templateRows ?? []) as Array<Record<string, unknown>>) {
        const templateId = normalizeText(row.template_id)
        const maCoc = readNonUuidText(row.ma_coc, row.ma_coc_template)
        if (templateId && maCoc) maCocByTemplateId.set(templateId, maCoc)
      }
    }
  }

  const lines: FinishedGoodsCountDetailLine[] = ((lineRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const payload = ((row.payload_json as Record<string, unknown> | null) || {}) as Record<string, unknown>
    const templateId = normalizeText(payload.templateId)
    const maCoc = readNonUuidText(payload.maCoc, maCocByTemplateId.get(templateId))
    const currentSerialRows = serialsByLine.get(String(row.count_line_id || '')) || []
    const generatedLotsMap = new Map<
      string,
      { lotId: string; lotCode: string; qualityProposal: Exclude<FinishedGoodsCountQualityProposal, 'HUY'>; serialCount: number }
    >()

    for (const serialRow of currentSerialRows) {
      if (serialRow.countStatus !== 'UNEXPECTED_FOUND') continue
      if (!serialRow.generatedFromCount || !serialRow.generatedLotCode) continue
      if (serialRow.qualityProposal === 'HUY') continue
      const lotKey = serialRow.generatedLotId || serialRow.generatedLotCode
      const key = `${lotKey}::${serialRow.qualityProposal}`
      const currentMeta = generatedLotsMap.get(key)
      if (currentMeta) {
        currentMeta.serialCount += 1
      } else {
        generatedLotsMap.set(key, {
          lotId: serialRow.generatedLotId,
          lotCode: serialRow.generatedLotCode,
          qualityProposal: serialRow.qualityProposal === 'LOI' ? 'LOI' : 'DAT',
          serialCount: 1,
        })
      }
    }

    const lineNo = toNumber(row.line_no)
    const payloadPrintableLots = Array.isArray(payload.draftPrintableLots)
      ? (payload.draftPrintableLots as Array<Record<string, unknown>>)
          .map((lot) => ({
            lotId: normalizeText(lot.lotId),
            lotCode: normalizeText(lot.lotCode),
            serialCount: Math.max(Math.trunc(toNumber(lot.serialCount)), 0),
          }))
          .filter((lot) => lot.lotId && lot.lotCode && lot.serialCount > 0)
      : []
    const fallbackPrintableLots = printableLotsByLine.get(lineNo) || []
    const printableLots = Array.from(
      new Map(
        [...payloadPrintableLots, ...fallbackPrintableLots].map((lot) => [
          `${lot.lotId}::${lot.lotCode}`,
          lot,
        ])
      ).values()
    ).sort((a, b) => a.lotCode.localeCompare(b.lotCode, 'vi'))

    return {
      countLineId: String(row.count_line_id || ''),
      lineNo,
      itemKey: normalizeText(row.item_id),
      itemLabel: buildFinishedGoodsCountItemLabel({
        itemLabel: normalizeText(row.item_name),
        maCoc,
        loaiCoc: normalizeText(payload.loaiCoc),
        tenDoan: normalizeText(payload.tenDoan),
        chieuDaiM: round3(toNumber(payload.chieuDaiM)),
      }),
      templateId,
      maCoc,
      loaiCoc: normalizeText(payload.loaiCoc),
      tenDoan: normalizeText(payload.tenDoan),
      chieuDaiM: round3(toNumber(payload.chieuDaiM)),
      systemQty: round3(toNumber(row.system_qty)),
      countedQty: round3(toNumber(row.counted_qty)),
      varianceQty: round3(toNumber(row.variance_qty)),
      note: normalizeText(row.note),
      unexpectedFoundDatQty: round3(toNumber(payload.unexpectedFoundDatQty)),
      unexpectedFoundLoiQty: round3(toNumber(payload.unexpectedFoundLoiQty)),
      qualityStatus:
        String(payload.qualityStatus || '').toUpperCase() === 'LOI'
          ? 'LOI'
          : String(payload.qualityStatus || '').toUpperCase() === 'DAT'
            ? 'DAT'
            : '',
      locationId: normalizeText(payload.locationId),
      serialRows: currentSerialRows,
      generatedLots: Array.from(generatedLotsMap.values()),
      printableLots,
    }
  })

  return {
    countSheetId: String((headerRow as Record<string, unknown>).count_sheet_id || ''),
    countSheetCode,
    countMode,
    countDate: String((headerRow as Record<string, unknown>).count_date || ''),
    status: String((headerRow as Record<string, unknown>).status || 'NHAP') as FinishedGoodsCountDetail['status'],
    note: String((headerRow as Record<string, unknown>).note || ''),
    createdAt: String((headerRow as Record<string, unknown>).created_at || ''),
    lines,
  }
}

export async function saveFinishedGoodsCountDraft(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  note: string
  lines: Array<{
    countLineId: string
    note: string
    unexpectedFoundDatQty: number
    unexpectedFoundLoiQty: number
    serialRows: Array<{
      countSerialId: string
      countStatus: FinishedGoodsCountDetailSerialRow['countStatus']
      qualityProposal: FinishedGoodsCountQualityProposal
      note: string
    }>
  }>
}) {
  const detail = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê cọc để lưu.')
  }
  if (detail.countMode === 'TON_DAU_KY') {
    throw new Error('Phiếu nhập tồn đầu kỳ không đi qua bước lưu nháp kiểm kê vận hành.')
  }
  if (detail.status !== 'NHAP' && detail.status !== 'CHO_XAC_NHAN_KHO') {
    throw new Error('Phiếu kiểm kê cọc này đã qua bước nhập, không thể sửa tiếp.')
  }

  const lineMap = new Map(detail.lines.map((line) => [line.countLineId, line]))

  for (const lineInput of input.lines) {
    const baseLine = lineMap.get(lineInput.countLineId)
    if (!baseLine) throw new Error('Có dòng kiểm kê cọc không còn tồn tại trên phiếu.')

    const serialMap = new Map(baseLine.serialRows.map((row) => [row.countSerialId, row]))
    for (const serialInput of lineInput.serialRows) {
      const baseSerial = serialMap.get(serialInput.countSerialId)
      if (!baseSerial) throw new Error('Có serial kiểm kê cọc không còn tồn tại trên phiếu.')

      const payload = {
        inventoryDomain: 'FINISHED_GOODS',
        itemKey: baseLine.itemKey,
        loaiCoc: baseLine.loaiCoc,
        tenDoan: baseLine.tenDoan,
        chieuDaiM: baseLine.chieuDaiM,
        systemVisibilityLabel: baseSerial.systemVisibilityLabel,
        qualityProposal: serialInput.qualityProposal,
        generatedFromCount: baseSerial.generatedFromCount,
        generatedLotId: baseSerial.generatedLotId,
        generatedLotCode: baseSerial.generatedLotCode,
      }

      const { error: serialError } = await input.supabase
        .from('inventory_count_serial')
        .update({
          count_status: serialInput.countStatus,
          note: normalizeText(serialInput.note) || null,
          payload_json: payload,
          updated_by: input.userId,
        })
        .eq('count_serial_id', serialInput.countSerialId)

      if (serialError) throw serialError
    }

    const unexpectedDatQty = Math.max(Math.trunc(toNumber(lineInput.unexpectedFoundDatQty)), 0)
    const unexpectedLoiQty = Math.max(Math.trunc(toNumber(lineInput.unexpectedFoundLoiQty)), 0)

    await clearDraftUnexpectedFoundForLine({
      supabase: input.supabase,
      userId: input.userId,
      countSheetId: input.countSheetId,
      countLineId: lineInput.countLineId,
    })

    if (unexpectedDatQty > 0) {
      await createUnexpectedFoundLot({
        supabase: input.supabase,
        userId: input.userId,
        countSheetId: input.countSheetId,
        countSheetCode: detail.countSheetCode,
        countLineId: lineInput.countLineId,
        countDate: detail.countDate,
        templateId: baseLine.templateId,
        maCoc: baseLine.maCoc,
        loaiCoc: baseLine.loaiCoc,
        tenDoan: baseLine.tenDoan,
        chieuDaiM: baseLine.chieuDaiM,
        quantity: unexpectedDatQty,
        qualityProposal: 'DAT',
        lineNo: baseLine.lineNo,
      })
    }

    if (unexpectedLoiQty > 0) {
      await createUnexpectedFoundLot({
        supabase: input.supabase,
        userId: input.userId,
        countSheetId: input.countSheetId,
        countSheetCode: detail.countSheetCode,
        countLineId: lineInput.countLineId,
        countDate: detail.countDate,
        templateId: baseLine.templateId,
        maCoc: baseLine.maCoc,
        loaiCoc: baseLine.loaiCoc,
        tenDoan: baseLine.tenDoan,
        chieuDaiM: baseLine.chieuDaiM,
        quantity: unexpectedLoiQty,
        qualityProposal: 'LOI',
        lineNo: baseLine.lineNo,
      })
    }

    const { error: lineNoteError } = await input.supabase
      .from('inventory_count_line')
      .update({
        note: normalizeText(lineInput.note) || null,
        updated_by: input.userId,
      })
      .eq('count_line_id', lineInput.countLineId)

    if (lineNoteError) throw lineNoteError
  }

  const refreshedForTotals = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshedForTotals) throw new Error('Không tải lại được phiếu kiểm kê cọc sau khi đồng bộ serial.')

  for (const line of refreshedForTotals.lines) {
    const countedQty = line.serialRows.reduce((sum, serialRow) => {
      if (serialRow.countStatus === 'MISSING_IN_COUNT') return sum
      if (serialRow.qualityProposal === 'HUY') return sum
      return sum + 1
    }, 0)
    const varianceQty = round3(countedQty - line.systemQty)

    const { error: lineError } = await input.supabase
      .from('inventory_count_line')
      .update({
        counted_qty: countedQty,
        variance_qty: varianceQty,
        payload_json: {
          inventoryDomain: 'FINISHED_GOODS',
          itemKey: line.itemKey,
          templateId: line.templateId || '',
          maCoc: line.maCoc || '',
          loaiCoc: line.loaiCoc,
          tenDoan: line.tenDoan,
          chieuDaiM: line.chieuDaiM,
          unexpectedFoundDatQty: 0,
          unexpectedFoundLoiQty: 0,
        },
        updated_by: input.userId,
      })
      .eq('count_line_id', line.countLineId)

    if (lineError) throw lineError
  }

  const { error: headerError } = await input.supabase
    .from('inventory_count_sheet')
    .update({
      note: normalizeText(input.note),
      status: 'CHO_XAC_NHAN_KHO',
      updated_by: input.userId,
    })
    .eq('count_sheet_id', input.countSheetId)

  if (headerError) throw headerError

  const refreshed = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê cọc sau khi lưu.')
  return refreshed
}

export async function confirmFinishedGoodsCountByWarehouse(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  const detail = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê cọc để xác nhận kho.')
  }
  if (detail.status !== 'CHO_XAC_NHAN_KHO' && detail.status !== 'NHAP') {
    throw new Error('Phiếu kiểm kê cọc này không còn ở bước xác nhận kho.')
  }

  const hasVarianceOrAction = detail.lines.some((line) => {
    if (line.varianceQty !== 0) return true
    if (line.unexpectedFoundDatQty > 0 || line.unexpectedFoundLoiQty > 0) return true
    return line.serialRows.some((serialRow) => serialRow.countStatus !== 'COUNTED' || serialRow.qualityProposal !== 'DAT')
  })

  const nextStatus = hasVarianceOrAction ? 'CHO_DUYET_CHENH_LECH' : 'DA_DUYET'
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    warehouse_confirmed_by: input.userId,
    warehouse_confirmed_at: new Date().toISOString(),
    updated_by: input.userId,
  }
  if (nextStatus === 'DA_DUYET') {
    updatePayload.approved_by = input.userId
    updatePayload.approved_at = new Date().toISOString()
  }

  const { error } = await input.supabase.from('inventory_count_sheet').update(updatePayload).eq('count_sheet_id', input.countSheetId)
  if (error) throw error

  const refreshed = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê cọc sau khi xác nhận kho.')
  return refreshed
}

async function resolveWarehouseLocationMaps(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code')
    .eq('is_active', true)

  if (error) throw error

  const byCode = new Map<string, string>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const code = normalizeText(row.location_code)
    const id = normalizeText(row.location_id)
    if (code && id) byCode.set(code, id)
  }
  return byCode
}

async function createUnexpectedFoundLot(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  countSheetCode: string
  countLineId: string
  countDate: string
  templateId?: string | null
  maCoc?: string | null
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  quantity: number
  qualityProposal: Exclude<FinishedGoodsCountQualityProposal, 'HUY'>
  lineNo: number
}) {
  const quantity = Math.max(Math.trunc(toNumber(input.quantity)), 0)
  if (!quantity) return { lotId: '', lotCode: '', serialCount: 0 }

  const locationByCode = await resolveWarehouseLocationMaps(input.supabase)
  const state = resolvePendingUnexpectedFoundState({ qualityProposal: input.qualityProposal })
  const baseCode = buildCountAdjustmentLotCodeBase({
    countDate: input.countDate,
    tenDoan: input.tenDoan,
    chieuDaiM: input.chieuDaiM,
  })

  const { data: siblingLots, error: siblingLotsError } = await input.supabase
    .from('production_lot')
    .select('lot_code')
    .ilike('lot_code', `${baseCode}-L%`)
    .eq('is_active', true)

  if (siblingLotsError) throw siblingLotsError

  const nextSeq =
    ((siblingLots ?? []) as Array<Record<string, unknown>>).reduce((maxSeq, row) => {
      return Math.max(maxSeq, extractLotSequence(String(row.lot_code || ''), baseCode))
    }, 0) + 1

  const lotCode = buildLotCode(baseCode, nextSeq)
  const { data: lotRow, error: lotError } = await input.supabase
    .from('production_lot')
    .insert({
      lot_code: lotCode,
      template_id: normalizeText(input.templateId) || null,
      ma_coc: normalizeText(input.maCoc) || null,
      loai_coc: normalizeText(input.loaiCoc),
      ten_doan: normalizeText(input.tenDoan),
      chieu_dai_m: round3(input.chieuDaiM),
      production_date: normalizeText(input.countDate),
      actual_qty: quantity,
      created_by: input.userId,
      updated_by: input.userId,
      is_active: true,
    })
    .select('lot_id')
    .single()

  if (lotError) throw lotError

  const lotId = normalizeText(lotRow.lot_id)
  const locationId = locationByCode.get(state.defaultLocationCode) || null
  const serialRows = Array.from({ length: quantity }, (_, index) => ({
    serial_code: buildSerialCode(lotCode, index + 1),
    lot_id: lotId,
    template_id: normalizeText(input.templateId) || null,
    ma_coc: normalizeText(input.maCoc) || null,
    loai_coc: normalizeText(input.loaiCoc),
    ten_doan: normalizeText(input.tenDoan),
    chieu_dai_m: round3(input.chieuDaiM),
    lifecycle_status: state.lifecycleStatus,
    qc_status: state.qcStatus,
    disposition_status: state.dispositionStatus,
    visible_in_project: state.visibleInProject,
    visible_in_retail: state.visibleInRetail,
    current_location_id: locationId,
    notes: `Sinh từ kiểm kê cọc ${input.countSheetCode || input.countSheetId} - dòng ${input.lineNo}`,
    is_active: true,
  }))

  const { error: serialError } = await input.supabase.from('pile_serial').insert(serialRows)
  if (serialError) throw serialError

  const { data: insertedSerials, error: insertedError } = await input.supabase
    .from('pile_serial')
    .select('serial_id')
    .eq('lot_id', lotId)
    .eq('is_active', true)

  if (insertedError) throw insertedError

  if ((insertedSerials ?? []).length) {
    const historyRows = (insertedSerials ?? []).map((row) => ({
      serial_id: String((row as Record<string, unknown>).serial_id || ''),
      event_type: 'GENERATED_FROM_FINISHED_GOODS_COUNT',
      to_lifecycle_status: state.lifecycleStatus,
      to_qc_status: state.qcStatus,
      to_disposition_status: state.dispositionStatus,
      to_location_id: locationId,
      ref_type: 'FINISHED_GOODS_COUNT',
      ref_id: input.countSheetId,
      note: `Sinh serial phần dư từ kiểm kê cọc - dòng ${input.lineNo}`,
      changed_by: input.userId,
    }))
    const { error: historyError } = await input.supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) throw historyError

    const countSerialRows = (insertedSerials ?? []).map((row, index) => ({
      count_sheet_id: input.countSheetId,
      count_line_id: input.countLineId,
      serial_id: String((row as Record<string, unknown>).serial_id || ''),
      serial_code: buildSerialCode(lotCode, index + 1),
      count_status: 'UNEXPECTED_FOUND',
      system_location_id: locationId,
      counted_location_id: locationId,
      note: 'Serial dư sinh tạm từ kiểm kê cọc, chờ Admin duyệt',
      payload_json: {
        inventoryDomain: 'FINISHED_GOODS',
        itemKey: '',
        loaiCoc: normalizeText(input.loaiCoc),
        tenDoan: normalizeText(input.tenDoan),
        chieuDaiM: round3(input.chieuDaiM),
        visibleInProject: false,
        visibleInRetail: false,
        systemVisibilityLabel: 'Serial dư chờ duyệt',
        qcStatus: state.qcStatus,
        lifecycleStatus: state.lifecycleStatus,
        dispositionStatus: state.dispositionStatus,
        qualityProposal: input.qualityProposal,
        generatedFromCount: true,
        generatedLotId: lotId,
        generatedLotCode: lotCode,
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))

    const { error: countSerialError } = await input.supabase.from('inventory_count_serial').insert(countSerialRows)
    if (countSerialError) throw countSerialError
  }

  return { lotId, lotCode, serialCount: quantity }
}

async function clearDraftUnexpectedFoundForLine(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  countLineId: string
}) {
  const { data: existingRows, error: existingError } = await input.supabase
    .from('inventory_count_serial')
    .select('count_serial_id, serial_id, payload_json')
    .eq('count_sheet_id', input.countSheetId)
    .eq('count_line_id', input.countLineId)

  if (existingError) throw existingError

  const generatedRows = ((existingRows ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const payload = ((row.payload_json as Record<string, unknown> | null) || {}) as Record<string, unknown>
    return Boolean(payload.generatedFromCount)
  })

  if (!generatedRows.length) return

  const serialIds = generatedRows.map((row) => normalizeText(row.serial_id)).filter(Boolean)
  const countSerialIds = generatedRows.map((row) => normalizeText(row.count_serial_id)).filter(Boolean)
  const lotIds = Array.from(
    new Set(
      generatedRows
        .map((row) => {
          const payload = ((row.payload_json as Record<string, unknown> | null) || {}) as Record<string, unknown>
          return normalizeText(payload.generatedLotId)
        })
        .filter(Boolean)
    )
  )

  if (serialIds.length) {
    const { error: serialUpdateError } = await input.supabase
      .from('pile_serial')
      .update({
        is_active: false,
        updated_by: input.userId,
      })
      .in('serial_id', serialIds)

    if (serialUpdateError) throw serialUpdateError
  }

  if (lotIds.length) {
    const { error: lotUpdateError } = await input.supabase
      .from('production_lot')
      .update({
        is_active: false,
        updated_by: input.userId,
      })
      .in('lot_id', lotIds)

    if (lotUpdateError) throw lotUpdateError
  }

  if (countSerialIds.length) {
    const { error: deleteError } = await input.supabase
      .from('inventory_count_serial')
      .delete()
      .in('count_serial_id', countSerialIds)

    if (deleteError) throw deleteError
  }
}

export async function approveFinishedGoodsCountAndApply(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  const detail = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!detail) {
    throw new Error('Không tìm thấy phiếu kiểm kê cọc để duyệt.')
  }
  if (detail.status !== 'CHO_DUYET_CHENH_LECH') {
    throw new Error('Phiếu kiểm kê cọc này chưa ở bước chờ duyệt chênh lệch.')
  }

  if (detail.countMode === 'TON_DAU_KY') {
    const activated = await activateDraftOpeningBalanceLots({
      supabase: input.supabase,
      userId: input.userId,
      countSheetCode: detail.countSheetCode,
      openingDate: detail.countDate,
      lines: detail.lines.map((line) => ({
        lineNo: line.lineNo,
        templateId: line.templateId || '',
        maCoc: line.maCoc || '',
        loaiCoc: line.loaiCoc,
        tenDoan: line.tenDoan,
        chieuDaiM: line.chieuDaiM,
        quantity: Math.max(Math.trunc(toNumber(line.countedQty)), 0),
        qualityStatus: line.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
        locationId: line.locationId || null,
        note: buildOpeningBalanceSystemNote(detail.countSheetCode, line.lineNo, line.note),
      })),
    })

    if (!activated.activatedSerialCount) {
    for (const line of detail.lines) {
      const quantity = Math.max(Math.trunc(toNumber(line.countedQty)), 0)
      if (!quantity) continue

      await createOpeningBalanceLotAndSerials(input.supabase, {
        templateId: line.templateId || '',
        maCoc: line.maCoc || '',
        loaiCoc: line.loaiCoc,
        tenDoan: line.tenDoan,
        chieuDaiM: line.chieuDaiM,
        openingDate: detail.countDate,
        quantity,
        qualityStatus: line.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
        locationId: line.locationId || null,
        note: buildOpeningBalanceSystemNote(detail.countSheetCode, line.lineNo, line.note),
        createdBy: input.userId,
      })
    }
    }

    const nowIso = new Date().toISOString()
    const { error: openingBalanceHeaderError } = await input.supabase
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

    if (openingBalanceHeaderError) throw openingBalanceHeaderError

    const refreshedOpeningBalance = await loadFinishedGoodsCountDetail({
      supabase: input.supabase,
      countSheetId: input.countSheetId,
    })
    if (!refreshedOpeningBalance) {
      throw new Error('Không tải lại được phiếu nhập tồn đầu kỳ sau khi duyệt.')
    }
    return refreshedOpeningBalance
  }

  const locationByCode = await resolveWarehouseLocationMaps(input.supabase)

  for (const line of detail.lines) {
    for (const serialRow of line.serialRows) {
      if (!serialRow.serialId) continue
      const state = resolveSerialStateFromProposal({
        qualityProposal: serialRow.qualityProposal,
        countStatus: serialRow.countStatus,
      })
      const targetLocationId = state.defaultLocationCode ? locationByCode.get(state.defaultLocationCode) || null : null

      await updatePileSerialWithFallback({
        supabase: input.supabase,
        serialId: serialRow.serialId,
        payload: {
          lifecycle_status: state.lifecycleStatus,
          qc_status: state.qcStatus,
          disposition_status: state.dispositionStatus,
          visible_in_project: state.visibleInProject,
          visible_in_retail: state.visibleInRetail,
          current_location_id: targetLocationId,
          updated_by: input.userId,
        },
      })

      const { error: historyError } = await input.supabase.from('pile_serial_history').insert({
        serial_id: serialRow.serialId,
        event_type: 'FINISHED_GOODS_COUNT_APPROVED',
        to_lifecycle_status: state.lifecycleStatus,
        to_qc_status: state.qcStatus,
        to_disposition_status: state.dispositionStatus,
        to_location_id: targetLocationId,
        ref_type: 'FINISHED_GOODS_COUNT',
        ref_id: input.countSheetId,
        note:
          serialRow.countStatus === 'MISSING_IN_COUNT'
            ? 'Serial bị thiếu khi kiểm kê cọc'
            : serialRow.qualityProposal === 'HUY'
              ? 'Serial bị hủy khi duyệt kiểm kê cọc'
              : serialRow.qualityProposal === 'LOI'
                ? 'Serial chuyển sang lỗi / khách lẻ từ kiểm kê cọc'
                : 'Serial xác nhận đạt từ kiểm kê cọc',
        changed_by: input.userId,
      })
      if (historyError) throw historyError
    }

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

  const refreshed = await loadFinishedGoodsCountDetail({ supabase: input.supabase, countSheetId: input.countSheetId })
  if (!refreshed) throw new Error('Không tải lại được phiếu kiểm kê cọc sau khi duyệt.')
  return refreshed
}

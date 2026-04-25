import type { SupabaseClient } from '@supabase/supabase-js'
import { isNvlProcurementPayload } from '@/lib/external-pile-procurement/domain'
import type { NvlProposalRow, NvlPurchaseRequestSummaryRow } from '@/lib/nvl-procurement/types'

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

export async function isPurchaseRequestSchemaReady(supabase: AnySupabase) {
  const [headerResult, lineResult] = await Promise.all([
    supabase.from('material_purchase_request').select('request_id').limit(1),
    supabase.from('material_purchase_request_line').select('request_line_id').limit(1),
  ])

  if (!headerResult.error && !lineResult.error) return true
  if (
    (headerResult.error && isMissingRelationError(headerResult.error, 'material_purchase_request')) ||
    (lineResult.error && isMissingRelationError(lineResult.error, 'material_purchase_request_line'))
  ) {
    return false
  }

  if (headerResult.error) throw headerResult.error
  if (lineResult.error) throw lineResult.error
  return true
}

function toNumber(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function buildRequestCode() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `PR-NVL-${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export async function loadPurchaseRequestSummaries(
  supabase: AnySupabase
): Promise<{ schemaReady: boolean; rows: NvlPurchaseRequestSummaryRow[] }> {
  const schemaReady = await isPurchaseRequestSchemaReady(supabase)
  if (!schemaReady) return { schemaReady: false, rows: [] }

  const { data: headerRows, error: headerError } = await supabase
    .from('material_purchase_request')
    .select('request_id, request_code, status, source_mode, note, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(200)

  if (headerError) throw headerError

  const filteredHeaderRows = ((headerRows ?? []) as Array<Record<string, unknown>>).filter((row) =>
    isNvlProcurementPayload(row.payload_json)
  )

  const requestIds = filteredHeaderRows
    .map((row) => String(row.request_id || ''))
    .filter(Boolean)

  if (!requestIds.length) return { schemaReady: true, rows: [] }

  const { data: lineRows, error: lineError } = await supabase
    .from('material_purchase_request_line')
    .select('request_id, request_line_id, line_no, material_code, material_name, unit, proposed_qty, plan_count, window_label, reason, status')
    .in('request_id', requestIds)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const lineBucket = new Map<
    string,
    {
      lineCount: number
      totalProposedQty: number
      lines: NvlPurchaseRequestSummaryRow['lines']
    }
  >()
  for (const rawRow of (lineRows ?? []) as Array<Record<string, unknown>>) {
    const requestId = String(rawRow.request_id || '')
    if (!requestId) continue
    const current = lineBucket.get(requestId) || { lineCount: 0, totalProposedQty: 0, lines: [] }
    current.lineCount += 1
    current.totalProposedQty += toNumber(rawRow.proposed_qty)
    current.lines.push({
      requestLineId: String(rawRow.request_line_id || ''),
      lineNo: toNumber(rawRow.line_no),
      materialCode: String(rawRow.material_code || ''),
      materialName: String(rawRow.material_name || rawRow.material_code || ''),
      unit: String(rawRow.unit || ''),
      proposedQty: Math.round(toNumber(rawRow.proposed_qty) * 1000) / 1000,
      planCount: toNumber(rawRow.plan_count),
      windowLabel: String(rawRow.window_label || ''),
      reason: String(rawRow.reason || ''),
      status:
        rawRow.status === 'CHO_DUYET' ||
        rawRow.status === 'DA_DUYET' ||
        rawRow.status === 'TU_CHOI' ||
        rawRow.status === 'DA_CHUYEN_DAT_HANG'
          ? rawRow.status
          : 'DRAFT',
    })
    lineBucket.set(requestId, current)
  }

  const rows: NvlPurchaseRequestSummaryRow[] = filteredHeaderRows.map((row) => {
    const requestId = String(row.request_id || '')
    const lineMeta = lineBucket.get(requestId) || { lineCount: 0, totalProposedQty: 0, lines: [] }
    return {
      requestId,
      requestCode: String(row.request_code || requestId || '-'),
      status:
        row.status === 'CHO_DUYET' ||
        row.status === 'DA_DUYET' ||
        row.status === 'TU_CHOI' ||
        row.status === 'DA_CHUYEN_DAT_HANG'
          ? row.status
          : 'DRAFT',
      sourceMode: row.source_mode === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
      lineCount: lineMeta.lineCount,
      totalProposedQty: Math.round(lineMeta.totalProposedQty * 1000) / 1000,
      note: String(row.note || ''),
      createdAt: String(row.created_at || ''),
      lines: lineMeta.lines,
    }
  })

  return { schemaReady: true, rows }
}

export async function createPurchaseRequestDraft(input: {
  supabase: AnySupabase
  userId: string
  sourceMode: 'LIVE_DEMAND_ONLY' | 'FULL'
  note?: string
  rows: NvlProposalRow[]
}) {
  const schemaReady = await isPurchaseRequestSchemaReady(input.supabase)
  if (!schemaReady) {
    throw new Error('Chức năng lưu bản đề xuất mua đang trong giai đoạn nối dữ liệu, nên hiện chưa lưu riêng được.')
  }

  const lines = input.rows.filter((row) => Number(row.proposedQty || 0) > 0)
  if (!lines.length) {
    throw new Error('Không có dòng vật tư hợp lệ để lưu thành bản đề xuất.')
  }

  const requestCode = buildRequestCode()
  const payloadSnapshot = {
    sourceMode: input.sourceMode,
    lineCount: lines.length,
    rows: lines.map((row) => ({
      materialCode: row.materialCode,
      materialName: row.materialName,
      proposedQty: row.proposedQty,
      unit: row.unit,
      planCount: row.planCount,
      windowLabel: row.windowLabel,
      basisLabel: row.basisLabel,
      urgencyLabel: row.urgencyLabel,
      reason: row.reason,
      explanation: row.explanation,
    })),
  }

  const { data: headerRow, error: headerError } = await input.supabase
    .from('material_purchase_request')
    .insert({
      request_code: requestCode,
      status: 'DRAFT',
      source_mode: input.sourceMode,
      note: String(input.note || ''),
      payload_json: payloadSnapshot,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('request_id, request_code, status, source_mode, note, created_at')
    .single()

  if (headerError || !headerRow) throw headerError || new Error('Không tạo được bản đề xuất mua NVL.')

  const requestId = String((headerRow as Record<string, unknown>).request_id || '')
  if (!requestId) {
    throw new Error('Không lấy được mã bản đề xuất sau khi lưu.')
  }

  const { error: lineError } = await input.supabase.from('material_purchase_request_line').insert(
    lines.map((row, index) => ({
      request_id: requestId,
      line_no: index + 1,
      material_code: row.materialCode,
      material_name: row.materialName,
      unit: row.unit,
      proposed_qty: row.proposedQty,
      plan_count: row.planCount,
      window_label: row.windowLabel,
      basis_label: row.basisLabel,
      urgency_label: row.urgencyLabel,
      status: 'DRAFT',
      source_mode: row.sourceMode,
      reason: row.reason,
      explanation: row.explanation,
      payload_json: {
        sourceMode: row.sourceMode,
        planCount: row.planCount,
      },
      created_by: input.userId,
      updated_by: input.userId,
    }))
  )

  if (lineError) throw lineError

  return {
    requestId,
    requestCode: String((headerRow as Record<string, unknown>).request_code || requestCode),
    lineCount: lines.length,
  }
}

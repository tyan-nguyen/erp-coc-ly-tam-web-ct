import type {
  ProductionVarianceMaterialRow,
  ProductionVarianceReportPageData,
  ProductionVarianceReportRow,
} from '@/lib/production-variance-report/types'

type AnySupabase = {
  from: (table: string) => {
    select: (columns?: string) => unknown
  }
}

type QueryBuilder = {
  eq?: (column: string, value: unknown) => QueryBuilder
  gte?: (column: string, value: unknown) => QueryBuilder
  lte?: (column: string, value: unknown) => QueryBuilder
  in?: (column: string, values: unknown[]) => QueryBuilder
  order?: (column: string, options?: Record<string, unknown>) => QueryBuilder
  limit?: (count: number) => QueryBuilder
  then: Promise<unknown>['then']
}

function asQuery(value: unknown) {
  return value as QueryBuilder
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round3(value: number) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function variancePct(varianceQty: number, estimatedQty: number) {
  if (!Number.isFinite(estimatedQty) || Math.abs(estimatedQty) <= 0.000001) return null
  return round2((varianceQty / estimatedQty) * 100)
}

function defectPct(defectQty: number, actualQty: number) {
  if (!Number.isFinite(actualQty) || actualQty <= 0) return null
  return round2((defectQty / actualQty) * 100)
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function aggregateMaterials(rawMaterials: Array<Record<string, unknown>>): ProductionVarianceMaterialRow[] {
  const materialMap = new Map<string, ProductionVarianceMaterialRow>()

  for (const material of rawMaterials) {
    const key = normalizeText(material.key) || normalizeText(material.label)
    if (!key) continue

    const current =
      materialMap.get(key) ?? {
        key,
        label: normalizeText(material.label) || key,
        group: normalizeText(material.nhom),
        unit: normalizeText(material.dvt),
        estimatedQty: 0,
        actualQty: 0,
        varianceQty: 0,
        variancePct: null,
      }

    current.estimatedQty = round3(current.estimatedQty + toNumber(material.estimateQty))
    current.actualQty = round3(current.actualQty + toNumber(material.actualQty))
    current.varianceQty = round3(current.actualQty - current.estimatedQty)
    current.variancePct = variancePct(current.varianceQty, current.estimatedQty)
    materialMap.set(key, current)
  }

  return Array.from(materialMap.values()).sort((left, right) => {
    const groupCompare = left.group.localeCompare(right.group, 'vi')
    if (groupCompare !== 0) return groupCompare
    return left.label.localeCompare(right.label, 'vi')
  })
}

function firstActiveRowByPlan(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const planId = normalizeText(row.plan_id)
    if (!planId || map.has(planId)) continue
    map.set(planId, row)
  }
  return map
}

export async function loadProductionVarianceReportPageData(
  supabase: AnySupabase,
  params: {
    fromDate: string
    toDate: string
  }
): Promise<ProductionVarianceReportPageData> {
  const fromDate = normalizeText(params.fromDate)
  const toDate = normalizeText(params.toDate)

  const planQuery = asQuery(
    supabase
      .from('ke_hoach_sx_ngay')
      .select('plan_id, ngay_ke_hoach, trang_thai, ghi_chu')
  )
    .eq?.('is_active', true)
    .gte?.('ngay_ke_hoach', fromDate)
    .lte?.('ngay_ke_hoach', toDate)
    .order?.('ngay_ke_hoach', { ascending: false })
    .limit?.(120) as QueryBuilder

  const { data: planRowsRaw, error: planError } = (await planQuery) as {
    data: Array<Record<string, unknown>> | null
    error: Error | null
  }
  if (planError) throw planError

  const planRows = safeArray<Record<string, unknown>>(planRowsRaw)
  const planIds = planRows.map((row) => normalizeText(row.plan_id)).filter(Boolean)

  if (planIds.length === 0) {
    return {
      filters: { fromDate, toDate },
      rows: [],
      summary: {
        planCount: 0,
        plannedQty: 0,
        warehouseActualQty: 0,
        qcAcceptedQty: 0,
        defectQty: 0,
        materialEstimatedQty: 0,
        materialActualQty: 0,
        materialVarianceQty: 0,
        materialVariancePct: null,
      },
    }
  }

  const [lineResult, issueResult, qcResult] = await Promise.all([
    asQuery(
      supabase
        .from('ke_hoach_sx_line')
        .select('line_id, plan_id, so_luong_ke_hoach, so_luong_da_san_xuat')
    )
      .eq?.('is_active', true)
      .in?.('plan_id', planIds),
    asQuery(
      supabase
        .from('sx_xuat_nvl')
        .select('voucher_id, plan_id, ngay_thao_tac, payload_json, is_active, created_at')
    )
      .eq?.('is_active', true)
      .in?.('plan_id', planIds)
      .order?.('created_at', { ascending: false }),
    asQuery(
      supabase
        .from('sx_qc_nghiem_thu')
        .select('voucher_id, plan_id, ngay_thao_tac, payload_json, is_active, created_at')
    )
      .eq?.('is_active', true)
      .in?.('plan_id', planIds)
      .order?.('created_at', { ascending: false }),
  ]) as Array<{
    data: Array<Record<string, unknown>> | null
    error: Error | null
  }>

  if (lineResult.error) throw lineResult.error
  if (issueResult.error) throw issueResult.error
  if (qcResult.error) throw qcResult.error

  const lineRowsByPlan = new Map<string, Array<Record<string, unknown>>>()
  for (const line of safeArray<Record<string, unknown>>(lineResult.data)) {
    const planId = normalizeText(line.plan_id)
    if (!planId) continue
    const current = lineRowsByPlan.get(planId) ?? []
    current.push(line)
    lineRowsByPlan.set(planId, current)
  }

  const issueByPlan = firstActiveRowByPlan(safeArray<Record<string, unknown>>(issueResult.data))
  const qcByPlan = firstActiveRowByPlan(safeArray<Record<string, unknown>>(qcResult.data))

  const rows: ProductionVarianceReportRow[] = planRows.map((plan) => {
    const planId = normalizeText(plan.plan_id)
    const lines = lineRowsByPlan.get(planId) ?? []
    const plannedQty = round3(lines.reduce((sum, line) => sum + toNumber(line.so_luong_ke_hoach), 0))
    const fallbackActualQty = round3(lines.reduce((sum, line) => sum + toNumber(line.so_luong_da_san_xuat), 0))

    const issuePayload = (issueByPlan.get(planId)?.payload_json as Record<string, unknown> | null) ?? null
    const lineDrafts = safeArray<Record<string, unknown>>(issuePayload?.lineDrafts)
    const materialRows = aggregateMaterials(safeArray<Record<string, unknown>>(issuePayload?.materialSummaries))
    const warehouseActualQty =
      lineDrafts.length > 0
        ? round3(lineDrafts.reduce((sum, line) => sum + toNumber(line.actualProductionQty), 0))
        : fallbackActualQty

    const qcPayload = (qcByPlan.get(planId)?.payload_json as Record<string, unknown> | null) ?? null
    const qcLineResults = safeArray<Record<string, unknown>>(qcPayload?.lineResults)
    const qcAcceptedQty =
      qcLineResults.length > 0
        ? round3(qcLineResults.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0))
        : null
    const defectQty = qcAcceptedQty === null ? null : round3(Math.max(warehouseActualQty - qcAcceptedQty, 0))
    const materialEstimatedQty = round3(materialRows.reduce((sum, material) => sum + material.estimatedQty, 0))
    const materialActualQty = round3(materialRows.reduce((sum, material) => sum + material.actualQty, 0))
    const materialVarianceQty = round3(materialActualQty - materialEstimatedQty)

    return {
      planId,
      date: normalizeText(plan.ngay_ke_hoach),
      status: normalizeText(plan.trang_thai),
      lineCount: lines.length,
      plannedQty,
      warehouseActualQty,
      qcAcceptedQty,
      defectQty,
      defectPct: defectQty === null ? null : defectPct(defectQty, warehouseActualQty),
      materialEstimatedQty,
      materialActualQty,
      materialVarianceQty,
      materialVariancePct: variancePct(materialVarianceQty, materialEstimatedQty),
      materialRows,
    }
  })

  const summaryEstimatedQty = round3(rows.reduce((sum, row) => sum + row.materialEstimatedQty, 0))
  const summaryActualQty = round3(rows.reduce((sum, row) => sum + row.materialActualQty, 0))
  const summaryVarianceQty = round3(summaryActualQty - summaryEstimatedQty)

  return {
    filters: { fromDate, toDate },
    rows,
    summary: {
      planCount: rows.length,
      plannedQty: round3(rows.reduce((sum, row) => sum + row.plannedQty, 0)),
      warehouseActualQty: round3(rows.reduce((sum, row) => sum + row.warehouseActualQty, 0)),
      qcAcceptedQty: round3(rows.reduce((sum, row) => sum + (row.qcAcceptedQty ?? 0), 0)),
      defectQty: round3(rows.reduce((sum, row) => sum + (row.defectQty ?? 0), 0)),
      materialEstimatedQty: summaryEstimatedQty,
      materialActualQty: summaryActualQty,
      materialVarianceQty: summaryVarianceQty,
      materialVariancePct: variancePct(summaryVarianceQty, summaryEstimatedQty),
    },
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NvlDemandCockpitPageData, NvlDemandCockpitRow, NvlDemandSourcePlan } from '@/lib/nvl-demand/types'
import { loadKeHoachNgayMaterialDemand } from '@/lib/san-xuat/repository'
import { loadNvlStockTruthPageData } from '@/lib/nvl-stock/page-data'

type AnySupabase = SupabaseClient

function formatDateLabel(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function normalizeLookupKey(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export async function loadNvlDemandCockpitPageData(
  supabase: AnySupabase
): Promise<NvlDemandCockpitPageData> {
  const stockTruthPageData = await loadNvlStockTruthPageData(supabase)
  const stockByCode = new Map(stockTruthPageData.rows.map((row) => [normalizeLookupKey(row.materialCode), row]))
  const stockByName = new Map(stockTruthPageData.rows.map((row) => [normalizeLookupKey(row.materialName), row]))
  const [{ data: planRows, error: planError }, { data: warehouseVoucherRows, error: warehouseVoucherError }] =
    await Promise.all([
      supabase
        .from('ke_hoach_sx_ngay')
        .select('plan_id, ngay_ke_hoach, trang_thai')
        .eq('is_active', true)
        .eq('trang_thai', 'DA_CHOT')
        .order('ngay_ke_hoach', { ascending: false }),
      supabase.from('sx_xuat_nvl').select('plan_id').eq('is_active', true),
    ])

  if (planError) throw planError
  if (warehouseVoucherError) {
    const message = String(warehouseVoucherError.message || '').toLowerCase()
    if (
      !(message.includes('relation') && message.includes('sx_xuat_nvl')) &&
      !(message.includes('schema cache') && message.includes('sx_xuat_nvl'))
    ) {
      throw warehouseVoucherError
    }
  }

  const issuedPlanIds = new Set(
    ((warehouseVoucherRows ?? []) as Array<Record<string, unknown>>).map((row) => String(row.plan_id || '')).filter(Boolean)
  )

  const openConfirmedPlans = ((planRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      planId: String(row.plan_id || ''),
      ngayKeHoach: String(row.ngay_ke_hoach || ''),
    }))
    .filter((item) => item.planId && !issuedPlanIds.has(item.planId))

  const details = await Promise.all(
    openConfirmedPlans.map((item) => loadKeHoachNgayMaterialDemand(supabase, item.planId))
  )

  const bucket = new Map<
    string,
    {
      materialCode: string
      materialName: string
      unit: string
      demandQty: number
      planIds: Set<string>
      dates: string[]
      overrunPlanIds: Set<string>
    }
  >()

  for (const detail of details) {
    if (!detail?.materialSummaries?.length) continue
    for (const material of detail.materialSummaries) {
      const code = String(material.key || '').trim()
      if (!code) continue
      const current =
        bucket.get(code) || {
          materialCode: code,
          materialName: String(material.label || code),
          unit: String(material.dvt || ''),
          demandQty: 0,
          planIds: new Set<string>(),
          dates: [],
          overrunPlanIds: new Set<string>(),
        }
      current.demandQty += Number(material.estimateQty || 0)
      current.planIds.add(detail.planId)
      current.dates.push(String(detail.ngayKeHoach || ''))
      if (detail.hasOverrunRisk) current.overrunPlanIds.add(detail.planId)
      bucket.set(code, current)
    }
  }

  const rows: NvlDemandCockpitRow[] = Array.from(bucket.values())
    .map((item) => {
      const sortedDates = item.dates.filter(Boolean).sort()
      const fromDate = sortedDates[0] || ''
      const toDate = sortedDates[sortedDates.length - 1] || ''
      const stockRow =
        stockByCode.get(normalizeLookupKey(item.materialCode)) ||
        stockByName.get(normalizeLookupKey(item.materialName))
      const stockQty = Math.round(Number(stockRow?.stockQty || 0) * 1000) / 1000
      const availableQty = Math.round(Number(stockRow?.availableQty || 0) * 1000) / 1000
      const openInboundQty = 0
      const reusableCoverageQty = availableQty + openInboundQty
      const shortageQty = Math.max(0, Math.round((item.demandQty - reusableCoverageQty) * 1000) / 1000)
      const surplusQty = Math.max(0, Math.round((reusableCoverageQty - item.demandQty) * 1000) / 1000)
      const status =
        shortageQty > 0 ? ('SHORTAGE' as const) : surplusQty > 0 ? ('SURPLUS' as const) : ('COVERED' as const)
      const hasOverrunRisk = item.overrunPlanIds.size > 0
      const recommendation = hasOverrunRisk
        ? 'Có kế hoạch nguồn đang vượt đơn hàng'
        : shortageQty > 0
          ? 'Thiếu so với tồn khả dụng hiện tại'
          : surplusQty > 0
            ? 'Đã đủ từ tồn khả dụng hiện tại'
            : 'Đủ theo tồn khả dụng hiện tại'
      const explanation = stockTruthPageData.schemaReady
        ? `Nhu cầu này được tổng hợp từ ${item.planIds.size} kế hoạch đã chốt. Hiện đã nối tồn thực NVL: tồn vật lý ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(stockQty)}, khả dụng ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(availableQty)}.${hasOverrunRisk ? ` Có ${item.overrunPlanIds.size} kế hoạch nguồn đang vượt số lượng đơn hàng, nên cần rà lại trước khi duyệt mua.` : ' Open inbound và reusable coverage nâng cao sẽ nối tiếp ở bước sau.'}`
        : `Nhu cầu này đã được tổng hợp từ ${item.planIds.size} kế hoạch đã chốt.${hasOverrunRisk ? ` Có ${item.overrunPlanIds.size} kế hoạch nguồn đang vượt số lượng đơn hàng, nên cần rà lại trước khi duyệt mua.` : ' Giai đoạn hiện tại mới nối demand thật từ KHSX; tồn hiện tại, open inbound và reusable coverage sẽ được nối ở bước tiếp theo để ra quyết định mua chính xác.'}`
      return {
        id: item.materialCode,
        materialCode: item.materialCode,
        materialName: item.materialName,
        unit: item.unit,
        planCount: item.planIds.size,
        windowLabel: fromDate && toDate ? `${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)}` : '-',
        demandQty: Math.round(item.demandQty * 1000) / 1000,
        stockQty,
        availableQty,
        openInboundQty,
        reusableCoverageQty,
        shortageQty,
        surplusQty,
        status,
        hasOverrunRisk,
        overrunPlanCount: item.overrunPlanIds.size,
        recommendation,
        explanation,
      }
    })
    .sort((a, b) => b.demandQty - a.demandQty || a.materialName.localeCompare(b.materialName))

  const sourcePlans: NvlDemandSourcePlan[] = details
    .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
    .map((detail) => ({
      planId: detail.planId,
      ngayKeHoach: detail.ngayKeHoach,
      plannedQtyTotal: detail.plannedQtyTotal,
      lineCount: detail.lineCount,
      hasOverrunRisk: Boolean(detail.hasOverrunRisk),
      overrunLineCount: Number(detail.overrunLineCount || 0),
      lineDebugs: detail.lineDebugs ?? [],
      materialRows: detail.materialSummaries
        .map((item) => ({
          materialCode: String(item.key || ''),
          materialName: String(item.label || item.key || ''),
          unit: String(item.dvt || ''),
          demandQty: Math.round(Number(item.estimateQty || 0) * 1000) / 1000,
        }))
        .filter((item) => item.materialCode),
    }))
    .sort((a, b) => a.ngayKeHoach.localeCompare(b.ngayKeHoach))

  const totalDemand = rows.reduce((sum, row) => sum + row.demandQty, 0)

  return {
    mode: 'LIVE_DEMAND_ONLY',
    stockTruthReady: stockTruthPageData.schemaReady,
    summaryCards: [
      {
        label: 'Kế hoạch đã chốt',
        value: String(openConfirmedPlans.length),
        helpText: 'Chỉ tính các kế hoạch đã chốt nhưng chưa được Thủ kho xác nhận thực sản xuất & xuất NVL.',
      },
      {
        label: 'Dòng NVL',
        value: String(rows.length),
        helpText: 'Số vật tư đã được tổng hợp từ KHSX thật.',
      },
      {
        label: 'Tổng nhu cầu',
        value: new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(totalDemand),
        helpText: 'Chỉ là lớp demand. Chưa trừ tồn kho hay hàng đang mua.',
      },
      {
        label: 'Chế độ dữ liệu',
        value: 'Demand thật',
        helpText: stockTruthPageData.schemaReady
          ? 'Stock truth schema đã sẵn sàng. Bước tiếp theo là nối stock thật và open inbound.'
          : 'Stock truth schema chưa sẵn sàng. Chưa nối tồn thực, open inbound hay reusable coverage.',
      },
    ],
    rows,
    sourcePlans,
  }
}

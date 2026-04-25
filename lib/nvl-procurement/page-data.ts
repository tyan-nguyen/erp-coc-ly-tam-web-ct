import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveDisplayCode, formatNhomHangLabel } from '@/lib/master-data/nvl'
import { loadNvlDemandCockpitPageData } from '@/lib/nvl-demand/page-data'
import type { NvlMaterialCatalogOption, NvlProcurementFlowPageData, NvlProposalRow } from '@/lib/nvl-procurement/types'
import { loadPurchaseRequestSummaries } from '@/lib/nvl-procurement/purchase-request-repository'
import { loadPurchaseOrderSummaries } from '@/lib/nvl-procurement/purchase-order-repository'
import { loadReceiptSummaries } from '@/lib/nvl-procurement/receipt-repository'

type AnySupabase = SupabaseClient

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function buildProposalRowsFromDemand(
  demandPageData: Awaited<ReturnType<typeof loadNvlDemandCockpitPageData>>
): NvlProposalRow[] {
  return demandPageData.rows.map((row) => {
    const proposalQty = demandPageData.mode === 'FULL' ? Math.max(0, row.shortageQty) : row.demandQty
    const isActionable = proposalQty > 0

    return {
      id: row.id,
      materialCode: row.materialCode,
      materialName: row.materialName,
      windowLabel: row.windowLabel,
      proposedQty: proposalQty,
      unit: row.unit,
      planCount: row.planCount,
      sourceMode: demandPageData.mode,
      basisLabel:
        demandPageData.mode === 'FULL'
          ? 'Đã trừ tồn kho và hàng đang về'
          : 'Theo nhu cầu từ kế hoạch sản xuất',
      urgencyLabel: row.windowLabel === '-' ? 'Chưa xác định kỳ' : `Kỳ ${row.windowLabel}`,
      status: isActionable && demandPageData.mode === 'FULL' ? 'CHO_DUYET' : 'DRAFT',
      reason:
        demandPageData.mode === 'FULL'
          ? row.recommendation
          : 'Cần rà lại với tồn kho và hàng đã đặt trước khi quyết định mua.',
      explanation:
        demandPageData.mode === 'FULL'
          ? row.explanation
          : `Hiện đang cần ${formatNumber(row.demandQty)} ${row.unit} từ ${row.planCount} kế hoạch đã chốt. Màn này mới phản ánh nhu cầu theo kế hoạch, chưa tự trừ tồn kho và hàng đã đặt.`,
    }
  })
}

async function loadMaterialCatalogOptions(supabase: AnySupabase): Promise<NvlMaterialCatalogOption[]> {
  const { data, error } = await supabase
    .from('nvl')
    .select('*')
    .limit(1000)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const value = String(row.nvl_id || '').trim()
      const label = String(row.ten_hang || '').trim()
      if (!value || !label) return null
      return {
        value,
        code: deriveDisplayCode(row),
        label,
        unit: String(row.dvt || '').trim() || 'cái',
        category: formatNhomHangLabel(row.nhom_hang),
      }
    })
    .filter(Boolean) as NvlMaterialCatalogOption[]
}

async function loadVendorOptions(supabase: AnySupabase): Promise<Array<{ value: string; label: string }>> {
  const { data, error } = await supabase.from('dm_ncc').select('ncc_id, ten_ncc, is_active').limit(500)
  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const value = String(row.ncc_id || '').trim()
      const label = String(row.ten_ncc || '').trim()
      if (!value || !label) return null
      return { value, label }
    })
    .filter(Boolean) as Array<{ value: string; label: string }>
}

export async function loadNvlProcurementFlowPageData(
  supabase: AnySupabase
): Promise<NvlProcurementFlowPageData> {
  const [demandPageData, purchaseRequestData, purchaseOrderData, receiptData, materialCatalogOptions, vendorOptions] = await Promise.all([
    loadNvlDemandCockpitPageData(supabase),
    loadPurchaseRequestSummaries(supabase),
    loadPurchaseOrderSummaries(supabase),
    loadReceiptSummaries(supabase),
    loadMaterialCatalogOptions(supabase),
    loadVendorOptions(supabase),
  ])
  const proposalRows = buildProposalRowsFromDemand(demandPageData)
  const materialCatalogOptionsEffective =
    materialCatalogOptions.length > 0
      ? materialCatalogOptions
      : Array.from(
          new Map(
            proposalRows.map((row) => [
              row.materialCode,
              {
                value: row.materialCode,
                code: row.materialCode,
                label: row.materialName,
                unit: row.unit || 'cái',
                category: 'Theo nhu cầu hiện có',
              },
            ])
          ).values()
        )
  const actionableProposalCount =
    demandPageData.mode === 'FULL'
      ? proposalRows.filter((row) => row.proposedQty > 0).length
      : proposalRows.length
  const reviewOnlyProposalCount =
    demandPageData.mode === 'FULL'
      ? proposalRows.filter((row) => row.proposedQty <= 0).length
      : proposalRows.length

  return {
    proposalMode: demandPageData.mode,
    stockTruthReady: demandPageData.stockTruthReady,
    purchaseRequestSchemaReady: purchaseRequestData.schemaReady,
    purchaseOrderSchemaReady: purchaseOrderData.schemaReady,
    receiptSchemaReady: receiptData.schemaReady,
    materialCatalogOptions: materialCatalogOptionsEffective,
    vendorOptions,
    demandSummaryCards: demandPageData.summaryCards.slice(0, 3),
    demandRows: demandPageData.rows.map((row) => ({
      id: row.id,
      materialCode: row.materialCode,
      materialName: row.materialName,
      unit: row.unit,
      windowLabel: row.windowLabel,
      planCount: row.planCount,
      demandQty: row.demandQty,
      stockQty: row.stockQty,
      availableQty: row.availableQty,
      openInboundQty: row.openInboundQty,
      reusableCoverageQty: row.reusableCoverageQty,
      shortageQty: row.shortageQty,
      surplusQty: row.surplusQty,
      hasOverrunRisk: row.hasOverrunRisk,
      overrunPlanCount: row.overrunPlanCount,
      recommendation: row.recommendation,
      explanation: row.explanation,
    })),
    demandSourcePlans: demandPageData.sourcePlans.map((plan) => ({
      planId: plan.planId,
      ngayKeHoach: plan.ngayKeHoach,
      plannedQtyTotal: plan.plannedQtyTotal,
      lineCount: plan.lineCount,
      hasOverrunRisk: plan.hasOverrunRisk,
      overrunLineCount: plan.overrunLineCount,
      materialRows: plan.materialRows,
    })),
    stageCards: [
      {
        label: 'Dòng cần mua',
        value: `${actionableProposalCount}`,
        helpText:
          demandPageData.mode === 'FULL'
            ? 'Số vật tư đang thiếu thật sự và có thể chuyển sang bước duyệt mua.'
            : 'Số vật tư đang được gợi ý mua theo nhu cầu từ kế hoạch sản xuất.',
      },
      {
        label: 'Bước đặt hàng',
        value: demandPageData.mode === 'FULL' ? 'Sẵn sàng' : 'Chưa bật',
        helpText:
          'Sau khi rà xong nhu cầu, bước tiếp theo sẽ là tạo đơn đặt hàng cho nhà cung cấp.',
      },
      {
        label: 'Nhập kho',
        value: 'Nhiều đợt',
        helpText: 'Một đơn mua có thể giao nhiều đợt. Chỉ số đạt thực tế mới được tính vào tồn kho.',
      },
      {
        label: 'Cần rà lại',
        value: `${reviewOnlyProposalCount}`,
        helpText:
          'Các dòng này mới đang dựa theo kế hoạch sản xuất. Trước khi mua cần đối chiếu thêm hàng đã đặt và tồn kho thực tế.',
      },
    ],
    proposalRows,
    savedRequestRows: purchaseRequestData.rows,
    savedPurchaseOrderRows: purchaseOrderData.rows,
    savedReceiptRows: receiptData.rows,
    purchaseOrderRows: [
      {
        poCode: 'PO-NVL-001',
        vendorName: 'NCC Minh Phát',
        materialName: 'Mũi A',
        orderedQty: 10,
        unit: 'cái',
        expectedDate: '2026-03-02',
        status: 'DA_GUI_NCC',
      },
      {
        poCode: 'PO-NVL-002',
        vendorName: 'NCC Xi măng Nam Việt',
        materialName: 'Xi măng PCB40',
        orderedQty: 12,
        unit: 'bao',
        expectedDate: '2026-04-09',
        status: 'DRAFT',
      },
    ],
    receiptRows: [
      {
        receiptCode: 'RCV-NVL-001',
        materialName: 'Mũi A',
        orderedQty: 10,
        receivedQty: 10,
        cumulativeReceivedQty: 10,
        acceptedQty: 8,
        defectiveQty: 2,
        rejectedQty: 0,
        remainingQty: 0,
        unit: 'cái',
        status: 'DA_XU_LY_LOI',
      },
      {
        receiptCode: 'RCV-NVL-002',
        materialName: 'Xi măng PCB40',
        orderedQty: 12,
        receivedQty: 8,
        cumulativeReceivedQty: 8,
        acceptedQty: 8,
        defectiveQty: 0,
        rejectedQty: 0,
        remainingQty: 4,
        unit: 'bao',
        status: 'DA_NHAN_MOT_PHAN',
      },
    ],
  }
}

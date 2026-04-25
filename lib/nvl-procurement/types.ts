export type NvlProcurementStageCard = {
  label: string
  value: string
  helpText: string
}

export type NvlProposalSourceMode = 'LIVE_DEMAND_ONLY' | 'FULL'

export type NvlMaterialCatalogOption = {
  value: string
  code: string
  label: string
  unit: string
  category: string
}

export type NvlDemandDecisionRow = {
  id: string
  materialCode: string
  materialName: string
  unit: string
  windowLabel: string
  planCount: number
  demandQty: number
  stockQty: number
  availableQty: number
  openInboundQty: number
  reusableCoverageQty: number
  shortageQty: number
  surplusQty: number
  hasOverrunRisk: boolean
  overrunPlanCount: number
  recommendation: string
  explanation: string
}

export type NvlDemandSourcePlanView = {
  planId: string
  ngayKeHoach: string
  plannedQtyTotal: number
  lineCount: number
  hasOverrunRisk: boolean
  overrunLineCount: number
  materialRows: Array<{
    materialCode: string
    materialName: string
    unit: string
    demandQty: number
  }>
}

export type NvlProposalRow = {
  id: string
  materialCode: string
  materialName: string
  category?: string
  windowLabel: string
  proposedQty: number
  unit: string
  planCount: number
  sourceMode: NvlProposalSourceMode
  basisLabel: string
  urgencyLabel: string
  status: 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'DA_CHUYEN_DAT_HANG'
  reason: string
  explanation: string
}

export type NvlPurchaseOrderRow = {
  poCode: string
  vendorName: string
  materialName: string
  orderedQty: number
  unit: string
  expectedDate: string
  status: 'DRAFT' | 'DA_GUI_NCC' | 'XAC_NHAN_MOT_PHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_NHAN_DU' | 'HUY'
}

export type NvlReceiptRow = {
  receiptCode: string
  materialName: string
  orderedQty: number
  receivedQty: number
  cumulativeReceivedQty: number
  acceptedQty: number
  defectiveQty: number
  rejectedQty: number
  remainingQty: number
  unit: string
  status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
}

export type NvlPurchaseRequestSummaryRow = {
  requestId: string
  requestCode: string
  status: 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'DA_CHUYEN_DAT_HANG'
  sourceMode: NvlProposalSourceMode
  lineCount: number
  totalProposedQty: number
  note: string
  createdAt: string
  lines: Array<{
    requestLineId: string
    lineNo: number
    materialCode: string
    materialName: string
    unit: string
    proposedQty: number
    planCount: number
    windowLabel: string
    reason: string
    status: 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'DA_CHUYEN_DAT_HANG'
  }>
}

export type NvlPurchaseOrderSummaryRow = {
  poId: string
  poCode: string
  requestId: string
  requestCode: string
  vendorName: string
  status: 'DRAFT' | 'DA_GUI_NCC' | 'XAC_NHAN_MOT_PHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_NHAN_DU' | 'HUY'
  sourceMode: NvlProposalSourceMode
  lineCount: number
  totalOrderedQty: number
  totalReceivedQty: number
  totalAcceptedQty: number
  receiptBatchCount: number
  workflowLabel: string
  expectedDate: string
  note: string
  createdAt: string
  lines: Array<{
    poLineId: string
    requestId: string
    requestLineId: string
    materialCode: string
    materialName: string
    unit: string
    orderedQty: number
    actualReceivedQty: number
    acceptedQty: number
    billedQty: number
    unitPrice: number
    lineAmount: number
    varianceQty: number
    variancePct: number
    varianceDisposition: 'KHONG_CHENH_LECH' | 'CHI_PHI_DOANH_NGHIEP' | 'CHI_PHI_THAT_THOAT'
    haoHutPct: number
  }>
}

export type NvlReceiptSummaryRow = {
  receiptId: string
  receiptCode: string
  poId: string
  poCode: string
  vendorName: string
  status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
  batchNo: number
  lineCount: number
  totalReceivedQty: number
  totalAcceptedQty: number
  totalDefectiveQty: number
  totalRejectedQty: number
  totalBilledQty: number
  totalAmount: number
  settlementStatus: 'CHUA_CHOT' | 'DA_CHOT'
  movementRecorded: boolean
  createdAt: string
  settledAt: string
}

export type NvlReceiptDetailLine = {
  receiptLineId: string
  lineNo: number
  materialCode: string
  materialName: string
  unit: string
  orderedQty: number
  receivedQty: number
  acceptedQty: number
  defectiveQty: number
  rejectedQty: number
  status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
  billedQty: number
  unitPrice: number
  lineAmount: number
  varianceQty: number
  variancePct: number
  varianceDisposition: 'KHONG_CHENH_LECH' | 'CHI_PHI_DOANH_NGHIEP' | 'CHI_PHI_THAT_THOAT'
}

export type NvlReceiptDetail = {
  receiptId: string
  receiptCode: string
  poId: string
  poCode: string
  vendorName: string
  batchNo: number
  status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
  note: string
  createdAt: string
  movementRecorded: boolean
  settlementStatus: 'CHUA_CHOT' | 'DA_CHOT'
  settledAt: string
  totalBilledQty: number
  totalAmount: number
  lines: NvlReceiptDetailLine[]
}

export type NvlProcurementFlowPageData = {
  proposalMode: NvlProposalSourceMode
  stockTruthReady: boolean
  purchaseRequestSchemaReady: boolean
  purchaseOrderSchemaReady: boolean
  receiptSchemaReady: boolean
  materialCatalogOptions: NvlMaterialCatalogOption[]
  vendorOptions: Array<{
    value: string
    label: string
  }>
  demandSummaryCards: NvlProcurementStageCard[]
  demandRows: NvlDemandDecisionRow[]
  demandSourcePlans: NvlDemandSourcePlanView[]
  stageCards: NvlProcurementStageCard[]
  proposalRows: NvlProposalRow[]
  savedRequestRows: NvlPurchaseRequestSummaryRow[]
  savedPurchaseOrderRows: NvlPurchaseOrderSummaryRow[]
  savedReceiptRows: NvlReceiptSummaryRow[]
  purchaseOrderRows: NvlPurchaseOrderRow[]
  receiptRows: NvlReceiptRow[]
}

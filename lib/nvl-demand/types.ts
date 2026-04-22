export type NvlDemandStatus = 'COVERED' | 'SHORTAGE' | 'SURPLUS' | 'RISK'

export type NvlDemandSummaryCard = {
  label: string
  value: string
  helpText: string
}

export type NvlDemandCockpitRow = {
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
  status: NvlDemandStatus
  hasOverrunRisk: boolean
  overrunPlanCount: number
  recommendation: string
  explanation: string
}

export type NvlDemandSourcePlanRow = {
  materialCode: string
  materialName: string
  unit: string
  demandQty: number
}

export type NvlDemandSourcePlanLineDebug = {
  lineId: string
  tenDoan: string
  plannedQty: number
  segmentQtyBase: number
  positiveMaterialCount: number
  concretePerUnit: number
  pcPerUnit: number
  daiPerUnit: number
  buocPerUnit: number
}

export type NvlDemandSourcePlan = {
  planId: string
  ngayKeHoach: string
  plannedQtyTotal: number
  lineCount: number
  hasOverrunRisk: boolean
  overrunLineCount: number
  materialRows: NvlDemandSourcePlanRow[]
  lineDebugs: NvlDemandSourcePlanLineDebug[]
}

export type NvlDemandCockpitPageData = {
  mode: 'LIVE_DEMAND_ONLY' | 'FULL'
  stockTruthReady: boolean
  summaryCards: NvlDemandSummaryCard[]
  rows: NvlDemandCockpitRow[]
  sourcePlans: NvlDemandSourcePlan[]
}

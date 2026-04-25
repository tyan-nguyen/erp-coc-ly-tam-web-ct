export type ProductionVarianceMaterialRow = {
  key: string
  label: string
  group: string
  unit: string
  estimatedQty: number
  actualQty: number
  varianceQty: number
  variancePct: number | null
}

export type ProductionVarianceReportRow = {
  planId: string
  date: string
  status: string
  lineCount: number
  plannedQty: number
  warehouseActualQty: number
  qcAcceptedQty: number | null
  defectQty: number | null
  defectPct: number | null
  materialEstimatedQty: number
  materialActualQty: number
  materialVarianceQty: number
  materialVariancePct: number | null
  materialRows: ProductionVarianceMaterialRow[]
}

export type ProductionVarianceReportSummary = {
  planCount: number
  plannedQty: number
  warehouseActualQty: number
  qcAcceptedQty: number
  defectQty: number
  materialEstimatedQty: number
  materialActualQty: number
  materialVarianceQty: number
  materialVariancePct: number | null
}

export type ProductionVarianceReportPageData = {
  filters: {
    fromDate: string
    toDate: string
  }
  rows: ProductionVarianceReportRow[]
  summary: ProductionVarianceReportSummary
}

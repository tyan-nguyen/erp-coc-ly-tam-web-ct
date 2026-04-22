export type NvlStockTruthSummaryCard = {
  label: string
  value: string
  helpText: string
}

export type NvlStockTruthRow = {
  materialCode: string
  materialName: string
  unit: string
  stockQty: number
  availableQty: number
  blockedQty: number
  defectiveQty: number
  lastMovementDate: string
}

export type NvlStockMovementHistoryRow = {
  movementId: string
  movementType: string
  materialCode: string
  materialName: string
  unit: string
  quantity: number
  physicalEffect: string
  availableEffect: string
  blockedEffect: string
  qualityEffect: string
  sourceType: string
  sourceId: string
  sourceLineId: string
  movementDate: string
  warehouseLabel: string
  note: string
}

export type NvlStockTruthPageData = {
  schemaReady: boolean
  summaryCards: NvlStockTruthSummaryCard[]
  rows: NvlStockTruthRow[]
}

export type NvlStockMovementHistoryPageData = {
  schemaReady: boolean
  materialCode: string
  materialName: string
  unit: string
  summaryCards: NvlStockTruthSummaryCard[]
  rows: NvlStockMovementHistoryRow[]
}

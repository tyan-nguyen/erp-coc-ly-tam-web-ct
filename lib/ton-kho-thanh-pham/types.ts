export type FinishedGoodsInventoryScope = 'ALL' | 'PROJECT' | 'RETAIL' | 'HOLD'

export type FinishedGoodsInventoryFilters = {
  query: string
  scope: FinishedGoodsInventoryScope
  page: number
  selectedItemKey: string
  serialPage: number
}

export type FinishedGoodsInventorySummaryRow = {
  itemKey: string
  itemLabel: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  physicalQty: number
  projectQty: number
  retailQty: number
  holdQty: number
  lotCount: number
  latestProductionDate: string
  legacyShipmentGapQty: number
}

export type FinishedGoodsInventorySerialRow = {
  serialId: string
  serialCode: string
  lotCode: string
  productionDate: string
  lifecycleStatus: string
  dispositionStatus: string
  visibilityLabel: string
  locationLabel: string
  note: string
}

export type FinishedGoodsInventoryItemDetail = {
  itemKey: string
  itemLabel: string
  physicalQty: number
  projectQty: number
  retailQty: number
  holdQty: number
  lotCount: number
  legacyShipmentGapQty: number
  serialRows: FinishedGoodsInventorySerialRow[]
  totalSerialCount: number
  serialPage: number
  serialPageCount: number
}

export type FinishedGoodsInventoryPageData = {
  schemaReady: boolean
  filters: FinishedGoodsInventoryFilters
  summaryRows: FinishedGoodsInventorySummaryRow[]
  summaryTotalCount: number
  summaryPageCount: number
  selectedItemDetail: FinishedGoodsInventoryItemDetail | null
  prefetchedItemDetails: Record<string, FinishedGoodsInventoryItemDetail>
}

export type InventoryCountType = 'OPENING_BALANCE' | 'OPERATIONAL'
export type InventoryCountScopeType =
  | 'FULL_WAREHOUSE'
  | 'MATERIAL_GROUP'
  | 'SELECTED_ITEMS'
  | 'SELECTED_LOCATION'
  | 'SELECTED_PO_CONTEXT'

export type InventoryCountStatus =
  | 'NHAP'
  | 'CHO_XAC_NHAN_KHO'
  | 'CHO_DUYET_CHENH_LECH'
  | 'DA_DUYET'
  | 'DA_DIEU_CHINH_TON'
  | 'HUY'

export type InventoryCountItemType = 'NVL' | 'FINISHED_GOOD' | 'TOOL' | 'ASSET'

export type InventoryCountCostClassification =
  | 'CHI_PHI_QUAN_LY'
  | 'CHI_PHI_THAT_THOAT'
  | 'TON_TANG'
  | 'KHONG_AP_DUNG'

export type InventoryCountCatalogOption = {
  value: string
  itemType: InventoryCountItemType
  itemCode: string
  itemName: string
  itemGroup: string
  unit: string
  allowedLossPct: number
  systemQty: number
}

export type InventoryCountDraftLine = {
  id: string
  itemType: InventoryCountItemType
  itemId: string
  itemCode: string
  itemName: string
  itemGroup: string
  unit: string
  systemQty: number
  countedQty: number
  varianceQty: number
  variancePct: number
  allowedLossPct: number
  note: string
}

export type InventoryCountSheetSummaryRow = {
  countSheetId: string
  countSheetCode: string
  countType: InventoryCountType
  scopeType: InventoryCountScopeType
  countDate: string
  status: InventoryCountStatus
  note: string
  lineCount: number
  systemQtyTotal: number
  countedQtyTotal: number
  varianceQtyTotal: number
  createdAt: string
}

export type InventoryCountDetailLine = {
  countLineId: string
  lineNo: number
  itemType: InventoryCountItemType
  itemId: string
  itemCode: string
  itemName: string
  itemGroup: string
  unit: string
  systemQty: number
  countedQty: number
  varianceQty: number
  variancePct: number
  allowedLossPct: number
  costClassification: InventoryCountCostClassification | null
  note: string
}

export type InventoryCountDetail = {
  countSheetId: string
  countSheetCode: string
  countType: InventoryCountType
  scopeType: InventoryCountScopeType
  countDate: string
  status: InventoryCountStatus
  note: string
  createdAt: string
  lines: InventoryCountDetailLine[]
}

export type InventoryCountingPageData = {
  schemaReady: boolean
  summaryCards: Array<{
    label: string
    value: string
    helpText: string
  }>
  catalogOptions: InventoryCountCatalogOption[]
  savedSheets: InventoryCountSheetSummaryRow[]
}

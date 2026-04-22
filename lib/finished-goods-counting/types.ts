export type FinishedGoodsCountStatus =
  | 'NHAP'
  | 'CHO_XAC_NHAN_KHO'
  | 'CHO_DUYET_CHENH_LECH'
  | 'DA_DUYET'
  | 'DA_DIEU_CHINH_TON'
  | 'HUY'

export type FinishedGoodsCountMode = 'VAN_HANH' | 'TON_DAU_KY'

export type FinishedGoodsCountQualityProposal = 'DAT' | 'LOI' | 'HUY'

export type FinishedGoodsCountCatalogOption = {
  itemKey: string
  itemLabel: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  systemQty: number
  projectQty: number
  retailQty: number
  holdQty: number
}

export type FinishedGoodsCountDraftLine = {
  id: string
  itemKey: string
  itemLabel: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  systemQty: number
  note: string
  openingQty?: number
  qualityStatus?: 'DAT' | 'LOI'
  locationId?: string
}

export type FinishedGoodsCountSheetSummaryRow = {
  countSheetId: string
  countSheetCode: string
  countMode: FinishedGoodsCountMode
  countDate: string
  status: FinishedGoodsCountStatus
  note: string
  lineCount: number
  systemQtyTotal: number
  countedQtyTotal: number
  varianceQtyTotal: number
  createdAt: string
}

export type FinishedGoodsCountDetailSerialRow = {
  countSerialId: string
  serialId: string | null
  serialCode: string
  countStatus: 'COUNTED' | 'MISSING_IN_COUNT' | 'UNEXPECTED_FOUND' | 'WRONG_LOCATION'
  qualityProposal: FinishedGoodsCountQualityProposal
  systemLocationId: string
  countedLocationId: string
  note: string
  systemVisibilityLabel: string
  generatedFromCount: boolean
  generatedLotId: string
  generatedLotCode: string
}

export type FinishedGoodsCountDetailLine = {
  countLineId: string
  lineNo: number
  itemKey: string
  itemLabel: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  systemQty: number
  countedQty: number
  varianceQty: number
  note: string
  unexpectedFoundDatQty: number
  unexpectedFoundLoiQty: number
  qualityStatus: 'DAT' | 'LOI' | ''
  locationId: string
  serialRows: FinishedGoodsCountDetailSerialRow[]
  generatedLots: Array<{
    lotId: string
    lotCode: string
    qualityProposal: Exclude<FinishedGoodsCountQualityProposal, 'HUY'>
    serialCount: number
  }>
  printableLots: Array<{
    lotId: string
    lotCode: string
    serialCount: number
  }>
}

export type FinishedGoodsCountDetail = {
  countSheetId: string
  countSheetCode: string
  countMode: FinishedGoodsCountMode
  countDate: string
  status: FinishedGoodsCountStatus
  note: string
  createdAt: string
  lines: FinishedGoodsCountDetailLine[]
}

export type FinishedGoodsCountingPageData = {
  schemaReady: boolean
  summaryCards: Array<{
    label: string
    value: string
    helpText: string
  }>
  catalogOptions: FinishedGoodsCountCatalogOption[]
  savedSheets: FinishedGoodsCountSheetSummaryRow[]
}

export type FinishedGoodsCountDraftCreateResult = {
  countSheetId: string
  countSheetCode: string
  lineCount: number
  serialCount: number
}

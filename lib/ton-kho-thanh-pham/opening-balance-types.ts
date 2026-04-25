export type FinishedGoodsOpeningBalanceQuality = 'DAT' | 'LOI'

export type FinishedGoodsOpeningBalanceLocationOption = {
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
}

export type FinishedGoodsOpeningBalanceLoaiCocOption = {
  value: string
  label: string
  templateId: string
  maCoc: string
  loaiCoc: string
}

export type FinishedGoodsOpeningBalanceLotRow = {
  lotId: string
  lotCode: string
  countSheetId: string
  countSheetCode: string
  countSheetStatus: string
  openingDate: string
  templateId: string
  maCoc: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  quantity: number
  qualityStatus: FinishedGoodsOpeningBalanceQuality
  locationLabel: string
  note: string
  serialCount: number
  createdAt: string
}

export type FinishedGoodsOpeningBalancePageData = {
  schemaReady: boolean
  loaiCocOptions: FinishedGoodsOpeningBalanceLoaiCocOption[]
  locations: FinishedGoodsOpeningBalanceLocationOption[]
  recentLots: FinishedGoodsOpeningBalanceLotRow[]
}

export type FinishedGoodsOpeningBalanceCreateResult = {
  lotId: string
  lotCode: string
  generatedSerialCount: number
}

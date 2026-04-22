export type ExternalPileRequestStatus = 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'DA_CHUYEN_DAT_HANG' | 'TU_CHOI'

export type ExternalPileOrderStatus = 'DRAFT' | 'DA_GUI_NCC' | 'DA_NHAN_MOT_PHAN' | 'DA_NHAN_DU' | 'HUY'

export type ExternalPileLineDraft = {
  rowId: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  soLuong: number
  ghiChu: string
}

export type ExternalPileRequestLine = {
  requestLineId: string
  lineNo: number
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  soLuongDeXuat: number
  ghiChu: string
  itemLabel: string
}

export type ExternalPileRequestSummary = {
  requestId: string
  requestCode: string
  status: ExternalPileRequestStatus
  note: string
  createdAt: string
  totalQty: number
  lineCount: number
  lines: ExternalPileRequestLine[]
}

export type ExternalPileOrderLine = {
  poLineId: string
  requestLineId: string
  lineNo: number
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  orderedQty: number
  receivedQty: number
  remainingQty: number
  ghiChu: string
  itemLabel: string
}

export type ExternalPileOrderSummary = {
  poId: string
  poCode: string
  requestId: string
  requestCode: string
  vendorId: string
  vendorName: string
  expectedDate: string
  note: string
  status: ExternalPileOrderStatus
  createdAt: string
  totalOrderedQty: number
  totalReceivedQty: number
  lineCount: number
  lines: ExternalPileOrderLine[]
}

export type ExternalPileCatalogOption = {
  value: string
  label: string
}

export type ExternalPileVendorOption = {
  value: string
  label: string
}

export type ExternalPileProcurementPageData = {
  schemaReady: boolean
  loaiCocOptions: ExternalPileCatalogOption[]
  vendorOptions: ExternalPileVendorOption[]
  requestRows: ExternalPileRequestSummary[]
  orderRows: ExternalPileOrderSummary[]
}

export type ExternalPileOrderDetail = {
  order: ExternalPileOrderSummary
  receivedBatches: Array<{
    receivedAt: string
    receivedDate: string
    note: string
    totalReceivedQty: number
    items: Array<{
      poLineId: string
      itemLabel: string
      receiveQty: number
      lotId: string
      lotCode: string
    }>
  }>
  printableLots: Array<{
    lotId: string
    lotCode: string
    serialCount: number
  }>
}

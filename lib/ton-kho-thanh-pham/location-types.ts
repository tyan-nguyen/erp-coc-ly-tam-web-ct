export type WarehouseLocationFilters = {
  query: string
  page: number
  selectedLocationId: string
  serialPage: number
  quality: 'ALL' | 'DAT' | 'LOI'
}

export type WarehouseLocationSummaryRow = {
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
  totalQty: number
  acceptedQty: number
  defectQty: number
  itemCount: number
}

export type WarehouseLocationOption = {
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
}

export type WarehouseLocationSerialRow = {
  serialId: string
  serialCode: string
  itemLabel: string
  lotCode: string
  productionDate: string
  qualityLabel: 'Đạt' | 'Lỗi'
  note: string
}

export type WarehouseLocationDetail = {
  locationId: string
  locationLabel: string
  totalQty: number
  acceptedQty: number
  defectQty: number
  serialRows: WarehouseLocationSerialRow[]
  totalSerialCount: number
  serialPage: number
  serialPageCount: number
}

export type WarehouseLocationPageData = {
  schemaReady: boolean
  filters: WarehouseLocationFilters
  locations: WarehouseLocationOption[]
  summaryRows: WarehouseLocationSummaryRow[]
  summaryTotalCount: number
  summaryPageCount: number
  selectedLocationDetail: WarehouseLocationDetail | null
}

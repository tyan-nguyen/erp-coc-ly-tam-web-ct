type WarehouseInternalSerialTemplateDetail = {
  templateId: string
  maCoc: string
  cuongDo: string
  macThep: string
  doNgoai: number
  chieuDay: number
  macBeTong: string
  khoiLuongKgMd: number | null
  steelLabels: {
    pc: string
    dai: string
    buoc: string
  }
  pcNos: number | null
  donKepFactor: number | null
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  accessoryLabels: {
    matBich: string
    mangXong: string
    muiCoc: string
    tap: string
  }
  techPreview: {
    ra_l: number
    ra_s: number
    mcr: number
  }
}

export type WarehouseInternalSerialLocationActionMode = 'ASSIGN' | 'TRANSFER' | 'NONE'

export type WarehouseInternalSerialLookupData = {
  serialId: string
  serialCode: string
  itemKey: string
  itemLabel: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  lotCode: string
  productionDate: string
  qcStatus: string
  qcLabel: string
  lifecycleStatus: string
  lifecycleLabel: string
  dispositionStatus: string
  visibilityLabel: string
  note: string
  inCurrentInventory: boolean
  currentLocationId: string
  currentLocationLabel: string
  physicalQty: number
  projectQty: number
  retailQty: number
  holdQty: number
  currentItemSerialCount: number
  locationActionMode: WarehouseInternalSerialLocationActionMode
  templateDetail: WarehouseInternalSerialTemplateDetail | null
}

import type { ProductionLotSummary } from '@/lib/pile-serial/repository'

export type KeHoachNgayRow = {
  plan_id: string
  ngay_ke_hoach: string
  trang_thai: 'NHAP' | 'DA_CHOT'
  ghi_chu: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type KeHoachLineRow = {
  line_id: string
  plan_id: string
  order_id: string
  boc_id: string | null
  ma_boc_tach_hien_thi?: string | null
  quote_id: string | null
  ma_order: string | null
  ma_bao_gia: string | null
  khach_hang: string | null
  du_an: string | null
  loai_coc: string | null
  doan_key: string
  ten_doan: string
  chieu_dai_m: number
  so_luong_dat: number
  so_luong_da_san_xuat: number
  so_luong_da_len_ke_hoach: number
  so_luong_con_lai_tam: number
  so_luong_ke_hoach: number
  thu_tu: number
  ghi_chu: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type KeHoachNgayListItem = {
  plan: KeHoachNgayRow
  lineCount: number
  orderCount: number
  totalPlannedQty: number
}

export type AvailableSegmentOption = {
  orderId: string
  bocId: string | null
  maBocTachHienThi?: string | null
  quoteId: string | null
  maOrder: string
  maBaoGia: string | null
  khachHang: string
  duAn: string
  loaiCoc: string
  doanKey: string
  tenDoan: string
  chieuDaiM: number
  soLuongDat: number
  soLuongDaSanXuat: number
  soLuongDaLenKeHoach: number
  soLuongDaQc: number
  tonKho: number
  soLuongConLaiTam: number
}

export type KeHoachNgayDetail = {
  plan: KeHoachNgayRow
  lines: KeHoachLineRow[]
  availableSegments: AvailableSegmentOption[]
  warehouseIssue: WarehouseIssueDraft | null
  generatedLots: ProductionLotSummary[]
}

export type KeHoachScheduleCell = {
  ngay: string
  qty: number
  md: number
}

export type KeHoachScheduleRow = {
  rowKey: string
  khachHang: string
  duAn: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  cells: KeHoachScheduleCell[]
}

export type KeHoachScheduleSummary = {
  fromDate: string
  toDate: string
  dates: string[]
  rows: KeHoachScheduleRow[]
  totalQtyByDate: number[]
  totalMdByDate: number[]
}

export type WarehouseIssueMaterialDraft = {
  key: string
  nhom: 'THEP' | 'PHU_KIEN' | 'PHU_GIA' | 'BETONG'
  label: string
  dvt: string
  ratePerUnit: number
  estimateQty: number
  actualQty: number
}

export type WarehouseConcreteRecipeMaterialDraft = {
  key: string
  label: string
  dvt: string
  ratePerM3: number
}

export type WarehouseConcreteVariantOption = {
  value: string
  label: string
}

export type WarehouseConcreteVariantRecipe = {
  variant: string
  label: string
  materials: WarehouseConcreteRecipeMaterialDraft[]
}

export type WarehouseConcreteGradeSummary = {
  concreteGrade: string
  requiredM3: number
  variantOptions: WarehouseConcreteVariantOption[]
  variantRecipes: WarehouseConcreteVariantRecipe[]
  allocations: WarehouseConcreteAllocationDraft[]
}

export type WarehouseIssueMaterialSummary = {
  key: string
  nhom: 'THEP' | 'PHU_KIEN' | 'PHU_GIA' | 'BETONG'
  label: string
  dvt: string
  estimateQty: number
  actualQty: number
}

export type WarehouseConcreteAllocationDraft = {
  variant: string
  volumeM3: number
}

export type WarehouseIssueLineDraft = {
  lineId: string
  actualProductionQty: number
  concreteGrade: string
  concreteRequiredM3: number
  concreteRequiredM3PerUnit: number
  variantOptions: WarehouseConcreteVariantOption[]
  variantRecipes: WarehouseConcreteVariantRecipe[]
  allocations: WarehouseConcreteAllocationDraft[]
  materials: WarehouseIssueMaterialDraft[]
}

export type WarehouseIssueDraft = {
  voucherId: string | null
  locked: boolean
  operationDate: string
  note: string
  lineDrafts: WarehouseIssueLineDraft[]
  concreteSummaries: WarehouseConcreteGradeSummary[]
  materialSummaries: WarehouseIssueMaterialSummary[]
}

export type QcIssueLineResult = {
  lineId: string
  actualQty: number
  acceptedQty: number
  rejectedQty: number
  note: string
}

export type QcSerialResult = {
  serialId: string
  lineId: string
  serialCode: string
  qcStatus: 'CHUA_QC' | 'DAT' | 'LOI'
  dispositionStatus: 'BINH_THUONG' | 'THANH_LY' | 'HUY'
  note: string
}

export type QcIssueDraft = {
  voucherId: string | null
  locked: boolean
  operationDate: string
  note: string
  lineResults: QcIssueLineResult[]
  serialResults: QcSerialResult[]
}

export type QcPlanListItem = KeHoachNgayListItem & {
  qcConfirmed: boolean
}

export type QcNghiemThuDetail = {
  plan: KeHoachNgayRow
  lines: KeHoachLineRow[]
  qcIssue: QcIssueDraft | null
}

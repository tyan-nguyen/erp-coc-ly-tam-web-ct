export type LegacyReconciliationTargetType = 'SHIPMENT_VOUCHER' | 'SHIPMENT_LINE' | 'RETURN_VOUCHER' | 'ITEM_KEY'

export type LegacyReconciliationDirection = 'OUT' | 'IN'

export type LegacyReconciliationMethod = 'SELECT' | 'SCAN' | 'PASTE' | 'IMAGE'

export type LegacyReconciliationTarget = {
  targetType: LegacyReconciliationTargetType
  targetId: string
  itemKey?: string | null
  voucherId?: string | null
  voucherLineId?: string | null
}

export type LegacyReconciliationGap = {
  itemKey: string
  itemLabel: string
  unresolvedQty: number
  direction: LegacyReconciliationDirection
}

export type LegacyReconciliationSerialAssignment = {
  serialId: string
  serialCode: string
  method: LegacyReconciliationMethod
}

export type LegacyReconciliationDraft = {
  target: LegacyReconciliationTarget
  direction: LegacyReconciliationDirection
  gaps: LegacyReconciliationGap[]
  assignments: LegacyReconciliationSerialAssignment[]
  note?: string
}

export type LegacyReconciliationResult = {
  target: LegacyReconciliationTarget
  direction: LegacyReconciliationDirection
  assignedQty: number
  remainingQty: number
  assignments: LegacyReconciliationSerialAssignment[]
  note?: string
}

export type LegacyReconciliationListFilters = {
  query: string
  page: number
}

export type LegacyReconciliationCandidateLine = {
  lineId: string
  itemKey: string
  itemLabel: string
  actualQty: number
  assignedQty: number
  returnedQty: number
  unresolvedQty: number
  orderSourceKey: string | null
  stockSourceKey: string | null
}

export type LegacyReconciliationCandidateVoucher = {
  voucherId: string
  maPhieu: string
  status: string
  sourceType: 'DON_HANG' | 'TON_KHO'
  customerName: string | null
  projectName: string | null
  orderLabel: string | null
  quoteLabel: string | null
  createdAt: string
  unresolvedQtyTotal: number
  lineCount: number
  lines: LegacyReconciliationCandidateLine[]
}

export type LegacyReconciliationPageData = {
  filters: LegacyReconciliationListFilters
  rows: LegacyReconciliationCandidateVoucher[]
  totalCount: number
  pageCount: number
}

export type LegacyReconciliationDetailSerialCandidate = {
  serialId: string
  serialCode: string
  lotCode: string
  productionDate: string
  locationLabel: string
  visibilityLabel: string
  lifecycleStatus: string
  dispositionStatus: string
}

export type LegacyReconciliationDetailItem = LegacyReconciliationCandidateLine & {
  serialCandidates: LegacyReconciliationDetailSerialCandidate[]
}

export type LegacyReconciliationDetailPageData = {
  voucherId: string
  maPhieu: string
  status: string
  sourceType: 'DON_HANG' | 'TON_KHO'
  customerName: string | null
  projectName: string | null
  orderLabel: string | null
  quoteLabel: string | null
  createdAt: string
  unresolvedQtyTotal: number
  items: LegacyReconciliationDetailItem[]
}

export type LegacyReconciliationAssignmentBody = {
  note?: string
  assignments?: Array<{
    lineId?: string
    itemKey?: string
    serialId?: string
  }>
}

export type LegacyReconciliationAssignmentResult = {
  voucherId: string
  assignedQty: number
  remainingQty: number
  affectedItems: Array<{
    lineId: string
    itemKey: string
    assignedQty: number
    remainingQty: number
  }>
}

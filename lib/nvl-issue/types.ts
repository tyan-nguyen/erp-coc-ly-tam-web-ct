export type MaterialIssueKind = 'BAN_VAT_TU' | 'DIEU_CHUYEN'
export type MaterialIssueStatus = 'CHO_XAC_NHAN' | 'DA_XUAT' | 'XUAT_MOT_PHAN' | 'HUY'

export type MaterialIssueCustomerOption = {
  khId: string
  tenKh: string
}

export type MaterialIssueProjectOption = {
  daId: string
  tenDa: string
  khId: string
}

export type MaterialIssueMaterialOption = {
  materialCode: string
  materialName: string
  unit: string
  availableQty: number
  displayCode?: string
}

export type MaterialIssueVoucherLine = {
  voucherLineId: string
  lineNo: number
  materialCode: string
  displayCode?: string
  materialName: string
  unit: string
  requestedQty: number
  actualQty: number
  unitPrice: number
  lineTotal: number
  note: string
  availableQtySnapshot: number
}

export type MaterialIssueVoucherSummary = {
  voucherId: string
  voucherCode: string
  issueKind: MaterialIssueKind
  status: MaterialIssueStatus
  customerName: string
  projectName: string
  requestedQtyTotal: number
  actualQtyTotal: number
  totalAmount: number
  operationDate: string
  createdAt: string
}

export type MaterialIssueVoucherDetail = MaterialIssueVoucherSummary & {
  khId: string
  daId: string
  note: string
  lines: MaterialIssueVoucherLine[]
}

export type MaterialIssuePageData = {
  schemaReady: boolean
  customers: MaterialIssueCustomerOption[]
  projects: MaterialIssueProjectOption[]
  materialOptions: MaterialIssueMaterialOption[]
  vouchers: MaterialIssueVoucherSummary[]
}

export type MaterialIssueCreateBootstrap = {
  customers: MaterialIssueCustomerOption[]
  projects: MaterialIssueProjectOption[]
  materialOptions: MaterialIssueMaterialOption[]
}

export type MaterialIssueLineDraft = {
  rowId: string
  materialCode: string
  requestedQty: number
  unitPrice: number
  note: string
}

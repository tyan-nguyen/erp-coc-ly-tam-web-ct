import {
  confirmXuatHangVoucher,
  createXuatHangVoucher,
  deleteXuatHangVouchers,
  loadXuatHangVoucherDetail,
  resolveShipmentSerialScan,
  returnShipmentVoucherSerials,
  saveShipmentReturnRequest,
  type XuatHangSourceMode,
} from '@/lib/xuat-hang/repository'

type AnySupabase = Parameters<typeof createXuatHangVoucher>[0]

export type CreateXuatHangVoucherBody = {
  mode?: XuatHangSourceMode
  customerId?: string
  quoteId?: string
  note?: string
  lines?: Array<{
    sourceKey?: string
    requestedQty?: number
    unitPrice?: number | null
    actualSourceKey?: string
    substitutionReason?: string
  }>
}

export type ConfirmXuatHangVoucherBody = {
  note?: string
  lines?: Array<{ lineId?: string; actualQty?: number }>
  serialAssignments?: Array<{ lineId?: string; serialId?: string; serialCode?: string }>
}

export type ShipmentScanBody = {
  code?: string
}

export type ShipmentReturnRequestBody = {
  note?: string
  totalRequestedQty?: number
  lines?: Array<{
    lineId?: string
    requestedQty?: number
  }>
}

export type ShipmentReturnBody = {
  note?: string
  items?: Array<{
    serialId?: string
    resolutionStatus?: 'NHAP_DU_AN' | 'NHAP_KHACH_LE' | 'HUY'
    note?: string
  }>
}

export type DeleteXuatHangVoucherBody = {
  voucherIds?: string[]
}

export async function executeCreateXuatHangVoucherMutation(input: {
  supabase: AnySupabase
  userId: string
  userRole: string
  body: CreateXuatHangVoucherBody
}) {
  return createXuatHangVoucher(input.supabase, {
    userId: input.userId,
    userRole: input.userRole,
    mode: input.body.mode === 'TON_KHO' ? 'TON_KHO' : 'DON_HANG',
    customerId: input.body.customerId,
    quoteId: input.body.quoteId,
    note: input.body.note,
        lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((item) => ({
          sourceKey: String(item.sourceKey || ''),
          requestedQty: Number(item.requestedQty || 0),
          unitPrice: item.unitPrice == null ? null : Number(item.unitPrice || 0),
          actualSourceKey: String(item.actualSourceKey || ''),
          substitutionReason: String(item.substitutionReason || ''),
        }))
      : [],
  })
}

export async function executeLoadXuatHangVoucherDetail(input: {
  supabase: AnySupabase
  voucherId: string
  viewerRole: string
}) {
  return loadXuatHangVoucherDetail(input.supabase, input.voucherId, input.viewerRole)
}

export async function executeConfirmXuatHangVoucherMutation(input: {
  supabase: AnySupabase
  voucherId: string
  userId: string
  userRole: string
  body: ConfirmXuatHangVoucherBody
}) {
  return confirmXuatHangVoucher(input.supabase, {
    voucherId: input.voucherId,
    userId: input.userId,
    userRole: input.userRole,
    note: input.body.note,
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((item) => ({
          lineId: String(item.lineId || ''),
          actualQty: Number(item.actualQty || 0),
        }))
      : [],
    serialAssignments: Array.isArray(input.body.serialAssignments)
      ? input.body.serialAssignments.map((item) => ({
          lineId: String(item.lineId || ''),
          serialId: String(item.serialId || ''),
          serialCode: String(item.serialCode || ''),
        }))
      : [],
  })
}

export async function executeShipmentScanMutation(input: {
  supabase: AnySupabase
  voucherId: string
  userRole: string
  body: ShipmentScanBody
}) {
  return resolveShipmentSerialScan(input.supabase, {
    voucherId: input.voucherId,
    userRole: input.userRole,
    code: String(input.body.code || ''),
  })
}

export async function executeShipmentReturnRequestMutation(input: {
  supabase: AnySupabase
  voucherId: string
  userId: string
  userRole: string
  body: ShipmentReturnRequestBody
}) {
  return saveShipmentReturnRequest(input.supabase, {
    voucherId: input.voucherId,
    userId: input.userId,
    userRole: input.userRole,
    note: input.body.note,
    totalRequestedQty: Number(input.body.totalRequestedQty || 0),
    lines: Array.isArray(input.body.lines) ? input.body.lines : [],
  })
}

export async function executeShipmentReturnMutation(input: {
  supabase: AnySupabase
  voucherId: string
  userId: string
  userRole: string
  body: ShipmentReturnBody
}) {
  return returnShipmentVoucherSerials(input.supabase, {
    voucherId: input.voucherId,
    userId: input.userId,
    userRole: input.userRole,
    note: input.body.note,
    items: Array.isArray(input.body.items) ? input.body.items : [],
  })
}

export async function executeDeleteXuatHangVoucherMutation(input: {
  supabase: AnySupabase
  userId: string
  userRole: string
  body: DeleteXuatHangVoucherBody
}) {
  return deleteXuatHangVouchers(input.supabase, {
    userId: input.userId,
    userRole: input.userRole,
    voucherIds: Array.isArray(input.body.voucherIds) ? input.body.voucherIds : [],
  })
}

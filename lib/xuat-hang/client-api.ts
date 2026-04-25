import type {
  ShipmentReturnRequestResult,
  ShipmentReturnResult,
  ShipmentSerialScanResult,
  XuatHangCreateBootstrap,
  XuatHangSourceMode,
  XuatHangVoucherDetail,
} from '@/lib/xuat-hang/repository'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readXuatHangEnvelope<T>(response: Response, fallbackMessage: string) {
  const data = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallbackMessage)
  }
  return data
}

export async function fetchXuatHangVoucherDetail(voucherId: string) {
  const response = await fetch(`/api/xuat-hang/${voucherId}`, {
    cache: 'no-store',
  })
  return readXuatHangEnvelope<XuatHangVoucherDetail | null>(response, 'Không tải được chi tiết phiếu xuất hàng.')
}

export async function fetchXuatHangCreateBootstrap(mode?: XuatHangSourceMode, init?: { signal?: AbortSignal }) {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : ''
  const response = await fetch(`/api/xuat-hang${query}`, {
    signal: init?.signal,
    cache: 'no-store',
  })
  return readXuatHangEnvelope<XuatHangCreateBootstrap>(response, 'Không tải được dữ liệu lập phiếu xuất hàng.')
}

export async function submitShipmentSerialScan(input: { voucherId: string; code: string }) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: input.code }),
  })

  return readXuatHangEnvelope<ShipmentSerialScanResult>(response, 'Không nhận diện được serial xuất hàng.')
}

export async function submitCreateXuatHangVoucher(input: {
  mode: XuatHangSourceMode
  customerId?: string
  quoteId?: string
  note: string
  lines: Array<{
    sourceKey: string
    requestedQty: number
    unitPrice?: number | null
    actualSourceKey?: string
    substitutionReason?: string
  }>
}) {
  const response = await fetch('/api/xuat-hang', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readXuatHangEnvelope<{ voucherId: string }>(response, 'Không tạo được phiếu xuất hàng.')
}

export async function submitConfirmXuatHangVoucher(input: {
  voucherId: string
  note: string
  lines: Array<{ lineId: string; actualQty: number }>
  serialAssignments: Array<{ lineId: string; serialId: string; serialCode: string }>
}) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readXuatHangEnvelope<unknown>(response, 'Không xác nhận được phiếu xuất hàng.')
}

export async function submitShipmentReturnRequest(input: {
  voucherId: string
  note: string
  totalRequestedQty: number
  lines?: Array<{ lineId: string; requestedQty: number }>
}) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/return-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: input.note,
      totalRequestedQty: input.totalRequestedQty,
      lines: input.lines || [],
    }),
  })

  return readXuatHangEnvelope<ShipmentReturnRequestResult>(response, 'Không tạo được đề nghị trả hàng.')
}

export async function submitReopenShipmentReturnRequest(input: { voucherId: string }) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/return-request/reopen`, {
    method: 'POST',
  })

  return readXuatHangEnvelope<ShipmentReturnRequestResult>(response, 'Không mở lại được đề nghị trả hàng.')
}

export async function submitShipmentReturn(input: {
  voucherId: string
  note: string
  items: Array<{
    serialId: string
    resolutionStatus: 'NHAP_DU_AN' | 'NHAP_KHACH_LE' | 'HUY'
    note: string
  }>
}) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: input.note,
      items: input.items,
    }),
  })

  return readXuatHangEnvelope<ShipmentReturnResult>(response, 'Không xử lý được trả lại sau giao.')
}

export async function submitReopenConfirmedShipment(input: { voucherId: string }) {
  const response = await fetch(`/api/xuat-hang/${input.voucherId}/reopen`, {
    method: 'POST',
  })

  return readXuatHangEnvelope<{ status: string }>(response, 'Không mở lại được phiếu xuất hàng.')
}

export async function submitDeleteXuatHangVouchers(input: { voucherIds: string[] }) {
  const response = await fetch('/api/xuat-hang', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readXuatHangEnvelope<{ deletedCount: number }>(response, 'Không xóa được phiếu xuất hàng.')
}

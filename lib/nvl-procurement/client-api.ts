import type { CreatePurchaseRequestDraftBody } from '@/lib/nvl-procurement/mutations'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function parseEnvelopeSafely<T>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      throw new Error(text || fallbackMessage)
    }
    throw new Error(fallbackMessage)
  }

  const result = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !result.ok) {
    throw new Error(result.error || fallbackMessage)
  }
  return result
}

async function requestNvlProcurement<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string) {
  try {
    const response = await fetch(input, init)
    return await parseEnvelopeSafely<T>(response, fallbackMessage)
  } catch (error) {
    if (error instanceof Error) {
      const message = String(error.message || '').trim()
      if (message === 'Failed to fetch') {
        throw new Error('Không kết nối được tới API. Bạn thử tải lại trang hoặc kiểm tra dev server rồi thao tác lại giúp mình.')
      }
      throw error
    }
    throw new Error(fallbackMessage)
  }
}

export type PurchaseRequestDraftResult = {
  requestId: string
  requestCode: string
  lineCount: number
}

export type PurchaseOrderDraftResult = {
  poId: string
  poCode: string
  lineCount: number
}

export type FinishPurchaseOrderResult = {
  poId: string
  poCode: string
  status: string
}

export type FinalizePurchaseOrderResult = {
  poId: string
  poCode: string
  vendorName: string
  status: string
}

export type ReceiptDraftResult = {
  receiptId: string
  receiptCode: string
  lineCount: number
  batchNo: number
}

export type ConfirmReceiptMovementResult = {
  receiptId: string
  receiptCode: string
  movementCount: number
  status: string
}

export type FinalizeReceiptResult = {
  receiptId: string
  receiptCode: string
  poId: string
  poCode: string
  totalBilledQty: number
  totalAmount: number
  settlementStatus: 'CHUA_CHOT' | 'DA_CHOT'
  settledAt: string
}

export type NvlReceiptDetailResult = {
  receiptId: string
  receiptCode: string
  poId: string
  poCode: string
  vendorName: string
  batchNo: number
  status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
  note: string
  createdAt: string
  movementRecorded: boolean
  settlementStatus: 'CHUA_CHOT' | 'DA_CHOT'
  settledAt: string
  totalBilledQty: number
  totalAmount: number
  lines: Array<{
    receiptLineId: string
    lineNo: number
    materialCode: string
    materialName: string
    unit: string
    orderedQty: number
    receivedQty: number
    acceptedQty: number
    defectiveQty: number
    rejectedQty: number
    status: 'DRAFT' | 'DA_NHAN' | 'DA_NHAN_MOT_PHAN' | 'DA_XU_LY_LOI'
    billedQty: number
    unitPrice: number
    lineAmount: number
    varianceQty: number
    variancePct: number
    varianceDisposition: 'KHONG_CHENH_LECH' | 'CHI_PHI_DOANH_NGHIEP' | 'CHI_PHI_THAT_THOAT'
  }>
}

export async function submitCreatePurchaseRequestDraft(input: CreatePurchaseRequestDraftBody) {
  return requestNvlProcurement<PurchaseRequestDraftResult>(
    '/api/nvl/purchase-request',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không lưu được draft đề xuất mua NVL.'
  )
}

export async function submitCreatePurchaseOrderDraft(input: {
  requestId?: string
  vendorName?: string
  expectedDate?: string
  note?: string
  lines?: Array<{
    requestId?: string
    requestLineId: string
    orderedQty: number
  }>
}) {
  return requestNvlProcurement<PurchaseOrderDraftResult>(
    '/api/nvl/purchase-order',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không tạo được draft PO NVL.'
  )
}

export async function submitCreateReceiptDraft(input: { poId: string }) {
  return requestNvlProcurement<ReceiptDraftResult>(
    '/api/nvl/purchase-receipt',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không tạo được draft receipt NVL.'
  )
}

export async function submitFinishPurchaseOrder(input: { poId: string }) {
  return requestNvlProcurement<FinishPurchaseOrderResult>(
    '/api/nvl/purchase-order/finish',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không kết thúc được phiếu mua NVL.'
  )
}

export async function submitFinalizePurchaseOrder(input: {
  poId: string
  vendorName?: string
  lines: Array<{
    poLineId: string
    billedQty: number
    unitPrice: number
  }>
}) {
  return requestNvlProcurement<FinalizePurchaseOrderResult>(
    '/api/nvl/purchase-order/finalize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không xác nhận cuối được phiếu mua NVL.'
  )
}

export async function submitConfirmReceiptMovement(input: { receiptId: string }) {
  return requestNvlProcurement<ConfirmReceiptMovementResult>(
    '/api/nvl/purchase-receipt/confirm',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không ghi được stock movement từ receipt NVL.'
  )
}

export async function submitFinalizeReceipt(input: {
  receiptId: string
  vendorName?: string
  lines: Array<{
    receiptLineId: string
    billedQty: number
    unitPrice: number
  }>
}) {
  return requestNvlProcurement<FinalizeReceiptResult>(
    '/api/nvl/purchase-receipt/finalize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không chốt được đợt nhận hàng NVL.'
  )
}

export async function fetchReceiptDetail(receiptId: string) {
  return requestNvlProcurement<NvlReceiptDetailResult>(
    `/api/nvl/purchase-receipt/${receiptId}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
    'Không tải được chi tiết receipt NVL.'
  )
}

export async function submitSaveReceiptDraft(input: {
  receiptId: string
  note: string
  lines: Array<{
    receiptLineId: string
    receivedQty: number
    acceptedQty: number
    defectiveQty: number
    rejectedQty: number
  }>
}) {
  return requestNvlProcurement<NvlReceiptDetailResult>(
    `/api/nvl/purchase-receipt/${input.receiptId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: input.note,
        lines: input.lines,
      }),
    },
    'Không lưu được draft receipt NVL.'
  )
}

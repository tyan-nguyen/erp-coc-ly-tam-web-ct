import type { ExternalPileLineDraft, ExternalPileOrderDetail } from '@/lib/external-pile-procurement/types'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readEnvelope<T>(response: Response, fallbackMessage: string) {
  const data = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallbackMessage)
  }
  return data
}

export async function submitCreateExternalPileRequest(input: {
  note: string
  lines: ExternalPileLineDraft[]
}) {
  const response = await fetch('/api/san-xuat/mua-coc-ngoai/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{ requestId: string; requestCode: string; lineCount: number }>(
    response,
    'Không tạo được đề xuất mua cọc ngoài.'
  )
}

export async function submitApproveExternalPileRequest(input: {
  requestId: string
  vendorId: string
  vendorName: string
  expectedDate: string
  note: string
  lines?: Array<{ requestLineId: string; orderedQty: number }>
}) {
  const response = await fetch(`/api/san-xuat/mua-coc-ngoai/request/${input.requestId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{ poId: string; poCode: string; lineCount: number }>(
    response,
    'Không duyệt được đề xuất mua cọc ngoài.'
  )
}

export async function submitReceiveExternalPileOrder(input: {
  poId: string
  receiveDate: string
  note: string
  items: Array<{ poLineId: string; receiveQty: number }>
}) {
  const response = await fetch(`/api/san-xuat/mua-coc-ngoai/order/${input.poId}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{
    poId: string
    poCode: string
    status: string
    totalReceivedQty: number
    createdLotCount: number
    createdSerialCount: number
  }>(response, 'Không nhập kho được phiếu mua cọc ngoài.')
}

export async function fetchExternalPileOrderDetail(poId: string) {
  const response = await fetch(`/api/san-xuat/mua-coc-ngoai/order/${poId}`, {
    method: 'GET',
    cache: 'no-store',
  })

  return readEnvelope<ExternalPileOrderDetail>(response, 'Không tải được chi tiết phiếu mua cọc ngoài.')
}

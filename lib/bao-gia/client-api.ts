import type { BaoGiaStatus } from '@/lib/bao-gia/repository'

export type BaoGiaStatusTransitionResult = {
  quoteId: string
  status: BaoGiaStatus
  statusLabel: string
}

export type BaoGiaProductionApprovalResult = {
  quoteId: string
  productionApproved: boolean
  productionApprovedAt: string
  productionApprovalLabel: string
}

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readBaoGiaEnvelope<T>(response: Response, fallbackMessage: string) {
  const result = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !result.ok) {
    throw new Error(result.error || fallbackMessage)
  }
  return result
}

export async function submitBaoGiaStatusTransition(input: {
  quoteId: string
  status: BaoGiaStatus
  note: string
}) {
  const response = await fetch(`/api/bao-gia/${input.quoteId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.status,
      note: input.note,
    }),
  })

  return readBaoGiaEnvelope<BaoGiaStatusTransitionResult>(response, 'Không cập nhật được trạng thái báo giá.')
}

export async function submitBaoGiaProductionApproval(input: {
  quoteId: string
  note: string
}) {
  const response = await fetch(`/api/bao-gia/${input.quoteId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'APPROVE_PRODUCTION',
      note: input.note,
    }),
  })

  return readBaoGiaEnvelope<BaoGiaProductionApprovalResult>(response, 'Không duyệt sản xuất được.')
}

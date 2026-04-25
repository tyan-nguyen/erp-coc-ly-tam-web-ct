import type { BocTachDetailPayload, BocTachReferenceData } from '@/lib/boc-tach/types'
import type { BocTachMutationAction } from '@/lib/boc-tach/mutations'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readApiEnvelope<T>(response: Response, fallbackMessage: string) {
  const data = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallbackMessage)
  }
  return data
}

export async function submitBocTachMutation(input: {
  bocId: string
  action: BocTachMutationAction
  payload: BocTachDetailPayload
}) {
  const response = await fetch(`/api/boc-tach/boc-tach-nvl/${input.bocId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: input.action,
      payload: input.payload,
    }),
  })

  return readApiEnvelope<{ headerId: string }>(response, 'Không xử lý được')
}

export async function submitBocTachBulkDelete(ids: string[]) {
  const response = await fetch('/api/boc-tach/boc-tach-nvl/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })

  return readApiEnvelope<unknown>(response, 'Không xóa được hồ sơ.')
}

export async function submitReopenBocTach(input: { bocId: string }) {
  const response = await fetch(`/api/boc-tach/boc-tach-nvl/${input.bocId}/reopen`, {
    method: 'POST',
  })

  return readApiEnvelope<{ reopenedFrom: string }>(response, 'Không mở lại được bóc tách.')
}

export async function fetchBocTachReferenceData() {
  const response = await fetch('/api/boc-tach/reference-data', {
    method: 'GET',
    cache: 'no-store',
  })

  return readApiEnvelope<BocTachReferenceData>(response, 'Không tải được dữ liệu bóc tách.')
}

import type { DonHangTimelineRow, DonHangRow } from '@/lib/don-hang/repository'

export type DonHangTransitionResult = {
  order: DonHangRow
  latestLog: DonHangTimelineRow | null
}

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readDonHangEnvelope<T>(response: Response, fallbackMessage: string) {
  const data = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallbackMessage)
  }
  return data
}

export async function submitDonHangTransition(input: {
  orderId: string
  toState: string
  note: string
}) {
  const response = await fetch(`/api/don-hang/${input.orderId}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toState: input.toState,
      note: input.note,
    }),
  })

  return readDonHangEnvelope<DonHangTransitionResult>(response, 'Không chuyển trạng thái được')
}

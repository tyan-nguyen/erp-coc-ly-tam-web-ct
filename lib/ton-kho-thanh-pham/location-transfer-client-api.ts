import type { WarehouseLocationTransferResult } from '@/lib/ton-kho-thanh-pham/location-assignment-types'

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

export async function submitWarehouseLocationTransfer(input: {
  fromLocationId: string
  toLocationId: string
  serialCodesText: string
  note: string
}) {
  const response = await fetch('/api/ton-kho/thanh-pham/vi-tri-bai/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<WarehouseLocationTransferResult>(response, 'Không điều chuyển được serial sang bãi mới.')
}

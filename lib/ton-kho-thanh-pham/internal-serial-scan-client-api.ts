import type { WarehouseInternalSerialLookupData } from '@/lib/ton-kho-thanh-pham/internal-serial-scan-types'

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

export async function lookupWarehouseInternalSerial(input: { serialCode: string }) {
  const response = await fetch('/api/ton-kho/thanh-pham/vi-tri-bai/noi-bo/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<WarehouseInternalSerialLookupData>(response, 'Không tra cứu được serial.')
}

import type { PrintableSerialLabel, SerialReprintSearchInput } from '@/lib/pile-serial/repository'

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

export async function lookupSerialLabelsForReprint(input: SerialReprintSearchInput) {
  const response = await fetch('/api/ton-kho/thanh-pham/serial-reprint/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{ candidates: PrintableSerialLabel[] }>(response, 'Không tìm được serial để in tem.')
}

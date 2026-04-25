import type {
  MaterialIssueCreateBootstrap,
  MaterialIssueLineDraft,
  MaterialIssueVoucherDetail,
} from '@/lib/nvl-issue/types'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readEnvelope<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || fallbackMessage)
  }
  return payload
}

export async function fetchMaterialIssueVoucherDetail(voucherId: string) {
  const response = await fetch(`/api/nvl-issue/voucher/${voucherId}`, {
    method: 'GET',
    cache: 'no-store',
  })

  return readEnvelope<MaterialIssueVoucherDetail>(response, 'Không tải được chi tiết phiếu xuất NVL.')
}

export async function fetchMaterialIssueCreateBootstrap() {
  const response = await fetch('/api/nvl-issue/bootstrap', {
    method: 'GET',
    cache: 'no-store',
  })

  return readEnvelope<MaterialIssueCreateBootstrap>(response, 'Không tải được dữ liệu lập phiếu xuất NVL.')
}

export async function submitCreateMaterialIssueVoucher(input: {
  issueKind: 'BAN_VAT_TU' | 'DIEU_CHUYEN'
  khId?: string
  daId?: string
  note?: string
  lines: MaterialIssueLineDraft[]
}) {
  const response = await fetch('/api/nvl-issue/voucher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{ voucherId: string; voucherCode: string; lineCount: number }>(
    response,
    'Không tạo được phiếu xuất NVL.'
  )
}

export async function submitConfirmMaterialIssueVoucher(input: {
  voucherId: string
  note?: string
  lines: Array<{ voucherLineId: string; actualQty: number }>
}) {
  const response = await fetch(`/api/nvl-issue/voucher/${input.voucherId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readEnvelope<{
    voucherId: string
    voucherCode: string
    status: string
    actualQtyTotal: number
    createdMovementCount: number
  }>(response, 'Không xác nhận được phiếu xuất NVL.')
}

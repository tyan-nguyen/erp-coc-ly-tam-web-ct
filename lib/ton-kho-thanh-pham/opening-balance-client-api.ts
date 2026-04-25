import type { FinishedGoodsOpeningBalanceCreateResult } from '@/lib/ton-kho-thanh-pham/opening-balance-types'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function requestOpeningBalance<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string) {
  try {
    const response = await fetch(input, init)
    const result = (await response.json()) as ApiEnvelope<T>
    if (!response.ok || !result.ok) {
      throw new Error(result.error || fallbackMessage)
    }
    return result
  } catch (error) {
    if (error instanceof Error && String(error.message).trim() === 'Failed to fetch') {
      throw new Error('Không kết nối được tới API tồn đầu kỳ thành phẩm. Bạn thử tải lại trang hoặc kiểm tra dev server rồi thao tác lại giúp mình.')
    }
    throw error instanceof Error ? error : new Error(fallbackMessage)
  }
}

export async function submitFinishedGoodsOpeningBalance(input: {
  openingDate: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  quantity: number
  qualityStatus: 'DAT' | 'LOI'
  locationId?: string
  note?: string
}) {
  return requestOpeningBalance<FinishedGoodsOpeningBalanceCreateResult>(
    '/api/finished-goods/opening-balance',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không tạo được lô tồn đầu kỳ thành phẩm.'
  )
}

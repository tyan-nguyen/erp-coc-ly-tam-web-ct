type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function parseEnvelopeSafely<T>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    if (!response.ok) throw new Error(text || fallbackMessage)
    throw new Error(fallbackMessage)
  }

  const result = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !result.ok) {
    throw new Error(result.error || fallbackMessage)
  }
  return result
}

async function requestFinishedGoodsCount<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string) {
  try {
    const response = await fetch(input, init)
    return await parseEnvelopeSafely<T>(response, fallbackMessage)
  } catch (error) {
    if (error instanceof Error && String(error.message || '').trim() === 'Failed to fetch') {
      throw new Error('Không kết nối được tới API kiểm kê cọc. Bạn thử tải lại trang hoặc kiểm tra dev server rồi thao tác lại giúp mình.')
    }
    throw error instanceof Error ? error : new Error(fallbackMessage)
  }
}

export type FinishedGoodsCountDetailResult = {
  countSheetId: string
  countSheetCode: string
  countMode: 'VAN_HANH' | 'TON_DAU_KY'
  countDate: string
  status: 'NHAP' | 'CHO_XAC_NHAN_KHO' | 'CHO_DUYET_CHENH_LECH' | 'DA_DUYET' | 'DA_DIEU_CHINH_TON' | 'HUY'
  note: string
  createdAt: string
  lines: Array<{
    countLineId: string
    lineNo: number
    itemKey: string
    itemLabel: string
    templateId?: string
    maCoc?: string
    loaiCoc: string
    tenDoan: string
    chieuDaiM: number
    systemQty: number
    countedQty: number
    varianceQty: number
    note: string
    unexpectedFoundDatQty: number
    unexpectedFoundLoiQty: number
    qualityStatus: 'DAT' | 'LOI' | ''
    locationId: string
    serialRows: Array<{
      countSerialId: string
      serialId: string | null
      serialCode: string
      countStatus: 'COUNTED' | 'MISSING_IN_COUNT' | 'UNEXPECTED_FOUND' | 'WRONG_LOCATION'
      qualityProposal: 'DAT' | 'LOI' | 'HUY'
      systemLocationId: string
      countedLocationId: string
      note: string
      systemVisibilityLabel: string
      generatedFromCount: boolean
      generatedLotId: string
      generatedLotCode: string
    }>
    generatedLots: Array<{
      lotId: string
      lotCode: string
      qualityProposal: 'DAT' | 'LOI'
      serialCount: number
    }>
    printableLots: Array<{
      lotId: string
      lotCode: string
      serialCount: number
    }>
  }>
}

export async function submitCreateFinishedGoodsCountSheet(input: {
  countType?: 'VAN_HANH' | 'TON_DAU_KY'
  countDate: string
  note?: string
  rows: Array<{
    id: string
    itemKey: string
    itemLabel: string
    templateId?: string
    maCoc?: string
    loaiCoc: string
    tenDoan: string
    chieuDaiM: number
    systemQty: number
    note?: string
    openingQty?: number
    qualityStatus?: 'DAT' | 'LOI'
    locationId?: string
  }>
}) {
  return requestFinishedGoodsCount<{
    countSheetId: string
    countSheetCode: string
    lineCount: number
    serialCount: number
  }>(
    '/api/finished-goods-count',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không tạo được phiếu kiểm kê cọc.'
  )
}

export async function submitSaveFinishedGoodsCountDraft(input: {
  countSheetId: string
  note: string
  lines: Array<{
    countLineId: string
    note: string
    unexpectedFoundDatQty: number
    unexpectedFoundLoiQty: number
    serialRows: Array<{
      countSerialId: string
      countStatus: 'COUNTED' | 'MISSING_IN_COUNT' | 'UNEXPECTED_FOUND' | 'WRONG_LOCATION'
      qualityProposal: 'DAT' | 'LOI' | 'HUY'
      note: string
    }>
  }>
}) {
  return requestFinishedGoodsCount<FinishedGoodsCountDetailResult>(
    `/api/finished-goods-count/${input.countSheetId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: input.note, lines: input.lines }),
    },
    'Không lưu được phiếu kiểm kê cọc.'
  )
}

export async function submitConfirmFinishedGoodsCount(input: { countSheetId: string }) {
  return requestFinishedGoodsCount<FinishedGoodsCountDetailResult>(
    `/api/finished-goods-count/${input.countSheetId}/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không xác nhận kho được phiếu kiểm kê cọc.'
  )
}

export async function submitApproveFinishedGoodsCount(input: { countSheetId: string }) {
  return requestFinishedGoodsCount<FinishedGoodsCountDetailResult>(
    `/api/finished-goods-count/${input.countSheetId}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không duyệt được chênh lệch kiểm kê cọc.'
  )
}

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function parseEnvelopeSafely<T>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      throw new Error(text || fallbackMessage)
    }
    throw new Error(fallbackMessage)
  }

  const result = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !result.ok) {
    throw new Error(result.error || fallbackMessage)
  }
  return result
}

async function requestInventoryCount<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string) {
  try {
    const response = await fetch(input, init)
    return await parseEnvelopeSafely<T>(response, fallbackMessage)
  } catch (error) {
    if (error instanceof Error) {
      const message = String(error.message || '').trim()
      if (message === 'Failed to fetch') {
        throw new Error('Không kết nối được tới API kiểm kê. Bạn thử tải lại trang hoặc kiểm tra dev server rồi thao tác lại giúp mình.')
      }
      throw error
    }
    throw new Error(fallbackMessage)
  }
}

export type InventoryCountSheetDraftResult = {
  countSheetId: string
  countSheetCode: string
  lineCount: number
}

export type InventoryCountDetailResult = {
  countSheetId: string
  countSheetCode: string
  countType: 'OPENING_BALANCE' | 'OPERATIONAL'
  scopeType: 'FULL_WAREHOUSE' | 'MATERIAL_GROUP' | 'SELECTED_ITEMS' | 'SELECTED_LOCATION' | 'SELECTED_PO_CONTEXT'
  countDate: string
  status: 'NHAP' | 'CHO_XAC_NHAN_KHO' | 'CHO_DUYET_CHENH_LECH' | 'DA_DUYET' | 'DA_DIEU_CHINH_TON' | 'HUY'
  note: string
  createdAt: string
  lines: Array<{
    countLineId: string
    lineNo: number
    itemType: 'NVL' | 'FINISHED_GOOD' | 'TOOL' | 'ASSET'
    itemId: string
    itemCode: string
    itemName: string
    itemGroup: string
    unit: string
    systemQty: number
    countedQty: number
    varianceQty: number
    variancePct: number
    allowedLossPct: number
    costClassification: 'CHI_PHI_QUAN_LY' | 'CHI_PHI_THAT_THOAT' | 'TON_TANG' | 'KHONG_AP_DUNG' | null
    note: string
  }>
}

export async function submitCreateInventoryCountSheet(input: {
  countType: 'OPENING_BALANCE' | 'OPERATIONAL'
  countDate: string
  note?: string
  rows: Array<{
    id: string
    itemType: 'NVL' | 'FINISHED_GOOD' | 'TOOL' | 'ASSET'
    itemId: string
    itemCode: string
    itemName: string
    itemGroup: string
    unit: string
    systemQty: number
    countedQty: number
    allowedLossPct: number
    note?: string
  }>
}) {
  return requestInventoryCount<InventoryCountSheetDraftResult>(
    '/api/inventory-count',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không tạo được phiếu kiểm kê.'
  )
}

export async function fetchInventoryCountDetail(countSheetId: string) {
  return requestInventoryCount<InventoryCountDetailResult>(
    `/api/inventory-count/${countSheetId}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
    'Không tải được chi tiết phiếu kiểm kê.'
  )
}

export async function submitSaveInventoryCountDraft(input: {
  countSheetId: string
  note: string
  lines: Array<{
    countLineId: string
    countedQty: number
    note: string
  }>
}) {
  return requestInventoryCount<InventoryCountDetailResult>(
    `/api/inventory-count/${input.countSheetId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: input.note, lines: input.lines }),
    },
    'Không lưu được phiếu kiểm kê.'
  )
}

export async function submitConfirmInventoryCount(input: { countSheetId: string }) {
  return requestInventoryCount<InventoryCountDetailResult>(
    `/api/inventory-count/${input.countSheetId}/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không xác nhận kho được phiếu kiểm kê.'
  )
}

export async function submitApproveInventoryCount(input: { countSheetId: string }) {
  return requestInventoryCount<InventoryCountDetailResult>(
    `/api/inventory-count/${input.countSheetId}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Không duyệt chênh lệch kiểm kê được.'
  )
}

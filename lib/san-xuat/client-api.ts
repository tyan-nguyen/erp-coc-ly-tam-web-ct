import type {
  AvailableSegmentOption,
  KeHoachNgayDetail,
  QcIssueDraft,
  QcIssueLineResult,
  QcSerialResult,
  WarehouseIssueLineDraft,
} from '@/lib/san-xuat/types'

type ApiEnvelope<T> = {
  ok: boolean
  error?: string
  data?: T
}

async function readSanXuatEnvelope<T>(response: Response, fallbackMessage: string) {
  const data = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallbackMessage)
  }
  return data
}

export async function submitCreateKeHoachNgay(input: {
  ngayKeHoach: string
  note: string
  lines?: Array<{
    orderId: string
    doanKey: string
    soLuongKeHoach: number
    note?: string
  }>
}) {
  const response = await fetch('/api/san-xuat/ke-hoach-ngay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readSanXuatEnvelope<{ planId: string; existed: boolean }>(response, 'Không tạo được kế hoạch ngày.')
}

export async function submitChotKeHoachNgay(input: { planId: string }) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'CHOT_KE_HOACH' }),
  })

  return readSanXuatEnvelope<unknown>(response, 'Không chốt được kế hoạch ngày.')
}

export async function submitMoLaiKeHoachNgay(input: { planId: string }) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'MO_LAI_KE_HOACH' }),
  })

  return readSanXuatEnvelope<unknown>(response, 'Không mở chốt được kế hoạch ngày.')
}

export async function submitAddKeHoachLine(input: {
  planId: string
  orderId: string
  doanKey: string
  soLuongKeHoach: number
  note: string
}) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: input.orderId,
      doanKey: input.doanKey,
      soLuongKeHoach: input.soLuongKeHoach,
      note: input.note,
    }),
  })

  return readSanXuatEnvelope<unknown>(response, 'Không thêm được dòng kế hoạch.')
}

export async function submitDeleteKeHoachLine(input: { planId: string; lineId: string }) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/lines/${input.lineId}`, {
    method: 'DELETE',
  })

  return readSanXuatEnvelope<unknown>(response, 'Không xóa được dòng kế hoạch.')
}

export async function submitSaveWarehouseIssue(input: {
  planId: string
  note: string
  actualItems: Array<{ lineId: string; soLuongThucTe: number }>
  lineDrafts: WarehouseIssueLineDraft[]
  concreteSummaries: Array<{
    concreteGrade: string
    requiredM3: number
    allocations: Array<{ variant: string; volumeM3: number }>
  }>
  materialSummaries: Array<{
    key: string
    nhom: 'THEP' | 'PHU_KIEN' | 'PHU_GIA' | 'BETONG'
    label: string
    dvt: string
    estimateQty: number
    actualQty: number
  }>
}) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/xuat-nvl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return readSanXuatEnvelope<{
    stockMovement?: {
      schemaReady: boolean
      createdMovementCount: number
      totalIssuedQty: number
    }
    stockMovementError?: string | null
    serialGeneration?: {
      generatedLotCount: number
      generatedSerialCount: number
      schemaReady: boolean
    }
    serialGenerationError?: string | null
  }>(response, 'Không lưu được phiếu xác nhận thực sản xuất & xuất NVL.')
}

export async function submitReopenWarehouseIssue(input: { planId: string }) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${input.planId}/xuat-nvl/mo-lai`, {
    method: 'POST',
  })

  return readSanXuatEnvelope<unknown>(response, 'Không mở lại được phiếu thực sản xuất và xuất NVL.')
}

export async function submitSaveQcIssue(input: {
  planId: string
  note: string
  lineResults: QcIssueLineResult[]
  serialResults: QcSerialResult[]
}) {
  const response = await fetch(`/api/san-xuat/qc-nghiem-thu/${input.planId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: input.note,
      lineResults: input.lineResults,
      serialResults: input.serialResults,
    }),
  })

  return readSanXuatEnvelope<QcIssueDraft>(response, 'Không lưu được phiếu nghiệm thu QC.')
}

export async function fetchKeHoachNgayDetail(planId: string) {
  const response = await fetch(`/api/san-xuat/ke-hoach-ngay/${planId}`, {
    method: 'GET',
    cache: 'no-store',
  })

  return readSanXuatEnvelope<KeHoachNgayDetail>(response, 'Không tải được chi tiết kế hoạch ngày.')
}

export async function fetchKeHoachNgayDraftSegments() {
  const response = await fetch('/api/san-xuat/ke-hoach-ngay', {
    method: 'GET',
    cache: 'no-store',
  })

  return readSanXuatEnvelope<AvailableSegmentOption[]>(
    response,
    'Không tải được danh sách đơn hàng khả dụng.'
  )
}

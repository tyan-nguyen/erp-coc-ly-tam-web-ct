import {
  addKeHoachLine,
  chotKeHoachNgay,
  createKeHoachNgay,
  deleteKeHoachLine,
  hasWarehouseIssueVoucher,
  moLaiKeHoachNgay,
  moLaiWarehouseIssueVoucher,
  saveQcIssueVoucher,
  saveWarehouseIssueVoucher,
  xacNhanThucSanXuatLine,
  xacNhanThucSanXuatNhieuLine,
} from '@/lib/san-xuat/repository'
import type { QcIssueLineResult, QcSerialResult, WarehouseIssueLineDraft } from '@/lib/san-xuat/types'

type AnySupabase = Parameters<typeof createKeHoachNgay>[0]

export type CreateKeHoachNgayBody = {
  ngayKeHoach?: string
  note?: string
  lines?: Array<{
    orderId?: string
    doanKey?: string
    soLuongKeHoach?: number
    note?: string
  }>
}

export type AddKeHoachLineBody = {
  orderId?: string
  doanKey?: string
  soLuongKeHoach?: number
  note?: string
}

export type BatchActualProductionBody = {
  items?: Array<{ lineId?: string; soLuongThucTe?: number }>
}

export type WarehouseIssueBody = {
  note?: string
  actualItems?: Array<{ lineId?: string; soLuongThucTe?: number }>
  lineDrafts?: WarehouseIssueLineDraft[]
  concreteSummaries?: Array<{
    concreteGrade?: string
    requiredM3?: number
    allocations?: Array<{ variant?: string; volumeM3?: number }>
  }>
  materialSummaries?: Array<{
    key?: string
    nhom?: 'THEP' | 'PHU_KIEN' | 'PHU_GIA' | 'BETONG'
    label?: string
    dvt?: string
    estimateQty?: number
    actualQty?: number
  }>
}

export type SaveQcIssueBody = {
  note?: string
  lineResults?: QcIssueLineResult[]
  serialResults?: QcSerialResult[]
}

export async function executeCreateKeHoachNgayMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateKeHoachNgayBody
}) {
  const result = await createKeHoachNgay(input.supabase, {
    userId: input.userId,
    ngayKeHoach: String(input.body.ngayKeHoach || ''),
    note: input.body.note,
  })

  if (Array.isArray(input.body.lines) && input.body.lines.length > 0) {
    for (const line of input.body.lines) {
      await addKeHoachLine(input.supabase, {
        userId: input.userId,
        planId: result.planId,
        orderId: String(line.orderId || ''),
        doanKey: String(line.doanKey || ''),
        soLuongKeHoach: Number(line.soLuongKeHoach || 0),
        note: line.note,
      })
    }
  }

  return result
}

export async function executeChotKeHoachNgayMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
}) {
  return chotKeHoachNgay(input.supabase, {
    planId: input.planId,
    userId: input.userId,
  })
}

export async function executeMoLaiKeHoachNgayMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
}) {
  return moLaiKeHoachNgay(input.supabase, {
    planId: input.planId,
    userId: input.userId,
  })
}

export async function executeAddKeHoachLineMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
  body: AddKeHoachLineBody
}) {
  return addKeHoachLine(input.supabase, {
    userId: input.userId,
    planId: input.planId,
    orderId: String(input.body.orderId || ''),
    doanKey: String(input.body.doanKey || ''),
    soLuongKeHoach: Number(input.body.soLuongKeHoach || 0),
    note: input.body.note,
  })
}

export async function executeDeleteKeHoachLineMutation(input: {
  supabase: AnySupabase
  planId: string
  lineId: string
  userId: string
}) {
  return deleteKeHoachLine(input.supabase, {
    planId: input.planId,
    lineId: input.lineId,
    userId: input.userId,
  })
}

export async function executeLineActualProductionMutation(input: {
  supabase: AnySupabase
  planId: string
  lineId: string
  userId: string
  soLuongThucTe?: number
}) {
  return xacNhanThucSanXuatLine(input.supabase, {
    planId: input.planId,
    lineId: input.lineId,
    userId: input.userId,
    soLuongThucTe: Number(input.soLuongThucTe || 0),
  })
}

export async function executeBatchActualProductionMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
  body: BatchActualProductionBody
}) {
  return xacNhanThucSanXuatNhieuLine(input.supabase, {
    planId: input.planId,
    userId: input.userId,
    items: Array.isArray(input.body.items)
      ? input.body.items.map((item) => ({
          lineId: String(item.lineId || ''),
          soLuongThucTe: Number(item.soLuongThucTe || 0),
        }))
      : [],
  })
}

export async function executeSaveWarehouseIssueMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
  body: WarehouseIssueBody
}) {
  const locked = await hasWarehouseIssueVoucher(input.supabase, input.planId)
  if (locked) {
    throw new Error('Phiếu thực sản xuất và xuất NVL đã được xác nhận. Muốn chỉnh sửa cần mở lại bằng chức năng riêng.')
  }

  await xacNhanThucSanXuatNhieuLine(input.supabase, {
    planId: input.planId,
    userId: input.userId,
    items: Array.isArray(input.body.actualItems)
      ? input.body.actualItems.map((item) => ({
          lineId: String(item.lineId || ''),
          soLuongThucTe: Number(item.soLuongThucTe || 0),
        }))
      : [],
  })

  return saveWarehouseIssueVoucher(input.supabase, {
    planId: input.planId,
    userId: input.userId,
    note: input.body.note,
    lineDrafts: Array.isArray(input.body.lineDrafts) ? input.body.lineDrafts : [],
    concreteSummaries: Array.isArray(input.body.concreteSummaries)
      ? input.body.concreteSummaries.map((item) => ({
          concreteGrade: String(item.concreteGrade || ''),
          requiredM3: Number(item.requiredM3 || 0),
          variantOptions: [],
          variantRecipes: [],
          allocations: Array.isArray(item.allocations)
            ? item.allocations.map((allocation) => ({
                variant: String(allocation.variant || ''),
                volumeM3: Number(allocation.volumeM3 || 0),
              }))
            : [],
        }))
      : [],
    materialSummaries: Array.isArray(input.body.materialSummaries)
      ? input.body.materialSummaries.map((item) => ({
          key: String(item.key || ''),
          nhom: item.nhom || 'PHU_GIA',
          label: String(item.label || ''),
          dvt: String(item.dvt || ''),
          estimateQty: Number(item.estimateQty || 0),
          actualQty: Number(item.actualQty || 0),
        }))
      : [],
  })
}

export async function executeReopenWarehouseIssueMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
}) {
  return moLaiWarehouseIssueVoucher(input.supabase, {
    planId: input.planId,
    userId: input.userId,
  })
}

export async function executeSaveQcIssueMutation(input: {
  supabase: AnySupabase
  planId: string
  userId: string
  body: SaveQcIssueBody
}) {
  return saveQcIssueVoucher(input.supabase, {
    planId: input.planId,
    userId: input.userId,
    note: input.body.note,
    lineResults: Array.isArray(input.body.lineResults)
      ? input.body.lineResults.map((item) => ({
          lineId: String(item.lineId || ''),
          actualQty: Number(item.actualQty || 0),
          acceptedQty: Number(item.acceptedQty || 0),
          rejectedQty: Number(item.rejectedQty || 0),
          note: String(item.note || ''),
        }))
      : [],
    serialResults: Array.isArray(input.body.serialResults)
      ? input.body.serialResults.map((item) => ({
          serialId: String(item.serialId || ''),
          lineId: String(item.lineId || ''),
          serialCode: String(item.serialCode || ''),
          qcStatus:
            item.qcStatus === 'DAT' || item.qcStatus === 'LOI' || item.qcStatus === 'CHUA_QC'
              ? item.qcStatus
              : 'CHUA_QC',
          dispositionStatus:
            item.dispositionStatus === 'THANH_LY' ||
            item.dispositionStatus === 'HUY' ||
            item.dispositionStatus === 'BINH_THUONG'
              ? item.dispositionStatus
              : 'BINH_THUONG',
          note: String(item.note || ''),
        }))
      : [],
  })
}

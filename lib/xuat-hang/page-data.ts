import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadXuatHangCreateBootstrap,
  loadXuatHangPageData,
  loadXuatHangVoucherDetail,
  type XuatHangCreateBootstrap,
  type XuatHangCreateBootstrapMode,
} from '@/lib/xuat-hang/repository'

type AnySupabase = SupabaseClient

export async function loadXuatHangPhieuPageData(
  supabase: AnySupabase,
  input: {
    viewerRole: string
    selectedVoucherId?: string | null
  }
) {
  const [pageData, selectedVoucherDetail] = await Promise.all([
    loadXuatHangPageData(supabase, input.viewerRole),
    input.selectedVoucherId
      ? loadXuatHangVoucherDetail(supabase, input.selectedVoucherId, input.viewerRole)
      : Promise.resolve(null),
  ])

  return {
    pageData,
    selectedVoucherDetail,
  }
}

export async function loadXuatHangVoucherDetailPageData(
  supabase: AnySupabase,
  input: {
    viewerRole: string
    selectedVoucherId: string
  }
) {
  const selectedVoucherDetail = await loadXuatHangVoucherDetail(supabase, input.selectedVoucherId, input.viewerRole)

  return {
    pageData: {
      customers: [],
      quoteOptions: [],
      orderSources: [],
      stockSources: [],
      vouchers: selectedVoucherDetail
        ? [
            {
              voucherId: selectedVoucherDetail.voucherId,
              maPhieu: selectedVoucherDetail.maPhieu,
              sourceType: selectedVoucherDetail.sourceType,
              status: selectedVoucherDetail.status,
              customerName: selectedVoucherDetail.customerName,
              projectName: selectedVoucherDetail.projectName,
              orderLabel: selectedVoucherDetail.orderLabel,
              requestedQtyTotal: selectedVoucherDetail.requestedQtyTotal,
              actualQtyTotal: selectedVoucherDetail.actualQtyTotal,
              operationDate: null,
              createdAt: new Date().toISOString(),
              hasReturnData:
                Boolean(selectedVoucherDetail.returnRequest) || selectedVoucherDetail.returnedSerials.length > 0,
              detail: selectedVoucherDetail,
            },
          ]
        : [],
    },
    selectedVoucherDetail,
  }
}

export async function loadXuatHangCreateBootstrapPageData(
  supabase: AnySupabase,
  input: {
    viewerRole: string
    mode?: XuatHangCreateBootstrapMode
  }
) {
  const data = await loadXuatHangCreateBootstrap(supabase, input.viewerRole, input.mode || 'ALL')
  return data satisfies XuatHangCreateBootstrap
}

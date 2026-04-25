import { NextResponse } from 'next/server'
import { getCurrentSessionProfile, getAuthenticatedClientAndUser } from '@/lib/auth/session'
import { executeLoadXuatHangVoucherDetail } from '@/lib/xuat-hang/mutations'

export async function GET(
  _request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const { voucher_id: voucherId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()
    const detail = await executeLoadXuatHangVoucherDetail({
      supabase,
      voucherId,
      viewerRole: profile.role,
    })
    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết phiếu xuất hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

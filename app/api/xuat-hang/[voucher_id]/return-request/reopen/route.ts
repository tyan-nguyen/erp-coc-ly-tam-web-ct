import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { executeReopenShipmentReturnRequestMutation } from '@/lib/xuat-hang/mutations'

export async function POST(
  _request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const { voucher_id: voucherId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeReopenShipmentReturnRequestMutation({
      supabase,
      voucherId,
      userId: user.id,
      userRole: profile.role,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không mở lại được đề nghị trả hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

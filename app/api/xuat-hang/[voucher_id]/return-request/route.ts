import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { executeShipmentReturnRequestMutation, type ShipmentReturnRequestBody } from '@/lib/xuat-hang/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const body = (await request.json()) as ShipmentReturnRequestBody
    const { voucher_id: voucherId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeShipmentReturnRequestMutation({
      supabase,
      voucherId,
      userId: user.id,
      userRole: profile.role,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tạo được đề nghị trả hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { executeShipmentScanMutation, type ShipmentScanBody } from '@/lib/xuat-hang/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const body = (await request.json()) as ShipmentScanBody
    const { voucher_id: voucherId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeShipmentScanMutation({
      supabase,
      voucherId,
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
          : 'Không quét được serial của phiếu xuất hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

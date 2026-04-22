import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canApproveProductionPlan } from '@/lib/auth/roles'
import { executeChotKeHoachNgayMutation, executeMoLaiKeHoachNgayMutation } from '@/lib/san-xuat/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: 'CHOT_KE_HOACH' | 'MO_LAI_KE_HOACH' }
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canApproveProductionPlan(profile.role)) {
      throw new Error('Chỉ KTBH hoặc Admin mới được chốt hoặc mở chốt kế hoạch ngày.')
    }

    let result: unknown
    if (body.action === 'CHOT_KE_HOACH') {
      result = await executeChotKeHoachNgayMutation({
        supabase,
        planId,
        userId: user.id,
      })
    } else if (body.action === 'MO_LAI_KE_HOACH') {
      result = await executeMoLaiKeHoachNgayMutation({
        supabase,
        planId,
        userId: user.id,
      })
    } else {
      throw new Error('Action không hợp lệ.')
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không chốt được kế hoạch ngày'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

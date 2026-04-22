import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canConfirmProductionActual, canManageProductionPlan } from '@/lib/auth/roles'
import {
  executeDeleteKeHoachLineMutation,
  executeLineActualProductionMutation,
} from '@/lib/san-xuat/mutations'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ plan_id: string; line_id: string }> }
) {
  try {
    const { plan_id: planId, line_id: lineId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canManageProductionPlan(profile.role)) {
      throw new Error('Chỉ QLSX hoặc Admin mới được xóa dòng kế hoạch.')
    }

    const result = await executeDeleteKeHoachLineMutation({
      supabase,
      planId,
      lineId,
      userId: user.id,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không xóa được dòng kế hoạch'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ plan_id: string; line_id: string }> }
) {
  try {
    const body = (await request.json()) as { soLuongThucTe?: number }
    const { plan_id: planId, line_id: lineId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canConfirmProductionActual(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được xác nhận thực sản xuất.')
    }

    const result = await executeLineActualProductionMutation({
      supabase,
      planId,
      lineId,
      userId: user.id,
      soLuongThucTe: Number(body.soLuongThucTe || 0),
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không xác nhận được thực sản xuất'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

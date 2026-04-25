import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageProductionPlan, canSaveProductionActual } from '@/lib/auth/roles'
import {
  executeAddKeHoachLineMutation,
  executeBatchActualProductionMutation,
  type AddKeHoachLineBody,
  type BatchActualProductionBody,
} from '@/lib/san-xuat/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const body = (await request.json()) as AddKeHoachLineBody
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canManageProductionPlan(profile.role)) {
      throw new Error('Chỉ QLSX hoặc Admin mới được thêm dòng kế hoạch.')
    }

    const result = await executeAddKeHoachLineMutation({
      supabase,
      planId,
      userId: user.id,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không thêm được dòng kế hoạch'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const body = (await request.json()) as BatchActualProductionBody
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canSaveProductionActual(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được lưu sản lượng thực sản xuất.')
    }

    const result = await executeBatchActualProductionMutation({
      supabase,
      planId,
      userId: user.id,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được sản lượng thực sản xuất'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

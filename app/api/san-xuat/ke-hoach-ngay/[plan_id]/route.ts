import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewProductionPlan } from '@/lib/auth/roles'
import { loadKeHoachNgayDetail } from '@/lib/san-xuat/repository'

export async function GET(
  _request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const { plan_id: planId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canViewProductionPlan(profile.role)) {
      throw new Error('Role hiện tại không được xem chi tiết kế hoạch ngày.')
    }

    const detail = await loadKeHoachNgayDetail(supabase, planId, profile.role)
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy kế hoạch ngày.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết kế hoạch ngày'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

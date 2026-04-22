import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canCreateProductionPlan } from '@/lib/auth/roles'
import { executeCreateKeHoachNgayMutation, type CreateKeHoachNgayBody } from '@/lib/san-xuat/mutations'
import { loadKeHoachNgayDraftSegments } from '@/lib/san-xuat/repository'

export async function GET() {
  try {
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateProductionPlan(profile.role)) {
      throw new Error('Chỉ QLSX hoặc Admin mới được xem danh sách đơn hàng khả dụng.')
    }

    const data = await loadKeHoachNgayDraftSegments(supabase, profile.role)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được danh sách đơn hàng khả dụng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateKeHoachNgayBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateProductionPlan(profile.role)) {
      throw new Error('Chỉ QLSX hoặc Admin mới được tạo kế hoạch sản xuất.')
    }

    const result = await executeCreateKeHoachNgayMutation({
      supabase,
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
          : 'Không tạo được kế hoạch ngày'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

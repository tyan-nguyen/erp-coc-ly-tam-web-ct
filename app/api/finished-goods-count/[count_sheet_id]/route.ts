import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessFinishedGoodsCount, canEditInventoryCount } from '@/lib/auth/roles'
import { loadFinishedGoodsCountDetail } from '@/lib/finished-goods-counting/repository'
import {
  executeSaveFinishedGoodsCountDraftMutation,
  type SaveFinishedGoodsCountDraftBody,
} from '@/lib/finished-goods-counting/mutations'

export async function GET(
  _request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessFinishedGoodsCount(profile.role)) {
      throw new Error('Role hiện tại không được xem phiếu kiểm kê cọc.')
    }

    const detail = await loadFinishedGoodsCountDetail({ supabase, countSheetId })
    if (!detail) return NextResponse.json({ ok: false, error: 'Không tìm thấy phiếu kiểm kê cọc.' }, { status: 404 })

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết phiếu kiểm kê cọc.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const body = (await request.json()) as SaveFinishedGoodsCountDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canEditInventoryCount(profile.role)) {
      throw new Error('Chỉ Kiểm kê viên, Thủ kho hoặc Admin mới được lưu phiếu kiểm kê cọc.')
    }

    const detail = await executeSaveFinishedGoodsCountDraftMutation({
      supabase,
      userId: user.id,
      countSheetId,
      body,
    })

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được phiếu kiểm kê cọc.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessInventoryCount, canEditInventoryCount } from '@/lib/auth/roles'
import { loadInventoryCountDetail } from '@/lib/inventory-counting/repository'
import {
  executeSaveInventoryCountDraftMutation,
  type SaveInventoryCountDraftBody,
} from '@/lib/inventory-counting/mutations'

export async function GET(
  _request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessInventoryCount(profile.role)) {
      throw new Error('Role hiện tại không được xem chi tiết phiếu kiểm kê.')
    }

    const detail = await loadInventoryCountDetail({ supabase, countSheetId })
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy phiếu kiểm kê.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết phiếu kiểm kê.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const body = (await request.json()) as SaveInventoryCountDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canEditInventoryCount(profile.role)) {
      throw new Error('Chỉ Kiểm kê viên, Thủ kho hoặc Admin mới được lưu chi tiết phiếu kiểm kê.')
    }

    const detail = await executeSaveInventoryCountDraftMutation({
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
          : 'Không lưu được phiếu kiểm kê.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

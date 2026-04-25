import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canCreateFinishedGoodsCount } from '@/lib/auth/roles'
import {
  executeCreateFinishedGoodsCountSheetMutation,
  type CreateFinishedGoodsCountSheetBody,
} from '@/lib/finished-goods-counting/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFinishedGoodsCountSheetBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateFinishedGoodsCount(profile.role)) {
      throw new Error('Chỉ Kiểm kê viên hoặc Admin mới được tạo phiếu kiểm kê cọc.')
    }

    const result = await executeCreateFinishedGoodsCountSheetMutation({
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
          : 'Không tạo được phiếu kiểm kê cọc.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

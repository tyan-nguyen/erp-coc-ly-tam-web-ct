import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessFinishedGoodsCount } from '@/lib/auth/roles'
import {
  executeCreateFinishedGoodsOpeningBalanceMutation,
  type CreateFinishedGoodsOpeningBalanceBody,
} from '@/lib/ton-kho-thanh-pham/opening-balance-mutations'
import { refreshFinishedGoodsStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFinishedGoodsOpeningBalanceBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessFinishedGoodsCount(profile.role)) {
      throw new Error('Chỉ Thủ kho, Kiểm kê viên hoặc Admin mới được mở tồn đầu kỳ cọc thành phẩm.')
    }

    const result = await executeCreateFinishedGoodsOpeningBalanceMutation({
      supabase,
      userId: user.id,
      body,
    })
    await refreshFinishedGoodsStockReadModelSafely(supabase)

    return NextResponse.json({
      ok: true,
      data: {
        lotId: result.lotId,
        lotCode: result.lotCode,
        generatedSerialCount: result.generatedSerialCount,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tạo được lô tồn đầu kỳ thành phẩm.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

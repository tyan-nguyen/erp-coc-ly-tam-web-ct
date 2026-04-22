import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canConfirmNvlReceiptMovement } from '@/lib/auth/roles'
import {
  executeConfirmReceiptMovementMutation,
  type ConfirmReceiptMovementBody,
} from '@/lib/nvl-procurement/mutations'
import { refreshNvlStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmReceiptMovementBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canConfirmNvlReceiptMovement(profile.role)) {
      throw new Error('Chỉ QLSX, Thủ kho hoặc Admin mới được ghi stock movement từ receipt NVL.')
    }

    const result = await executeConfirmReceiptMovementMutation({
      supabase,
      userId: user.id,
      body,
    })
    await refreshNvlStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không ghi được stock movement từ receipt NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

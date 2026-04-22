import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canFinishPurchaseOrder } from '@/lib/auth/roles'
import {
  executeFinishPurchaseOrderMutation,
  type FinishPurchaseOrderBody,
} from '@/lib/nvl-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinishPurchaseOrderBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canFinishPurchaseOrder(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được kết thúc nhập phiếu mua NVL.')
    }

    const result = await executeFinishPurchaseOrderMutation({
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
          : 'Không kết thúc được phiếu mua NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

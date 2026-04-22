import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlProcurement } from '@/lib/auth/roles'
import {
  executeCreatePurchaseOrderDraftMutation,
  type CreatePurchaseOrderDraftBody,
} from '@/lib/nvl-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePurchaseOrderDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessNvlProcurement(profile.role)) {
      throw new Error('Chỉ QLSX, KTMH, Thủ kho hoặc Admin mới được tạo phiếu mua NVL.')
    }

    const result = await executeCreatePurchaseOrderDraftMutation({
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
          : 'Không tạo được draft PO NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

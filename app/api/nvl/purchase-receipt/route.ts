import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canCreateNvlPurchaseRequest } from '@/lib/auth/roles'
import {
  executeCreateReceiptDraftMutation,
  type CreateReceiptDraftBody,
} from '@/lib/nvl-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateReceiptDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateNvlPurchaseRequest(profile.role)) {
      throw new Error('Chỉ QLSX, Thủ kho hoặc Admin mới được tạo draft receipt NVL.')
    }

    const result = await executeCreateReceiptDraftMutation({
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
          : 'Không tạo được draft receipt NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

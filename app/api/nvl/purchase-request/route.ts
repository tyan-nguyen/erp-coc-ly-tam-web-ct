import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canCreateNvlPurchaseRequest } from '@/lib/auth/roles'
import {
  executeCreatePurchaseRequestDraftMutation,
  type CreatePurchaseRequestDraftBody,
} from '@/lib/nvl-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePurchaseRequestDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateNvlPurchaseRequest(profile.role)) {
      throw new Error('Chỉ QLSX, Thủ kho hoặc Admin mới được lưu draft đề xuất mua NVL.')
    }

    const result = await executeCreatePurchaseRequestDraftMutation({
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
          : 'Không lưu được draft đề xuất mua NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

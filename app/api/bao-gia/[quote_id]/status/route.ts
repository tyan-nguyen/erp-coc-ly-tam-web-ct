import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole, isSalesAccountingRole } from '@/lib/auth/roles'
import {
  executeBaoGiaStatusMutation,
  type BaoGiaStatusMutationBody,
} from '@/lib/bao-gia/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ quote_id: string }> }
) {
  try {
    const { quote_id: quoteId } = await context.params
    const body = (await request.json()) as BaoGiaStatusMutationBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()
    if (body.action === 'APPROVE_PRODUCTION' && !isSalesAccountingRole(profile.role) && !isAdminRole(profile.role)) {
      throw new Error('Chỉ Kế toán bán hàng hoặc Admin mới được duyệt sản xuất.')
    }
    const result = await executeBaoGiaStatusMutation({
      supabase,
      quoteId,
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
          : 'Không cập nhật được trạng thái báo giá'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

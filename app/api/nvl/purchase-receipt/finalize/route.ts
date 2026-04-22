import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canFinalizePurchaseOrder } from '@/lib/auth/roles'
import {
  executeFinalizeReceiptMutation,
  type FinalizeReceiptBody,
} from '@/lib/nvl-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinalizeReceiptBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canFinalizePurchaseOrder(profile.role)) {
      throw new Error('Chỉ KTMH hoặc Admin mới được chốt đợt nhập NVL.')
    }

    const result = await executeFinalizeReceiptMutation({
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
          : 'Không chốt được đợt nhập NVL.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlProcurement, canEditNvlReceiptDraft } from '@/lib/auth/roles'
import { loadReceiptDetail } from '@/lib/nvl-procurement/receipt-repository'
import {
  executeSaveReceiptDraftMutation,
  type SaveReceiptDraftBody,
} from '@/lib/nvl-procurement/mutations'

export async function GET(
  _request: Request,
  context: { params: Promise<{ receipt_id: string }> }
) {
  try {
    const { receipt_id: receiptId } = await context.params
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessNvlProcurement(profile.role)) {
      throw new Error('Role hiện tại không được xem chi tiết receipt NVL.')
    }

    const detail = await loadReceiptDetail({ supabase, receiptId })
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy receipt NVL.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết receipt NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ receipt_id: string }> }
) {
  try {
    const { receipt_id: receiptId } = await context.params
    const body = (await request.json()) as SaveReceiptDraftBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canEditNvlReceiptDraft(profile.role)) {
      throw new Error('Role hiện tại không được lưu receipt NVL.')
    }

    const detail = await executeSaveReceiptDraftMutation({
      supabase,
      userId: user.id,
      receiptId,
      body,
    })

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được draft receipt NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

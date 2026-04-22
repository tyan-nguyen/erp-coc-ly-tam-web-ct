import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser } from '@/lib/auth/session'
import { saveBaoGia, type BaoGiaSnapshot } from '@/lib/bao-gia/repository'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quoteId?: string
      action: 'SAVE' | 'EXPORT'
      snapshot: BaoGiaSnapshot
      printHtml?: string
      note?: string
    }

    const { supabase, user } = await getAuthenticatedClientAndUser()
    const result = await saveBaoGia(supabase, {
      userId: user.id,
      quoteId: body.quoteId,
      action: body.action,
      snapshot: body.snapshot,
      printHtml: body.printHtml,
      note: body.note,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được báo giá'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

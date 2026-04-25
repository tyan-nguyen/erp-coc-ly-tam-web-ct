import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canPrintFinishedGoodsGeneratedLabels } from '@/lib/auth/roles'
import { searchPrintableSerialLabelsForReprint, type SerialReprintSearchInput } from '@/lib/pile-serial/repository'

function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message || '').trim()
    if (message) return message
  }
  return fallback
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentSessionProfile()
    if (!canPrintFinishedGoodsGeneratedLabels(profile.role)) {
      throw new Error('Bạn không có quyền tìm serial để in tem.')
    }

    const body = (await request.json()) as SerialReprintSearchInput
    const candidates = await searchPrintableSerialLabelsForReprint(supabase, body)
    return NextResponse.json({ ok: true, data: { candidates } })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getUnknownErrorMessage(error, 'Không tìm được serial để in tem.'),
      },
      { status: 400 }
    )
  }
}

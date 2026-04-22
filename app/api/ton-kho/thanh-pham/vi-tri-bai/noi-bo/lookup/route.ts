import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { loadWarehouseInternalSerialLookup } from '@/lib/ton-kho-thanh-pham/internal-serial-scan-repository'

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
    if (!canManageWarehouseLocation(profile.role)) {
      throw new Error('Chỉ Thủ kho, QLSX hoặc Admin mới dùng được màn scan nội bộ.')
    }

    const body = (await request.json()) as { serialCode?: string }
    const data = await loadWarehouseInternalSerialLookup(supabase, String(body.serialCode || ''))
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getUnknownErrorMessage(error, 'Không tra cứu được serial.'),
      },
      { status: 400 }
    )
  }
}

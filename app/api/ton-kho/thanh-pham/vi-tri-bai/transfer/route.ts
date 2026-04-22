import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { transferSerialsBetweenWarehouseLocations } from '@/lib/ton-kho-thanh-pham/location-assignment-mutations'

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
    const body = (await request.json()) as {
      fromLocationId?: string
      toLocationId?: string
      serialCodesText?: string
      note?: string
    }

    const data = await transferSerialsBetweenWarehouseLocations(supabase, {
      userId: profile.user_id,
      userRole: profile.role,
      fromLocationId: String(body.fromLocationId || ''),
      toLocationId: String(body.toLocationId || ''),
      serialCodesText: String(body.serialCodesText || ''),
      note: String(body.note || ''),
    })

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getUnknownErrorMessage(error, 'Không điều chuyển được serial sang bãi mới.'),
      },
      { status: 400 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { assignSerialsToWarehouseLocation } from '@/lib/ton-kho-thanh-pham/location-assignment-mutations'

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
      locationId?: string
      serialCodesText?: string
      note?: string
    }

    const data = await assignSerialsToWarehouseLocation(supabase, {
      userId: profile.user_id,
      userRole: profile.role,
      locationId: String(body.locationId || ''),
      serialCodesText: String(body.serialCodesText || ''),
      note: String(body.note || ''),
    })

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getUnknownErrorMessage(error, 'Không gán được serial vào bãi.'),
      },
      { status: 400 }
    )
  }
}

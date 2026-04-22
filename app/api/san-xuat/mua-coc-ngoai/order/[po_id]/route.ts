import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessExternalPileProcurement } from '@/lib/auth/roles'
import { loadExternalPileOrderDetail } from '@/lib/external-pile-procurement/repository'

export async function GET(
  _request: Request,
  context: { params: Promise<{ po_id: string }> }
) {
  try {
    const { po_id: poId } = await context.params
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessExternalPileProcurement(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Không có quyền xem chi tiết phiếu mua.' }, { status: 403 })
    }

    const supabase = await createClient()
    const detail = await loadExternalPileOrderDetail(supabase, poId)

    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy phiếu mua.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được chi tiết phiếu mua cọc ngoài.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

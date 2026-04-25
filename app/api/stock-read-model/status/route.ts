import { NextResponse } from 'next/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlStockTruth, canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { profile } = await getCurrentSessionProfile()
    if (!canViewFinishedGoodsInventory(profile.role) && !canAccessNvlStockTruth(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Không có quyền xem trạng thái read model tồn kho.' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stock_read_model_health')
      .select('model_name, is_verified, source_row_count, read_model_row_count, mismatch_count, verified_at, refreshed_at, note')
      .in('model_name', ['finished_goods_stock_summary', 'material_stock_balance'])
      .order('model_name', { ascending: true })

    if (error) throw error

    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      modelName: String(row.model_name || ''),
      isVerified: Boolean(row.is_verified),
      sourceRowCount: Number(row.source_row_count || 0),
      readModelRowCount: Number(row.read_model_row_count || 0),
      mismatchCount: Number(row.mismatch_count || 0),
      verifiedAt: String(row.verified_at || ''),
      refreshedAt: String(row.refreshed_at || ''),
      note: String(row.note || ''),
      mode: row.is_verified ? 'read_model_fast' : 'legacy_fallback',
    }))

    return NextResponse.json({
      ok: true,
      data: {
        rows,
        allVerified: rows.length === 2 && rows.every((row) => row.isVerified),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không đọc được trạng thái read model tồn kho.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

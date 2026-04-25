import { createClient } from '@supabase/supabase-js'
import {
  buildItemKey,
  deriveInventoryVisibility,
  isCurrentInventoryRow,
  normalizeText,
  round3,
  toNumber,
} from '@/lib/ton-kho-thanh-pham/internal'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = service || anon

  if (!url || !key) {
    throw new Error('Missing Supabase env')
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, disposition_status, visible_in_project, visible_in_retail, current_location_id'
    )
    .ilike('loai_coc', '%PHC - A400 - 65%')
    .eq('is_active', true)

  if (error) throw error

  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const loaiCoc = normalizeText(row.loai_coc)
    const tenDoan = normalizeText(row.ten_doan)
    const chieuDaiM = round3(toNumber(row.chieu_dai_m))
    const visibility = deriveInventoryVisibility(
      normalizeText(row.qc_status),
      normalizeText(row.disposition_status),
      Boolean(row.visible_in_project),
      Boolean(row.visible_in_retail)
    )

    return {
      serial: normalizeText(row.serial_code),
      loaiCoc,
      tenDoan,
      chieuDaiM,
      qcStatus: normalizeText(row.qc_status),
      lifecycleStatus: normalizeText(row.lifecycle_status),
      dispositionStatus: normalizeText(row.disposition_status),
      rawProject: Boolean(row.visible_in_project),
      rawRetail: Boolean(row.visible_in_retail),
      visibleInProject: visibility.visibleInProject,
      visibleInRetail: visibility.visibleInRetail,
      isCurrent: isCurrentInventoryRow(normalizeText(row.lifecycle_status)),
      itemKey: buildItemKey(loaiCoc, tenDoan, chieuDaiM),
      currentLocationId: normalizeText(row.current_location_id),
    }
  })

  console.log(JSON.stringify(rows, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

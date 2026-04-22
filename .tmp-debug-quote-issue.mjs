import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing supabase env')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const BOC_META_PREFIX = 'ERP_BOC_META::'
function parseMeta(note) {
  const text = String(note || '')
  const idx = text.indexOf(BOC_META_PREFIX)
  if (idx < 0) return {}
  try { return JSON.parse(text.slice(idx + BOC_META_PREFIX.length).trim()) } catch { return {} }
}
const { data: bocs, error } = await supabase
  .from('boc_tach_nvl')
  .select('boc_id, da_id, kh_id, loai_coc, phuong_thuc_van_chuyen, trang_thai, updated_at, ghi_chu, do_ngoai, chieu_day, mac_be_tong')
  .in('trang_thai', ['DA_DUYET_QLSX','DA_GUI','TRA_LAI'])
  .order('updated_at', { ascending: false })
  .limit(10)
if (error) throw error
const rows = (bocs || []).map((row) => {
  const meta = parseMeta(row.ghi_chu)
  return {
    boc_id: row.boc_id,
    trang_thai: row.trang_thai,
    da_id: row.da_id,
    loai_coc: row.loai_coc,
    phuong_thuc_van_chuyen: row.phuong_thuc_van_chuyen,
    profit_pct: meta.profit_pct ?? null,
    tax_pct: meta.tax_pct ?? null,
    note: row.ghi_chu?.split('\n')[0] || '',
    updated_at: row.updated_at,
  }
})
console.log(JSON.stringify(rows, null, 2))

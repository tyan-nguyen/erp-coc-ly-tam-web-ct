import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data, error } = await supabase.from('dm_bien_loi_nhuan').select('duong_kinh_mm,min_md,loi_nhuan_pct').eq('is_active', true)
if (error) throw error
const grouped = Object.entries((data || []).reduce((acc, row) => {
  const key = String(row.duong_kinh_mm)
  acc[key] ||= []
  acc[key].push({ min_md: row.min_md, loi_nhuan_pct: row.loi_nhuan_pct })
  return acc
}, {}))
console.log(JSON.stringify(grouped, null, 2))

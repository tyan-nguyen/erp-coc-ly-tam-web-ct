import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data, error } = await supabase.from('dm_bien_loi_nhuan').select('duong_kinh_mm,min_md,loi_nhuan_pct,is_active').eq('is_active', true).eq('duong_kinh_mm', 500).order('min_md')
if (error) throw error
console.log(JSON.stringify(data, null, 2))

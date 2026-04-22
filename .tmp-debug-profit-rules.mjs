import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await supabase.from('dm_bien_loi_nhuan').select('*').eq('is_active', true).order('duong_kinh_mm').order('min_md').limit(50)
if (error) throw error
console.log(JSON.stringify(data, null, 2))

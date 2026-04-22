import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing Supabase envs')
const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('inventory_count_sheet')
  .select('count_sheet_id,count_sheet_code,count_type,status,count_date,created_at,payload_json')
  .order('created_at', { ascending: false })
  .limit(20)

if (error) {
  console.error(JSON.stringify(error, null, 2))
  process.exit(1)
}
console.log(JSON.stringify(data, null, 2))

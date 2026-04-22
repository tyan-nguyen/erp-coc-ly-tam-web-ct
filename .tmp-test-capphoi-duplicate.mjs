import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local','utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const supabase = createClient(url,key)
const { data: rows, error: fetchError } = await supabase.from('dm_capphoi_bt').select('*').eq('is_active', true).limit(1)
if (fetchError || !rows?.length) {
  console.log('FETCH_ERROR', fetchError)
  console.log('ROWS', rows)
  process.exit(0)
}
const row = rows[0]
const payload = {
  nvl_id: row.nvl_id,
  mac_be_tong: row.mac_be_tong,
  dvt: row.dvt,
  dinh_muc_m3: row.dinh_muc_m3,
  variant: 'XI_XI_TEST',
  ghi_chu: 'VARIANT:XI_XI_TEST',
  is_active: true,
  deleted_at: null,
}
const result = await supabase.from('dm_capphoi_bt').insert(payload).select('*')
console.log(JSON.stringify({source: row, error: result.error, data: result.data}, null, 2))
if (!result.error && result.data?.[0]?.cp_id) {
  await supabase.from('dm_capphoi_bt').update({is_active:false, deleted_at:new Date().toISOString()}).eq('cp_id', result.data[0].cp_id)
}

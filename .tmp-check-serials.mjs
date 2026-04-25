import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync('/Users/duynguyen/Desktop/erp-coc-ly-tam-web/.env.local','utf8')
const map = Object.fromEntries(env.split('\n').filter(Boolean).map(line => { const i=line.indexOf('='); return [line.slice(0,i), line.slice(i+1)] }))
const supabase = createClient(map.NEXT_PUBLIC_SUPABASE_URL, map.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const q1 = await supabase.from('pile_serial').select('serial_id,serial_code,qc_status,disposition_status,loai_coc,ten_doan,chieu_dai_m,lot_id').limit(5)
console.log('pile_serial error', q1.error?.message || null)
console.log('pile_serial rows', q1.data?.length || 0)
const q2 = await supabase.from('production_lot').select('lot_id,lot_code,order_id,loai_coc,ten_doan,chieu_dai_m').limit(5)
console.log('production_lot error', q2.error?.message || null)
console.log('production_lot rows', q2.data?.length || 0)

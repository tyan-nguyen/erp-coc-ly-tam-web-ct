import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync('.env.local','utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim()
const supabase = createClient(url, key)
const countSheetCode = 'KK-TP-20260415-101108'
const headerResp = await supabase.from('inventory_count_sheet').select('count_sheet_id,count_sheet_code,count_type,status,payload_json').eq('count_sheet_code', countSheetCode)
console.log('HEADER_ERR', headerResp.error)
console.dir(headerResp.data, { depth: 6 })
const header = headerResp.data?.[0]
if (!header?.count_sheet_id) process.exit(0)
const lineResp = await supabase.from('inventory_count_line').select('count_line_id,line_no,item_name,system_qty,counted_qty,variance_qty,payload_json').eq('count_sheet_id', header.count_sheet_id).order('line_no')
console.log('LINE_ERR', lineResp.error)
console.dir(lineResp.data, { depth: 8 })
const serialResp = await supabase.from('pile_serial').select('serial_id,serial_code,lot_id,notes,is_active').ilike('notes', '%' + countSheetCode + '%').order('serial_code')
console.log('SERIAL_ERR', serialResp.error)
console.dir(serialResp.data, { depth: 8 })

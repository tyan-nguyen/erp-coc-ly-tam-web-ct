import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const code = process.argv[2]
const { data: sheets, error: sheetError } = await supabase
  .from('inventory_count_sheet')
  .select('count_sheet_id,count_sheet_code,count_type,status,note,payload_json,created_at')
  .eq('count_sheet_code', code)
if (sheetError) throw sheetError
console.log('SHEETS')
console.log(JSON.stringify(sheets, null, 2))
const sheet = sheets?.[0]
if (!sheet) process.exit(0)
const { data: lines, error: lineError } = await supabase
  .from('inventory_count_line')
  .select('count_line_id,line_no,item_name,note,payload_json,system_qty,counted_qty,variance_qty')
  .eq('count_sheet_id', sheet.count_sheet_id)
  .order('line_no', { ascending: true })
if (lineError) throw lineError
console.log('LINES')
console.log(JSON.stringify(lines, null, 2))
const marker = `Mở tồn từ phiếu ${sheet.count_sheet_code}`
const { data: serials, error: serialError } = await supabase
  .from('pile_serial')
  .select('serial_code,lot_id,notes,is_active,lifecycle_status,visible_in_project,visible_in_retail')
  .ilike('notes', `%${marker}%`)
  .order('serial_code', { ascending: true })
if (serialError) throw serialError
console.log('SERIALS')
console.log(JSON.stringify(serials, null, 2))
const lotIds = [...new Set((serials || []).map((row) => row.lot_id).filter(Boolean))]
if (!lotIds.length) process.exit(0)
const { data: lots, error: lotError } = await supabase
  .from('production_lot')
  .select('lot_id,lot_code,production_date,created_at,notes')
  .in('lot_id', lotIds)
  .order('lot_code', { ascending: true })
if (lotError) throw lotError
console.log('LOTS')
console.log(JSON.stringify(lots, null, 2))

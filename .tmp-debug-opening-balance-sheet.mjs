import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const supabase = createClient(url, key)

const sheetId = process.argv[2]
if (!sheetId) {
  console.error('missing sheet id')
  process.exit(1)
}

const { data: sheet, error: sheetError } = await supabase
  .from('inventory_count_sheet')
  .select('count_sheet_id,count_sheet_code,count_type,status,note,payload_json')
  .eq('count_sheet_id', sheetId)
  .maybeSingle()

if (sheetError) {
  console.error('sheetError', sheetError)
  process.exit(1)
}

console.log('SHEET')
console.log(JSON.stringify(sheet, null, 2))

const { data: lines, error: lineError } = await supabase
  .from('inventory_count_line')
  .select('count_line_id,line_no,item_id,item_name,note,payload_json,system_qty,counted_qty,variance_qty')
  .eq('count_sheet_id', sheetId)
  .order('line_no', { ascending: true })

if (lineError) {
  console.error('lineError', lineError)
  process.exit(1)
}

console.log('LINES')
console.log(JSON.stringify(lines, null, 2))

if (!sheet?.count_sheet_code) process.exit(0)

const marker = `Mở tồn từ phiếu ${sheet.count_sheet_code}`
const { data: serials, error: serialError } = await supabase
  .from('pile_serial')
  .select('serial_id,serial_code,lot_id,notes,is_active,lifecycle_status,visible_in_project,visible_in_retail')
  .ilike('notes', `%${marker}%`)
  .order('serial_code', { ascending: true })

if (serialError) {
  console.error('serialError', serialError)
  process.exit(1)
}

console.log('SERIALS')
console.log(JSON.stringify(serials, null, 2))

const lotIds = [...new Set((serials || []).map((row) => row.lot_id).filter(Boolean))]
if (!lotIds.length) process.exit(0)

const { data: lots, error: lotError } = await supabase
  .from('production_lot')
  .select('lot_id,lot_code,production_date,created_at')
  .in('lot_id', lotIds)
  .order('lot_code', { ascending: true })

if (lotError) {
  console.error('lotError', lotError)
  process.exit(1)
}

console.log('LOTS')
console.log(JSON.stringify(lots, null, 2))

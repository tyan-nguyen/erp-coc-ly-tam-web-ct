import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const envRaw = fs.readFileSync('.env.local', 'utf8')
for (const line of envRaw.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (!match) continue
  const key = match[1].trim()
  let value = match[2].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  process.env[key] = value
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const countSheetId = process.argv[2]

const { data: sheet, error: sheetError } = await supabase
  .from('inventory_count_sheet')
  .select('count_sheet_id,count_sheet_code,count_type,status,payload_json')
  .eq('count_sheet_id', countSheetId)
  .single()
console.log('sheetError', sheetError)
console.dir(sheet, { depth: 10 })

const { data: lines, error: lineError } = await supabase
  .from('inventory_count_line')
  .select('count_line_id,line_no,item_name,payload_json')
  .eq('count_sheet_id', countSheetId)
  .order('line_no')
console.log('lineError', lineError)
console.dir(lines, { depth: 10 })

const code = sheet?.count_sheet_code || ''
const { data: serials, error: serialError } = await supabase
  .from('pile_serial')
  .select('serial_code,lot_id,notes,is_active')
  .ilike('notes', `%Mở tồn từ phiếu ${code}%`)
  .order('serial_code')
console.log('serialError', serialError)
console.dir(serials, { depth: 10 })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sheetId = '8747c0fa-65fd-49bb-bc94-29ed9e9c4f9f'
if (!url || !key) {
  console.error('Missing env', { hasUrl: Boolean(url), hasAnon: Boolean(key) })
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: sheet, error: sheetError } = await supabase
  .from('inventory_count_sheet')
  .select('id, count_sheet_code, count_type, status, payload_json, note')
  .eq('id', sheetId)
  .maybeSingle()
console.log('sheetError', sheetError)
console.dir(sheet, { depth: 8 })

const { data: lines, error: linesError } = await supabase
  .from('inventory_count_line')
  .select('id, line_no, payload_json, note, expected_qty, counted_qty, variance_qty')
  .eq('count_sheet_id', sheetId)
  .order('line_no', { ascending: true })
console.log('linesError', linesError)
console.dir(lines, { depth: 10 })

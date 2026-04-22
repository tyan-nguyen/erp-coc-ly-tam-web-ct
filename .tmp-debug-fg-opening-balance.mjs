import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env', {
    hasUrl: Boolean(url),
    hasKey: Boolean(key),
  })
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const sheetId = 'e673497c-fb93-4147-877e-9c034bd72ce6'

const { data: sheet, error: sheetError } = await supabase
  .from('inventory_count_sheet')
  .select('id, count_sheet_code, count_type, status, payload_json, note')
  .eq('id', sheetId)
  .maybeSingle()

if (sheetError) {
  console.error('sheetError', sheetError)
  process.exit(1)
}

console.log('SHEET')
console.dir(sheet, { depth: 8 })

const { data: lines, error: linesError } = await supabase
  .from('inventory_count_line')
  .select('id, line_no, expected_qty, counted_qty, variance_qty, note, payload_json')
  .eq('count_sheet_id', sheetId)
  .order('line_no', { ascending: true })

if (linesError) {
  console.error('linesError', linesError)
  process.exit(1)
}

console.log('\nLINES')
console.dir(lines, { depth: 10 })

if (sheet?.count_sheet_code) {
  const pattern = `%Mở tồn từ phiếu ${sheet.count_sheet_code}%`
  const { data: serials, error: serialsError } = await supabase
    .from('pile_serial')
    .select('id, serial_code, lot_id, notes, is_active')
    .ilike('notes', pattern)
    .order('serial_code', { ascending: true })

  if (serialsError) {
    console.error('serialsError', serialsError)
  } else {
    console.log('\nSERIALS BY NOTE')
    console.dir(serials, { depth: 8 })
  }

  const { data: lots, error: lotsError } = await supabase
    .from('pile_lot')
    .select('id, lot_code, status, notes')
    .ilike('notes', pattern)
    .order('lot_code', { ascending: true })

  if (lotsError) {
    console.error('lotsError', lotsError)
  } else {
    console.log('\nLOTS BY NOTE')
    console.dir(lots, { depth: 8 })
  }
}

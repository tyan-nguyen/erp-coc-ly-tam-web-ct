import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

async function main() {
  const env = fs.readFileSync('/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/.env.local', 'utf8')
  const map = Object.fromEntries(
    env.split(/\n/).filter(Boolean).map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    })
  )
  const supabase = createClient(map.NEXT_PUBLIC_SUPABASE_URL, map.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const id = 'e673497c-fb93-4147-877e-9c034bd72ce6'

  const { data: header, error: headerError } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, status, payload_json, note')
    .eq('count_sheet_id', id)
    .maybeSingle()
  console.log('HEADER', headerError || header)

  const { data: lines, error: lineError } = await supabase
    .from('inventory_count_line')
    .select('count_line_id, line_no, item_name, note, payload_json, counted_qty')
    .eq('count_sheet_id', id)
    .order('line_no', { ascending: true })
  console.log('LINES', lineError || lines)

  if (header?.count_sheet_code) {
    const pattern = '%Mở tồn từ phiếu ' + header.count_sheet_code + '%'
    const { data: serials, error: serialError } = await supabase
      .from('pile_serial')
      .select('serial_code, notes, lot_id, is_active')
      .ilike('notes', pattern)
      .eq('is_active', true)
    console.log('SERIALS_BY_NOTE', serialError || serials)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

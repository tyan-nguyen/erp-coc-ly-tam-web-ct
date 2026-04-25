import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const envRaw = fs.readFileSync('.env.local', 'utf8')
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (!m) continue
  const key = m[1].trim()
  let value = m[2].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1)
  process.env[key] = value
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const code = process.argv[2]
const { data, error } = await supabase
  .from('inventory_count_sheet')
  .select('count_sheet_id,count_sheet_code,count_type,status,payload_json')
  .eq('count_sheet_code', code)
console.log('error', error)
console.dir(data, { depth: 10 })

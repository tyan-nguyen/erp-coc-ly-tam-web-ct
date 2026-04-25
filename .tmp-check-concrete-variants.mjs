import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local','utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const supabase = createClient(url,key)
const { data, error } = await supabase.from('dm_capphoi_bt').select('*').eq('is_active', true).limit(50)
if (error) {
  console.error('ERR', error)
  process.exit(1)
}
const rows = data ?? []
const grouped = new Map()
for (const row of rows) {
  const grade = String(row.mac_be_tong || '')
  const variant = String(row.variant || row.cap_phoi_variant || row.loai_cap_phoi || '').trim() || '<<empty>>'
  const key = `${grade}__${variant}`
  grouped.set(key, (grouped.get(key) || 0) + 1)
}
console.log(JSON.stringify({count: rows.length, samples: rows.slice(0,10), grouped: [...grouped.entries()].slice(0,30)}, null, 2))

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local','utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const supabase = createClient(url,key)
const sqls = [
  `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='dm_capphoi_bt' order by indexname`,
  `select conname, pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_class t on c.conrelid=t.oid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='dm_capphoi_bt' order by conname`
]
for (const q of sqls) {
  const { data, error } = await supabase.rpc('exec_sql', { sql: q })
  console.log('QUERY', q)
  if (error) console.log('ERROR', error)
  else console.log(JSON.stringify(data, null, 2))
}

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const s = line.trim()
  if (!s || s.startsWith('#')) continue
  const i = s.indexOf('=')
  if (i > 0) env[s.slice(0, i)] = s.slice(i + 1)
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error: signErr } = await sb.auth.signInWithPassword({
  email: 'admin.dev@nguyentrinh.com.vn',
  password: 'Duyyquang181216',
})
if (signErr) {
  console.error('signin error', signErr.message)
  process.exit(1)
}

const tables = [
  'dm_kh','dm_duan','dm_ncc','nvl','gia_nvl','dm_coc_template','dm_dinh_muc_phu_md','dm_capphoi_bt'
]

for (const t of tables) {
  const { data, error } = await sb
    .from('information_schema.columns')
    .select('column_name,is_nullable,data_type,column_default')
    .eq('table_schema', 'public')
    .eq('table_name', t)
    .order('ordinal_position', { ascending: true })

  console.log('\nTABLE', t)
  if (error) {
    console.log('ERROR', error.message)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

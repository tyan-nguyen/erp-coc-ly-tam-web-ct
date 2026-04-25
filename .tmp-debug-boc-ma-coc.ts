import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8')
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([^#=]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => {
      const [, key, value] = match as RegExpMatchArray
      return [key.trim(), value.trim().replace(/^['"]|['"]$/g, '')] as const
    })
  return Object.fromEntries(entries)
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('boc_tach_nvl')
    .select('*')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    console.error(JSON.stringify({ error: error.message }, null, 2))
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      (data ?? []).map((row) => ({
        id: row.boc_id ?? row.boc_tach_id ?? row.id,
        da_id: row.da_id,
        ma_coc: row.ma_coc,
        loai_coc: row.loai_coc,
        mac_be_tong: row.mac_be_tong,
        do_ngoai: row.do_ngoai,
        chieu_day: row.chieu_day,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

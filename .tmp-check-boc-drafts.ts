import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
const entries = raw
  .split(/\n+/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const idx = line.indexOf('=')
    return [line.slice(0, idx), line.slice(idx + 1)]
  })

const vars = Object.fromEntries(entries)
const url = vars.NEXT_PUBLIC_SUPABASE_URL
const key = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing Supabase env')
}

async function main() {
  const supabase = createClient(url, key)

  const { data, error } = await supabase
    .from('boc_tach_nvl')
    .select('boc_id, da_id, kh_id, loai_coc, trang_thai, created_at, updated_at, ghi_chu')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  console.log(JSON.stringify(data, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

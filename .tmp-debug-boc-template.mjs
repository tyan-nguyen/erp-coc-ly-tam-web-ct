import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf8')
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (!match) continue
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const EMAIL = 'admin.dev@nguyentrinh.com.vn'
const PASSWORD = 'Duyyquang181216'

const signIn = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (signIn.error) throw signIn.error

const { data: projects, error: projectError } = await supabase
  .from('dm_duan')
  .select('*')
  .eq('is_active', true)
  .order('updated_at', { ascending: false })
  .limit(10)
if (projectError) throw projectError

console.log('PROJECT_KEYS', projects?.[0] ? Object.keys(projects[0]) : [])
console.log('PROJECT_SAMPLE', JSON.stringify(projects?.slice(0, 5), null, 2))

const { data: bocs, error: bocError } = await supabase
  .from('boc_tach_nvl')
  .select('boc_id, da_id, kh_id, loai_coc, trang_thai, ghi_chu, updated_at, created_at')
  .in('trang_thai', ['DA_DUYET_QLSX', 'DA_GUI', 'TRA_LAI', 'NHAP'])
  .order('updated_at', { ascending: false })
  .limit(10)
if (bocError) throw bocError

const parsed = (bocs || []).map((row) => {
  const raw = String(row.ghi_chu || '')
  let meta = null
  if (raw.startsWith('ERP_BOC_META::')) {
    try { meta = JSON.parse(raw.slice('ERP_BOC_META::'.length)) } catch {}
  }
  return {
    boc_id: row.boc_id,
    da_id: row.da_id,
    loai_coc: row.loai_coc,
    trang_thai: row.trang_thai,
    updated_at: row.updated_at,
    profit_pct: meta?.profit_pct,
    tax_pct: meta?.tax_pct,
    meta_keys: meta ? Object.keys(meta) : [],
  }
})

console.log('BOCS', JSON.stringify(parsed, null, 2))

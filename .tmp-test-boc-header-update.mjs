import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const bocId = '1514dc4d-f5c7-4efb-b470-dca40e144fb4'
const env = {}
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const s=line.trim(); if(!s||s.startsWith('#')) continue; const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)
}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const { error: signErr, data } = await sb.auth.signInWithPassword({ email:'admin.dev@nguyentrinh.com.vn', password:'Duyyquang181216' })
if (signErr) { console.error('signin error', signErr.message); process.exit(1) }
console.log('auth uid', data.user?.id)
const before = await sb.from('boc_tach_nvl').select('boc_id,trang_thai,ghi_chu,created_by').eq('boc_id', bocId).maybeSingle()
console.log('before', JSON.stringify(before.data, null, 2), before.error?.message || '')

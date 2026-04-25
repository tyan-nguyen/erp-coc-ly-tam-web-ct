import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

for (const t of ['gia_nvl','dm_dinh_muc_phu_md','dm_capphoi_bt']) {
  const {data,error}=await sb.from(t).select('*').order('created_at',{ascending:false}).limit(3)
  console.log('\n',t,'err',error&&error.message)
  console.log(JSON.stringify(data,null,2))
}

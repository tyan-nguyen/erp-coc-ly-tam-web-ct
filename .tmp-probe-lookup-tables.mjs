import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const tables=['dm_nhom_kh','dm_nhomkh','dm_loai_kh','dm_khach_hang_nhom','dm_nhom_nvl','dm_nhom_hang','dm_loai_ncc','dm_nhom_d','dm_loai_coc','dm_mac_be_tong']
for(const t of tables){
 const {data,error}=await sb.from(t).select('*').limit(10)
 console.log('\n',t,'err=',error&&error.message)
 if(!error) console.log(JSON.stringify(data,null,2))
}

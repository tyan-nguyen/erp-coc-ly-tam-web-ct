import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

for (const [table,payload] of [
 ['dm_kh',{ten_kh:'ZZ_OMIT_KH'}],
 ['dm_ncc',{ten_ncc:'ZZ_OMIT_NCC'}],
 ['nvl',{ten_hang:'ZZ_OMIT_NVL',dvt:'kg'}],
 ['dm_coc_template',{loai_coc:'PHC',do_ngoai:600,chieu_day:100}],
 ['dm_dinh_muc_phu_md',{nhom_d:'X'}],
 ['dm_capphoi_bt',{mac_be_tong:'B40',nvl_id:'1'}],
 ]) {
   const {data,error}=await sb.from(table).insert(payload).select('*').maybeSingle()
   console.log('\n',table,'err=',error&&error.message)
   console.log('data=',data)
 }

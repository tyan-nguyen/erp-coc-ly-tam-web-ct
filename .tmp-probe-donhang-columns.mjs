import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const cands=['id','don_hang_id','dh_id','ma_don_hang','ma_dh','boc_id','boc_tach_id','boc_tach_nvl_id','trang_thai','tong_tien','created_at','updated_at','created_by','updated_by','ghi_chu']
for(const c of cands){
  const {error}=await sb.from('don_hang').select(c).limit(1)
  if(!error) console.log('YES',c)
}

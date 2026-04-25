import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const {data:nvl}=await sb.from('nvl').select('nvl_id').limit(1)
const nvlId=nvl?.[0]?.nvl_id
const ins=await sb.from('gia_nvl').insert({nvl_id:nvlId,don_gia:111111}).select('*').maybeSingle()
console.log('err',ins.error&&ins.error.message)
console.log('data',ins.data)
const all=await sb.from('gia_nvl').select('*').limit(3)
console.log('count',all.data?.length,'selectErr',all.error&&all.error.message)
if(all.data?.length) console.log(all.data[0])

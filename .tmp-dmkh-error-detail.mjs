import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const {data,error,status,statusText}=await sb.from('dm_kh').insert({ten_kh:'ZZ_DETAIL',nhom_kh:'X',is_active:true,deleted_at:null}).select('*')
console.log('status',status,statusText)
console.log('data',data)
console.log('error',error)

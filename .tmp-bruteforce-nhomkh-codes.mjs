import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const vals=['KHDN','KHCN','KHDA','KHTM','KHNB','KHNN','KHTN','DN','CN','DA','TM','NB','TN','NN','XD','CT','DL','NCC','KHAC','OTH','OTHER','GR1','GR2','GR3','G1','G2','G3','NH1','NH2','NH3','TYPE1','TYPE2']
for (const v of vals){
  const {error,data}=await sb.from('dm_kh').insert({ten_kh:`ZZ_${Date.now()}`,nhom_kh:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(!error){console.log('VALID',v,JSON.stringify(data));process.exit(0)}
}
console.log('NO_MATCH')

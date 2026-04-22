import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const vals=['Khac','KHAC','Khách lẻ','Khách sỉ','Khách dự án','Khách cá nhân','Khách doanh nghiệp','Nội bộ','Bên ngoài','Trong nước','Nước ngoài','Nhà thầu','Chủ đầu tư','Đại lý','Thương mại','Xây dựng','Công nghiệp','Dân dụng','A','B','C']
for (const v of vals){
 const {error,data}=await sb.from('dm_kh').insert({ten_kh:`ZZ_${Date.now()}`,nhom_kh:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
 if(!error){console.log('VALID',v,JSON.stringify(data));process.exit(0)}
 console.log(v,'=>',error.message)
}
console.log('NO_MATCH')

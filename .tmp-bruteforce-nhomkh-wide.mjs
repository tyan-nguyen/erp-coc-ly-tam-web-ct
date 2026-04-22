import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

const bases=[
  'CA_NHAN','DOANH_NGHIEP','CONG_TY','NHA_NUOC','TU_NHAN','DU_AN','THUONG_MAI','NHA_THAU','CHU_DAU_TU','DAI_LY','NOI_BO','KHAC',
  'LE','SI','VIP','THUONG','TRONG_NUOC','NUOC_NGOAI','NCC','KH',
  'GROUP_A','GROUP_B','GROUP_C','NHOM_A','NHOM_B','NHOM_C','NHOM_1','NHOM_2','NHOM_3',
  'A','B','C','D','1','2','3'
]

const variants=new Set()
for(const b of bases){
  variants.add(b)
  variants.add(b.toLowerCase())
  variants.add(b.replaceAll('_',''))
  variants.add(b.replaceAll('_','-'))
}

for(const v of variants){
  const {error,data}=await sb.from('dm_kh').insert({ten_kh:`ZZ_KH_${Date.now()}`,nhom_kh:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(!error){
    console.log('VALID',v,JSON.stringify(data))
    process.exit(0)
  }
}

console.log('NO_MATCH',variants.size)

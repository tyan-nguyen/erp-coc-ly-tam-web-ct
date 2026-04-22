import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const s=line.trim(); if(!s||s.startsWith('#')) continue
  const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)
}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
const {error}=await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
if(error){console.error(error.message);process.exit(1)}

const candidates=[
 'XAY_DUNG','NHA_THAU','CHU_DAU_TU','DAI_LY','BAN_LE','CONG_TRINH','DU_AN','TU_NHAN','DOANH_NGHIEP','CA_NHAN','KHACH_HANG','KHAC',
 'TRONG_NUOC','NUOC_NGOAI','VIP','THUONG','NORMAL','RETIAL','RETAIL','WHOLESALE','B2B','B2C','LE','SI',
 'KH_DOANH_NGHIEP','KH_CA_NHAN','KH_NOI_BO','KH_NGOAI_BO','NCC','NHA_CUNG_CAP','CAP_1','CAP_2','A','B','C','D',
 'nhom_1','nhom_2','NHOM_1','NHOM_2','NHOM_A','NHOM_B','NHOM_C','NHOM_D'
]

for (const v of candidates){
  const {error} = await sb.from('dm_kh').insert({ten_kh:`ZZ_ENUM_${Date.now()}`,nhom_kh:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(!error){
    console.log('VALID',v)
    process.exit(0)
  }
}
console.log('NO_MATCH')

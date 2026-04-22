import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const s=line.trim(); if(!s||s.startsWith('#')) continue
  const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)
}

const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
const {error:signErr}=await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
if(signErr){console.error('signin',signErr.message);process.exit(1)}

const nhomKhCandidates=['LE','SI','NHA_NUOC','TU_NHAN','CA_NHAN','DOANH_NGHIEP','NOI_BO','KHAC','A','B','C','VIP','NORMAL','THUONG','NCC','KH']
const loaiNccCandidates=['THEP','BE_TONG','PHU_GIA','PHU_KIEN','VAN_CHUYEN','DICH_VU','KHAC','NOI_DIA','NHAP_KHAU','A','B','C','NCC']

async function test(table, basePayload, field, values){
  for (const v of values){
    const payload={...basePayload,[field]:v}
    const {error}=await sb.from(table).insert(payload).select('*').maybeSingle()
    if(!error){
      console.log(table,field,'VALID',v)
      return v
    }
    if(!error.message.includes('check constraint')){
      console.log(table,field,'candidate',v,'=>',error.message)
    }
  }
  console.log(table,field,'NO_MATCH')
  return null
}

await test('dm_kh',{ten_kh:`ZZ_ENUM_KH_${Date.now()}`,is_active:true,deleted_at:null},'nhom_kh',nhomKhCandidates)
await test('dm_ncc',{ten_ncc:`ZZ_ENUM_NCC_${Date.now()}`,is_active:true,deleted_at:null},'loai_ncc',loaiNccCandidates)

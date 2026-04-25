import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

const dmKhCandidates=[
 'A','B','C','D','1','2','3','KHAC','NOI_BO','THUONG_MAI','XAY_LAP','DU_AN','TU_NHAN','NHA_NUOC','DOANH_NGHIEP','CA_NHAN','VIP','THUONG','LE','SI',
 'CAP_1','CAP_2','CAP_3','NHOM_1','NHOM_2','NHOM_3','NHOM_A','NHOM_B','NHOM_C',
 'TRONG_NUOC','NUOC_NGOAI','NHA_THAU','CHU_DAU_TU','DAI_LY','PHAN_PHOI'
]

const nvlNhomCandidates=[
 'CAP_PHOI_BT','THEP','PHU_GIA','PHU_KIEN','VAN_CHUYEN','KHAC',
 'NVL_CHINH','NVL_PHU','NHIEN_LIEU','BAO_BI','DICH_VU',
 'A','B','C','BT','STEEL'
]

async function findDmKh(){
  for(const v of dmKhCandidates){
    const {error}=await sb.from('dm_kh').insert({ten_kh:`ZZ_KH_${Date.now()}`,nhom_kh:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
    if(!error){console.log('dm_kh valid nhom_kh=',v);return}
    if(!error.message.includes('check constraint')){console.log('dm_kh',v,'=>',error.message)}
  }
  console.log('dm_kh no candidate valid')
}

async function findNvl(){
  for(const v of nvlNhomCandidates){
    const {error,data}=await sb.from('nvl').insert({ten_hang:`ZZ_NVL_${Date.now()}`,dvt:'kg',nhom_hang:v,is_active:true,deleted_at:null}).select('*').maybeSingle()
    if(!error){console.log('nvl valid nhom_hang=',v,'row=',JSON.stringify(data));return}
    if(!error.message.includes('check constraint')){console.log('nvl',v,'=>',error.message)}
  }
  console.log('nvl no candidate valid')
}

await findDmKh()
await findNvl()

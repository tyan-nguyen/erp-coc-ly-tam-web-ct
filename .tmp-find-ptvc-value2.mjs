import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})
const kh=(await sb.from('dm_kh').insert({ten_kh:`ZZKH_${Date.now()}`,nhom_kh:'TIEM_NANG',is_active:true,deleted_at:null}).select('*').maybeSingle()).data
const da=(await sb.from('dm_duan').insert({ten_da:`ZZDA_${Date.now()}`,kh_id:kh.kh_id,is_active:true,deleted_at:null}).select('*').maybeSingle()).data

const base=['ROAD_WITH_CRANE','ROAD_NO_CRANE','OTHER','DUONG_BO_CAU','DUONG_BO_KHONG_CAU','CO_CAU','KHONG_CAU','WITH_CRANE','NO_CRANE','HUONG_1','HUONG_2']
const vals=new Set()
for(const b of base){vals.add(b);vals.add(b.toLowerCase());vals.add(b.replaceAll('_',' '));vals.add(b.replaceAll('_','-'));vals.add(b.toLowerCase().replaceAll('_','-'))}
for(const v of vals){
  const payload={da_id:da.da_id,kh_id:kh.kh_id,loai_coc:'PHC',do_ngoai:600,chieu_day:100,mac_be_tong:'B40',ghi_chu:'probe',loai_thep:'PC',phuong_thuc_van_chuyen:v,trang_thai:'NHAP',to_hop_doan:[],tong_gia_nvl:0,tong_gia_pk:0,phi_van_chuyen:0,tong_du_toan:0}
  const {data,error}=await sb.from('boc_tach_nvl').insert(payload).select('*').maybeSingle()
  if(!error){console.log('VALID',v,'id',data?.boc_id);process.exit(0)}
}
console.log('NO_MATCH',vals.size)

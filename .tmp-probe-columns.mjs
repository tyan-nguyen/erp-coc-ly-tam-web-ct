import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

async function probe(table, cols){
  for(const col of cols){
    const {error}=await sb.from(table).select(col).limit(1)
    console.log(table,col,error?`NO (${error.message})`:'YES')
  }
}
await probe('dm_kh',['kh_id','ma_kh','ten_kh','nhom_kh','nhom_kh_label','is_active','deleted_at','created_at','updated_at'])
await probe('dm_duan',['da_id','ma_da','ten_da','kh_id','is_active','deleted_at'])
await probe('gia_nvl',['gia_id','nvl_id','gia','tu_ngay','den_ngay','is_active','deleted_at'])
await probe('dm_coc_template',['coc_template_id','loai_coc','mac_be_tong','do_ngoai','chieu_day','is_active','deleted_at'])
await probe('dm_dinh_muc_phu_md',['dinh_muc_id','nvl_id','nhom_d','rate_per_md','is_active','deleted_at','md'])
await probe('dm_capphoi_bt',['capphoi_id','nvl_id','mac_be_tong','ti_le','is_active','deleted_at'])

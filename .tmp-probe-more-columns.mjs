import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

async function test(table,cands){
  console.log('\nTABLE',table)
  for(const c of cands){
    const {error}=await sb.from(table).select(c).limit(1)
    if(!error) console.log('YES',c)
  }
}
await test('gia_nvl',['id','gia_id','gia_nvl_id','bang_gia_id','nvl_id','don_gia','don_gia_vnd','gia_hien_hanh','gia_tri','hieu_luc_tu','hieu_luc_den','ngay_ap_dung','created_at','updated_at'])
await test('dm_coc_template',['id','template_id','coc_template_id','ma_template','ma_coc','loai_coc','mac_be_tong','do_ngoai','chieu_day','pc_dia_mm','pc_nos','dai_dia_mm','buoc_dia_mm','dtam_mm','is_active','deleted_at'])
await test('dm_dinh_muc_phu_md',['id','dinh_muc_id','dmp_id','nvl_id','nhom_d','don_vi','dvt','dinh_muc','ty_le','he_so','so_luong','rate','muc_tieu','is_active','deleted_at'])
await test('dm_capphoi_bt',['id','capphoi_id','capphoi_bt_id','nvl_id','mac_be_tong','dinh_muc','ty_le','he_so','so_luong','kg_m3','don_vi','dvt','ghi_chu','is_active','deleted_at'])

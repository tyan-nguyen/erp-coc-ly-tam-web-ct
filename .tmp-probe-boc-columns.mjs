import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env={}
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:'admin.dev@nguyentrinh.com.vn',password:'Duyyquang181216'})

async function probe(table,cands){
  console.log('\nTABLE',table)
  for(const c of cands){
    const {error}=await sb.from(table).select(c).limit(1)
    if(!error) console.log('YES',c)
  }
}
await probe('boc_tach_nvl',['boc_id','boc_tach_id','id','ma_boc_tach','ma_bt','da_id','kh_id','loai_coc','do_ngoai','chieu_day','mac_be_tong','ten_boc_tach','ten_pa','ghi_chu','loai_thep','phuong_thuc_van_chuyen','trang_thai','to_hop_doan','tong_gia_nvl','tong_gia_pk','phi_van_chuyen','tong_du_toan','thong_so_ky_thuat','gui_qlsx_at','gui_qlsx_by','created_at','updated_at'])
await probe('boc_tach_nvl_items',['id','item_id','boc_id','boc_tach_id','boc_tach_nvl_id','nvl_id','so_luong','dvt','don_gia','thanh_tien','loai_nvl'])
await probe('boc_tach_seg_nvl',['id','seg_id','boc_id','boc_tach_id','boc_tach_nvl_id','ten_doan','so_luong_doan','the_tich_m3','dinh_muc_nvl','tong_nvl'])
await probe('don_hang',['id','don_hang_id','ma_don_hang','boc_tach_nvl_id','boc_tach_id','created_by'])

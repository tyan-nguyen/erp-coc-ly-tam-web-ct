import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'
const candidates=['D1','DOAN1','DOAN_1','DOAN_THAN','THAN','MUI','A1','A2','A3','B1','B2','B3','C1','C2','C3','Doan than','Doan mui','Than','Mui']

function loadEnv(){
  const env={}
  for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
    const s=line.trim(); if(!s||s.startsWith('#')) continue
    const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)
  }
  return env
}

async function createFixtures(sb){
  const seed=Date.now().toString().slice(-6)
  const {data:kh,error:khErr}=await sb.from('dm_kh').insert({ten_kh:`ZZ_BOC_KH_${seed}`,nhom_kh:'TIEM_NANG',is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(khErr) throw new Error(`kh: ${khErr.message}`)
  const {data:da,error:daErr}=await sb.from('dm_duan').insert({ten_da:`ZZ_BOC_DA_${seed}`,kh_id:kh.kh_id,is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(daErr) throw new Error(`da: ${daErr.message}`)
  const {data:nvl,error:nvlErr}=await sb.from('nvl').insert({ten_hang:`ZZ_BOC_NVL_${seed}`,dvt:'kg',nhom_hang:'THEP',is_active:true,deleted_at:null}).select('*').maybeSingle()
  if(nvlErr) throw new Error(`nvl: ${nvlErr.message}`)
  return {kh,da,nvl,seed}
}

function payload(fixtures, tenDoan){
  return {
    action:'save',
    payload:{
      header:{
        da_id:fixtures.da.da_id,
        kh_id:fixtures.kh.kh_id,
        loai_coc:'PHC',
        do_ngoai:600,
        chieu_day:100,
        mac_be_tong:'B40',
        ten_boc_tach:`ZZ_BOC_${fixtures.seed}_${tenDoan}`,
        loai_thep:'PC',
        phuong_thuc_van_chuyen:'ROAD_WITH_CRANE',
        trang_thai:'NHAP',
        do_mm:600,
        t_mm:100,
        pc_dia_mm:7.1,
        pc_nos:6,
        dai_dia_mm:3.2,
        buoc_dia_mm:1,
        dtam_mm:300,
        sigma_cu:80,
        sigma_pu:1860,
        sigma_py:1670,
        r:0.7,
        k:0.2,
        ep:200000,
        md_per_tim:12,
        total_md:120,
        don_gia_van_chuyen:0,
      },
      items:[
        {nvl_id:fixtures.nvl.nvl_id,ten_nvl:'A',loai_nvl:'CAP_PHOI_BT',so_luong:10,dvt:'kg',don_gia:1000},
        {nvl_id:fixtures.nvl.nvl_id,ten_nvl:'B',loai_nvl:'THEP',so_luong:20,dvt:'kg',don_gia:2000},
      ],
      segments:[
        {ten_doan:tenDoan,len_m:6,cnt:1,so_luong_doan:1,the_tich_m3:0,v1:10,v2:5,v3:2,mui_segments:1,dai_kep_chi_a1:false},
      ]
    }
  }
}

async function main(){
  const env=loadEnv()
  const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const sign=await sb.auth.signInWithPassword({email:EMAIL,password:PASSWORD})
  if(sign.error) throw sign.error
  const fixtures=await createFixtures(sb)

  const browser=await chromium.launch({headless:true})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()

  await page.goto(`${BASE}/login`,{waitUntil:'networkidle'})
  await page.fill('input[type="email"]',EMAIL)
  await page.fill('input[type="password"]',PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'),{timeout:20000})

  for (const c of candidates){
    const res=await page.evaluate(async ({base, body})=>{
      const r=await fetch(`${base}/api/boc-tach/boc-tach-nvl/new`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const t=await r.text()
      return {status:r.status,text:t}
    }, {base: BASE, body: payload(fixtures, c)})
    console.log(c, res.status, res.text)
    if (res.status===200 && res.text.includes('"ok":true')) {
      break
    }
  }

  await ctx.close(); await browser.close()
}

main().catch((e)=>{console.error(e); process.exit(1)})

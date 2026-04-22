import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const BASE='http://localhost:3010'; const EMAIL='admin.dev@nguyentrinh.com.vn'; const PASSWORD='Duyyquang181216'
const env={}; for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i>0)env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:EMAIL,password:PASSWORD})
const seed=Date.now().toString().slice(-6)
const kh=(await sb.from('dm_kh').insert({ten_kh:`ZZ_BOC_KH_${seed}`,nhom_kh:'TIEM_NANG',is_active:true,deleted_at:null}).select('*').maybeSingle()).data
const da=(await sb.from('dm_duan').insert({ten_da:`ZZ_BOC_DA_${seed}`,kh_id:kh.kh_id,is_active:true,deleted_at:null}).select('*').maybeSingle()).data
const nvl=(await sb.from('nvl').insert({ten_hang:`ZZ_BOC_NVL_${seed}`,dvt:'kg',nhom_hang:'THEP',is_active:true,deleted_at:null}).select('*').maybeSingle()).data

const browser=await chromium.launch({headless:true}); const ctx=await browser.newContext(); const page=await ctx.newPage()
await page.goto(`${BASE}/login`); await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASSWORD); await page.click('button[type="submit"]'); await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))
await page.goto(`${BASE}/boc-tach/boc-tach-nvl/new`,{waitUntil:'networkidle'})
await page.getByLabel('da_id').fill(da.da_id)
await page.getByLabel('kh_id').fill(kh.kh_id)
await page.getByLabel('Loai coc').fill('PHC')
await page.getByLabel('Mac be tong').fill('B40')
await page.getByLabel('Ten boc tach').fill(`ZZ_BOC_${seed}`)
await page.getByLabel('Loai thep').fill('PC')
await page.getByRole('button',{name:'Vat tu'}).click()
await page.locator('textarea').first().fill(JSON.stringify([
{nvl_id:nvl.nvl_id,ten_nvl:'A',loai_nvl:'CAP_PHOI_BT',so_luong:10,dvt:'kg',don_gia:1000},
{nvl_id:nvl.nvl_id,ten_nvl:'B',loai_nvl:'THEP',so_luong:20,dvt:'kg',don_gia:2000},
],null,2))
await page.getByRole('button',{name:'Chi tiet tinh'}).click()
await page.locator('textarea').first().fill(JSON.stringify([{ten_doan:'D1',len_m:6,cnt:1,so_luong_doan:1,the_tich_m3:0,v1:10,v2:5,v3:2,mui_segments:1,dai_kep_chi_a1:false}],null,2))
await page.getByRole('button',{name:/^Luu$/}).click(); await page.waitForTimeout(1500)
console.log('url',page.url())
const body=(await page.textContent('body'))||''
console.log('has Da luu',body.includes('Da luu boc tach'))
console.log('err snippet',body.includes('Khong xu ly duoc')||body.includes('Khong luu duoc')||body.includes('null value')||body.includes('violates'))
console.log('body tail',body.slice(-600))
await ctx.close(); await browser.close()

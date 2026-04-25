import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const BASE='http://localhost:3010'; const EMAIL='admin.dev@nguyentrinh.com.vn'; const PASSWORD='Duyyquang181216'
const env={}; for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const s=l.trim(); if(!s||s.startsWith('#')) continue; const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
await sb.auth.signInWithPassword({email:EMAIL,password:PASSWORD})
const browser=await chromium.launch({headless:true}); const ctx=await browser.newContext(); const page=await ctx.newPage()
await page.goto(`${BASE}/login`); await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASSWORD); await page.click('button[type="submit"]'); await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))

const seed=Date.now().toString().slice(-6)
await page.goto(`${BASE}/master-data/dm-ncc`,{waitUntil:'networkidle'})
const createBox=page.locator('div.rounded-2xl').filter({hasText:'Tao moi'}).first()
const p=JSON.parse(await createBox.locator('textarea[name="payload"]').inputValue())
p.ten_ncc=`ZZ_DBG_NCC_${seed}`
await createBox.locator('textarea[name="payload"]').fill(JSON.stringify(p,null,2))
await createBox.getByRole('button',{name:'Tao ban ghi'}).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
console.log('create url',page.url())
const rows=(await sb.from('dm_ncc').select('*').eq('ten_ncc',`ZZ_DBG_NCC_${seed}`)).data
console.log('created rows',rows?.length,rows?.[0]?.ncc_id)
const row=rows?.[0]

await page.goto(`${BASE}/master-data/dm-ncc?q=${encodeURIComponent(`ZZ_DBG_NCC_${seed}`)}`,{waitUntil:'networkidle'})
const tr=page.locator('tr',{hasText:`ZZ_DBG_NCC_${seed}`}).first(); await tr.getByRole('link',{name:'Sua'}).click(); await page.waitForLoadState('networkidle')
const editBox=page.locator('div.rounded-2xl').filter({hasText:'Cap nhat'}).first()
const ep=JSON.parse(await editBox.locator('textarea[name="payload"]').inputValue())
ep.ten_ncc=`ZZ_DBG_NCC_${seed}_ED`
await editBox.locator('textarea[name="payload"]').fill(JSON.stringify(ep,null,2))
await editBox.getByRole('button',{name:'Luu thay doi'}).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
console.log('edit url',page.url())
const afterEdit=(await sb.from('dm_ncc').select('*').eq('ncc_id',row.ncc_id)).data?.[0]
console.log('after edit ten',afterEdit?.ten_ncc,'is_active',afterEdit?.is_active,'deleted_at',afterEdit?.deleted_at)

await page.goto(`${BASE}/master-data/dm-ncc?q=${encodeURIComponent(`ZZ_DBG_NCC_${seed}_ED`)}`,{waitUntil:'networkidle'})
const tr2=page.locator('tr',{hasText:`ZZ_DBG_NCC_${seed}_ED`}).first(); await tr2.getByRole('button',{name:'Xoa mem'}).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
console.log('delete url',page.url())
const afterDel=(await sb.from('dm_ncc').select('*').eq('ncc_id',row.ncc_id)).data?.[0]
console.log('after del ten',afterDel?.ten_ncc,'is_active',afterDel?.is_active,'deleted_at',afterDel?.deleted_at)

await ctx.close(); await browser.close()

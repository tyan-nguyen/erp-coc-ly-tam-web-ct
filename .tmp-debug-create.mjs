import { chromium } from 'playwright'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

const payload={ten_kh:'ZZ_DBG_KH',nhom_kh:'SMOKE',is_active:true,deleted_at:null}

const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()
await page.goto(`${BASE}/login`)
await page.fill('input[type="email"]',EMAIL)
await page.fill('input[type="password"]',PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))
await page.goto(`${BASE}/master-data/dm-kh`,{waitUntil:'networkidle'})
const createBox=page.locator('div.rounded-2xl').filter({hasText:'Tao moi'}).first()
await createBox.locator('textarea[name="payload"]').fill(JSON.stringify(payload,null,2))
await createBox.getByRole('button',{name:'Tao ban ghi'}).click()
await page.waitForLoadState('networkidle')
console.log('URL',page.url())
const txt=(await page.textContent('body'))||''
console.log('BODY_SNIPPET',txt.slice(0,800))
await ctx.close(); await browser.close()

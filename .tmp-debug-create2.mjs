import { chromium } from 'playwright'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

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
const ta=createBox.locator('textarea[name="payload"]')
console.log('before',await ta.inputValue())
await ta.fill('{"ten_kh":"ZZ_DBG_KH2","nhom_kh":"SMOKE","is_active":true,"deleted_at":null}')
console.log('after',await ta.inputValue())
console.log('table',await createBox.locator('input[name="table_name"]').inputValue())
console.log('base',await createBox.locator('input[name="base_path"]').inputValue())
await Promise.all([
  page.waitForLoadState('networkidle'),
  createBox.getByRole('button',{name:'Tao ban ghi'}).click(),
])
console.log('url1',page.url())
await page.waitForTimeout(1500)
console.log('url2',page.url())
console.log('body has msg?',((await page.textContent('body'))||'').includes('Tao moi thanh cong'))
console.log('body has err?',((await page.textContent('body'))||'').includes('Bang khong duoc phep')||((await page.textContent('body'))||'').includes('err'))
await ctx.close(); await browser.close()

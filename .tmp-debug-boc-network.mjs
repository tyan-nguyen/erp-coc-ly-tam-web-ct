import { chromium } from 'playwright'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()

page.on('requestfailed', (req) => {
  console.log('REQ FAILED', req.method(), req.url(), req.failure()?.errorText)
})
page.on('response', async (res) => {
  const url = res.url()
  if (url.includes('/auth/v1/token') || url.includes('/login') || url.includes('/api/')) {
    let text = ''
    try { text = await res.text() } catch {}
    console.log('RESP', res.status(), url, text.slice(0, 500))
  }
})
page.on('console',(m)=>console.log('CONSOLE',m.type(),m.text()))
page.on('pageerror',(e)=>console.log('PAGEERROR',e.message))

await page.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'})
await page.fill('input[type="email"]',EMAIL)
await page.fill('input[type="password"]',PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(4000)
console.log('after login url', page.url())

const err = await page.locator('p').allTextContents().catch(()=>[])
console.log('p texts', err)

await ctx.close(); await browser.close()

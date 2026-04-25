import { chromium } from 'playwright'

const BASE = 'http://localhost:3010'
const EMAIL = 'admin.dev@nguyentrinh.com.vn'
const PASSWORD = 'Duyyquang181216'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
  if (!new URL(page.url()).pathname.startsWith('/dashboard')) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await login(page)
await page.goto(`${BASE}/boc-tach/boc-tach-nvl/new`, { waitUntil: 'networkidle' })
const checks = {
  title: await page.locator('text=Lap du toan coc ly tam').isVisible(),
  project: await page.locator('text=Thong tin du an').isVisible(),
  pile: await page.locator('text=Thong so coc').isVisible(),
  segments: await page.locator('text=To hop doan coc').isVisible(),
  tabs: await page.locator('text=Tong hop vat tu').isVisible(),
}
console.log(JSON.stringify(checks, null, 2))
await browser.close()

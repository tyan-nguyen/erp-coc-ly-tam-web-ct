import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const s = line.trim()
  if (!s || s.startsWith('#')) continue
  const i = s.indexOf('=')
  if (i > 0) env[s.slice(0, i)] = s.slice(i + 1)
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function login(page) {
  await page.goto('http://127.0.0.1:3010/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin.dev@nguyentrinh.com.vn')
  await page.fill('input[type="password"]', 'Duyyquang181216')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
  if (!page.url().includes('/dashboard')) {
    await page.goto('http://127.0.0.1:3010/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
  }
}

async function main() {
  const sign = await sb.auth.signInWithPassword({
    email: 'admin.dev@nguyentrinh.com.vn',
    password: 'Duyyquang181216',
  })
  if (sign.error) throw sign.error

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const orderId = 'cdcf5ef8-02da-4d10-8957-0e20898ad5cd'
  const before = await sb
    .from('don_hang_trang_thai_log')
    .select('log_id, from_state, to_state, ghi_chu, changed_at', { count: 'exact' })
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })

  await login(page)

  await page.goto(`http://127.0.0.1:3010/don-hang/${orderId}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(1500)

  const bodyBefore = (await page.locator('body').textContent()) || ''
  console.log('state before', bodyBefore.includes('DUYET_SX') ? 'DUYET_SX' : bodyBefore.includes('CHO_DUYET_SX') ? 'CHO_DUYET_SX' : 'unknown')
  console.log('allowed DA_DUYET visible', bodyBefore.includes('DA_DUYET'))
  console.log('allowed HUY visible', bodyBefore.includes('HUY'))

  await page.fill('textarea', 'transition note from browser')
  await page.getByRole('button', { name: 'DA_DUYET' }).click()
  await page.waitForTimeout(2500)

  const bodyAfter = (await page.locator('body').textContent()) || ''
  console.log('after state DA_DUYET visible', bodyAfter.includes('DA_DUYET'))

  const order = await sb
    .from('don_hang')
    .select('order_id, trang_thai, ghi_chu, updated_at')
    .eq('order_id', orderId)
    .maybeSingle()

  const after = await sb
    .from('don_hang_trang_thai_log')
    .select('log_id, from_state, to_state, ghi_chu, changed_at', { count: 'exact' })
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })

  console.log('order state', order.data)
  console.log('timeline count before', before.count, 'after', after.count)
  console.log('latest log', after.data?.[0] || null)

  const invalid = await page.evaluate(async () => {
    const res = await fetch('/api/don-hang/cdcf5ef8-02da-4d10-8957-0e20898ad5cd/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toState: 'CHO_DUYET_SX', note: 'invalid back transition' }),
    })
    return {
      status: res.status,
      body: await res.text(),
    }
  })
  console.log('invalid transition status', invalid.status)
  console.log('invalid transition body', invalid.body)

  await page.goto('http://127.0.0.1:3010/don-hang/dfaa7593-46cd-47a4-bbb4-0c61f363d11f', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(1500)
  const bodyHuy = (await page.locator('body').textContent()) || ''
  console.log('HUY order no actions text', bodyHuy.includes('Khong co action hop le'))

  await context.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

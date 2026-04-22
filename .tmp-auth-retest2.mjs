import { chromium } from 'playwright'

const BASE = 'http://localhost:3010'
const EMAIL = 'admin.dev@nguyentrinh.com.vn'
const PASSWORD = 'Duyyquang181216'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 20000 })
}

async function run() {
  const browser = await chromium.launch({ headless: true })

  const context = await browser.newContext()
  const page = await context.newPage()
  const result = []

  // 1) unauth /dashboard -> /login
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  result.push({ tc: 'unauth dashboard redirects login', pass: page.url().includes('/login'), actual: page.url() })

  // 2) login success -> dashboard
  await login(page)
  result.push({ tc: 'login -> dashboard', pass: page.url().includes('/dashboard'), actual: page.url() })

  // 3) reload dashboard 5 times no refresh-token error
  let reloadPass = true
  let reloadErr = ''
  for (let i = 0; i < 5; i++) {
    await page.reload({ waitUntil: 'networkidle' })
    const body = await page.textContent('body')
    if ((body || '').includes('refresh token was already used')) {
      reloadPass = false
      reloadErr = `error appeared on reload #${i + 1}`
      break
    }
  }
  result.push({ tc: 'dashboard reload x5 no refresh token reuse error', pass: reloadPass, actual: reloadErr || 'no error string' })

  // 4) /me still works
  await page.goto(`${BASE}/me`, { waitUntil: 'networkidle' })
  const meText = (await page.textContent('body')) || ''
  const mePass = meText.includes('Auth User') && meText.includes('User Profile')
  result.push({ tc: '/me shows auth user + profile', pass: mePass, actual: mePass ? 'ok' : 'missing sections' })

  // 5) logout then login again
  const logoutBtn = page.getByRole('button', { name: 'Đăng xuất' })
  if (await logoutBtn.count()) {
    await logoutBtn.click()
  }
  await page.waitForTimeout(1000)
  const afterLogoutUrl = page.url()
  result.push({ tc: 'logout lands login', pass: afterLogoutUrl.includes('/login'), actual: afterLogoutUrl })

  await login(page)
  result.push({ tc: 'login again after logout', pass: page.url().includes('/dashboard'), actual: page.url() })

  // 6) logged-in /login -> /dashboard
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  result.push({ tc: 'logged-in /login redirects dashboard', pass: page.url().includes('/dashboard'), actual: page.url() })

  // 7) incognito unauth still redirected
  const context2 = await browser.newContext()
  const page2 = await context2.newPage()
  await page2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  result.push({ tc: 'incognito unauth /dashboard -> /login', pass: page2.url().includes('/login'), actual: page2.url() })

  console.log(JSON.stringify(result, null, 2))

  await context2.close()
  await context.close()
  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

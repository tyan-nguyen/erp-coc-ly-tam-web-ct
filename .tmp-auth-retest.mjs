import { chromium } from 'playwright'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

const out=[]
const log=(name,status,detail='')=>{out.push({name,status,detail});console.log(`[${status}] ${name}${detail?` :: ${detail}`:''}`)}

async function run(){
  const browser=await chromium.launch({headless:true})

  // incognito context for unauth checks
  const incognito=await browser.newContext()
  const incPage=await incognito.newPage()
  await incPage.goto(`${BASE}/dashboard`)
  await incPage.waitForLoadState('networkidle')
  if(incPage.url().includes('/login')) log('unauth /dashboard -> /login','PASS',incPage.url())
  else log('unauth /dashboard -> /login','FAIL',incPage.url())

  // normal context
  const normal=await browser.newContext()
  const page=await normal.newPage()
  const refreshErrors=[]
  page.on('console',m=>{
    const t=m.text()
    if(t.includes('refresh token')||t.includes('already used')) refreshErrors.push(t)
  })

  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]',EMAIL)
  await page.fill('input[type="password"]',PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  if(page.url().includes('/dashboard')) log('login success','PASS',page.url())
  else log('login success','FAIL',page.url())

  let reloadOk=true
  for(let i=0;i<5;i++){
    await page.goto(`${BASE}/dashboard`, { waitUntil:'networkidle' })
    const body=await page.textContent('body')
    if((body||'').includes('refresh token was already used')) reloadOk=false
  }
  if(reloadOk && refreshErrors.length===0) log('reload /dashboard x5 no refresh-token error','PASS')
  else log('reload /dashboard x5 no refresh-token error','FAIL',refreshErrors.join(' | '))

  await page.goto(`${BASE}/me`)
  await page.waitForLoadState('networkidle')
  const meBody=await page.textContent('body')
  if((meBody||'').includes('admin.dev@nguyentrinh.com.vn') && (meBody||'').includes('admin')) log('/me shows auth user + profile','PASS')
  else log('/me shows auth user + profile','FAIL')

  await page.click('button:has-text("Đăng xuất")')
  await page.waitForLoadState('networkidle')
  if(page.url().includes('/login')) log('logout redirect /login','PASS',page.url())
  else log('logout redirect /login','FAIL',page.url())

  await page.fill('input[type="email"]',EMAIL)
  await page.fill('input[type="password"]',PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  if(page.url().includes('/dashboard')) log('login again after logout','PASS',page.url())
  else log('login again after logout','FAIL',page.url())

  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  if(page.url().includes('/dashboard')) log('logged-in /login -> /dashboard','PASS',page.url())
  else log('logged-in /login -> /dashboard','FAIL',page.url())

  // incognito still unauth
  await incPage.goto(`${BASE}/dashboard`)
  await incPage.waitForLoadState('networkidle')
  if(incPage.url().includes('/login')) log('incognito remains unauth','PASS',incPage.url())
  else log('incognito remains unauth','FAIL',incPage.url())

  await incognito.close()
  await normal.close()
  await browser.close()

  console.log('\nJSON_RESULTS_START')
  console.log(JSON.stringify(out,null,2))
  console.log('JSON_RESULTS_END')
}

run()

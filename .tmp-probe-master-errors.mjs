import { chromium } from 'playwright'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

const cases=[
  {path:'/master-data/dm-kh', payload:{ten_kh:'ZZ_PROBE_KH',nhom_kh:'SMOKE',is_active:true,deleted_at:null}},
  {path:'/master-data/dm-duan', payload:{ten_da:'ZZ_PROBE_DA',is_active:true,deleted_at:null}},
  {path:'/master-data/dm-ncc', payload:{ten_ncc:'ZZ_PROBE_NCC',loai_ncc:'SMOKE',is_active:true,deleted_at:null}},
  {path:'/master-data/nvl', payload:{ten_hang:'ZZ_PROBE_NVL',is_active:true,deleted_at:null}},
  {path:'/master-data/gia-nvl', payload:{nvl_id:'1',gia:123,is_active:true,deleted_at:null}},
  {path:'/master-data/dm-coc-template', payload:{loai_coc:'ZZ_PROBE_COC',is_active:true,deleted_at:null}},
  {path:'/master-data/dm-dinh-muc-phu-md', payload:{nhom_d:'ZZ_PROBE_D',md:10,is_active:true,deleted_at:null}},
  {path:'/master-data/dm-capphoi-bt', payload:{mac_be_tong:'ZZ_PROBE_B',is_active:true,deleted_at:null}},
]

const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()
await page.goto(`${BASE}/login`)
await page.fill('input[type="email"]',EMAIL)
await page.fill('input[type="password"]',PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))

for (const c of cases){
  await page.goto(`${BASE}${c.path}`,{waitUntil:'networkidle'})
  const box=page.locator('div.rounded-2xl').filter({hasText:'Tao moi'}).first()
  await box.locator('textarea[name="payload"]').fill(JSON.stringify(c.payload))
  await box.getByRole('button',{name:'Tao ban ghi'}).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  console.log(c.path,'=>',page.url())
}

await ctx.close(); await browser.close()

import { chromium } from 'playwright'

const BASE='http://localhost:3000'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

async function login(page){
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
}

async function createOnly(page, route, mutate){
  await page.goto(`${BASE}${route}`)
  await page.waitForLoadState('networkidle')
  const ta = page.locator('form textarea[name="payload"]').first()
  const payload = JSON.parse(await ta.inputValue())
  mutate(payload)
  await ta.fill(JSON.stringify(payload,null,2))
  await page.locator('form button:has-text("Tao ban ghi")').first().click()
  await page.waitForLoadState('networkidle')
  const err = await page.locator('section.border-red-200').allTextContents()
  const ok = await page.locator('section.border-emerald-200').allTextContents()
  return { err, ok }
}

const browser = await chromium.launch({headless:true})
const page = await browser.newPage()
await login(page)

const tests = [
  ['/master-data/dm-kh', p=>{p.ten_kh=`AUTO_KH_${Date.now()}`; p.nhom_kh='A'}],
  ['/master-data/dm-duan', p=>{p.ten_da=`AUTO_DA_${Date.now()}`}],
  ['/master-data/dm-ncc', p=>{p.ten_ncc=`AUTO_NCC_${Date.now()}`; p.loai_ncc='A'}],
  ['/master-data/nvl', p=>{p.ten_hang=`AUTO_NVL_${Date.now()}`}],
  ['/master-data/gia-nvl', p=>{p.nvl_id='1'; p.gia=1000}],
  ['/master-data/dm-coc-template', p=>{p.loai_coc='PHC'}],
  ['/master-data/dm-dinh-muc-phu-md', p=>{p.nhom_d='A'; p.md=10}],
  ['/master-data/dm-capphoi-bt', p=>{p.mac_be_tong='B40'}],
]

for(const [route, mutate] of tests){
  const r = await createOnly(page, route, mutate)
  console.log(route, JSON.stringify(r))
}

await page.goto(`${BASE}/boc-tach/boc-tach-nvl/new`)
await page.waitForLoadState('networkidle')
await page.locator('label:has-text("da_id") input').fill('1')
await page.locator('label:has-text("kh_id") input').fill('1')
await page.locator('label:has-text("Loai coc") input').fill('PHC')
await page.locator('label:has-text("Mac be tong") input').fill('B40')
await page.locator('label:has-text("Ten boc tach") input').fill(`AUTO_BOC_${Date.now()}`)
await page.locator('label:has-text("Loai thep") input').fill('PC')
await page.locator('button:has-text("Vat tu")').click()
await page.waitForTimeout(200)
await page.locator('textarea').first().fill(JSON.stringify([
  { nvl_id: '1', ten_nvl: 'Thep', loai_nvl: 'THEP', so_luong: 10, dvt: 'kg', don_gia: 1000 },
  { nvl_id: '2', ten_nvl: 'BT', loai_nvl: 'CAP_PHOI_BT', so_luong: 1, dvt: 'm3', don_gia: 200000 }
],null,2))
await page.locator('button:has-text("Chi tiet tinh")').click()
await page.waitForTimeout(200)
await page.locator('textarea').first().fill(JSON.stringify([
  { ten_doan:'Doan 1', len_m:6, cnt:1, so_luong_doan:1, the_tich_m3:0, v1:30, v2:20, v3:10, mui_segments:1, dai_kep_chi_a1:false }
],null,2))
await page.locator('button:has-text("Tong hop")').click()
await page.waitForTimeout(200)
await page.locator('button:has-text("Luu")').click()
await page.waitForTimeout(2000)
const bErr = await page.locator('p.text-red-600').allTextContents()
const bOk = await page.locator('p.text-emerald-700').allTextContents()
console.log('/boc-tach/boc-tach-nvl/new', JSON.stringify({err:bErr, ok:bOk, url: page.url()}))

await browser.close()

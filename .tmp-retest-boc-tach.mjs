import { chromium } from 'playwright'

const BASE = 'http://localhost:3010'
const EMAIL = 'admin.dev@nguyentrinh.com.vn'
const PASSWORD = 'Duyyquang181216'

function expectClose(actual, expected, tolerance = 0.02) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((u) => u.pathname.startsWith('/dashboard'), { timeout: 10000 })
  } catch {
    await page.waitForTimeout(1500)
    if (!new URL(page.url()).pathname.startsWith('/dashboard')) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
    }
  }
  if (!new URL(page.url()).pathname.startsWith('/dashboard')) {
    throw new Error(`Login did not reach /dashboard. Current URL: ${page.url()}`)
  }
}

async function readFirstTableValue(page, route, columnName) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  const headers = page.locator('table thead th')
  const count = await headers.count()
  let targetIndex = -1

  for (let i = 0; i < count; i += 1) {
    const text = (await headers.nth(i).textContent())?.trim() || ''
    if (text === columnName) {
      targetIndex = i
      break
    }
  }

  if (targetIndex < 0) {
    throw new Error(`Column not found on ${route}: ${columnName}`)
  }

  const firstRow = page.locator('table tbody tr').first()
  const value = (await firstRow.locator('td').nth(targetIndex).textContent())?.trim() || ''
  if (!value) {
    throw new Error(`No value found for ${columnName} on ${route}`)
  }
  return value
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  await login(page)
  const khId = await readFirstTableValue(page, '/master-data/dm-kh', 'kh_id')
  const daId = await readFirstTableValue(page, '/master-data/dm-duan', 'da_id')
  const nvlId = await readFirstTableValue(page, '/master-data/nvl', 'nvl_id')
  await page.goto(`${BASE}/boc-tach/boc-tach-nvl/new`, { waitUntil: 'networkidle' })

  const testcase = {
    testcase: 'Boc tach segment-level + cap phoi + vat tu phu',
    expected:
      'Template apply duoc, save NHAP thanh cong, segment snapshot luu dung V1/V2/V3 + phu kien theo cai + cap_phoi_items + auxiliary_items',
    actual: '',
    pass: false,
    sql_verify: [
      "select boc_id, trang_thai, to_hop_doan from public.boc_tach_nvl where boc_id = '<captured_boc_id>';",
      "select ten_doan, so_luong_doan, dinh_muc_nvl, tong_nvl from public.boc_tach_seg_nvl where boc_id = '<captured_boc_id>' order by ten_doan;",
      "select so_thu_tu, nvl_id, so_luong, don_gia, loai_nvl from public.boc_tach_nvl_items where boc_id = '<captured_boc_id>' order by so_thu_tu;",
    ],
  }

  const saveResult = await page.evaluate(
    async ({ daId, khId, nvlId }) => {
      const payload = {
        header: {
          da_id: daId,
          kh_id: khId,
          loai_coc: 'PHC - A500',
          do_ngoai: 500,
          chieu_day: 100,
          mac_be_tong: '80',
          ten_boc_tach: 'RETEST_SEGMENT_A500',
          loai_thep: 'PC 9',
          phuong_thuc_van_chuyen: 'ROAD_WITH_CRANE',
          trang_thai: 'NHAP',
          do_mm: 500,
          t_mm: 100,
          pc_dia_mm: 9,
          pc_nos: 14,
          dai_dia_mm: 4,
          buoc_dia_mm: 1,
          dtam_mm: 400,
          sigma_cu: 80,
          sigma_pu: 1860,
          sigma_py: 1670,
          r: 0.7,
          k: 0.2,
          ep: 200000,
          md_per_tim: 28,
          total_md: 560,
          don_gia_van_chuyen: 0,
        },
        items: [
          { nvl_id: nvlId, ten_nvl: 'Be tong mac 800', loai_nvl: 'CAP_PHOI_BT', so_luong: 70.372, dvt: 'm3', don_gia: 0 },
          { nvl_id: nvlId, ten_nvl: 'Thep PC 9', loai_nvl: 'THEP', so_luong: 3915.26, dvt: 'kg', don_gia: 0 },
        ],
        segments: [
          { ten_doan: 'MUI', len_m: 10, cnt: 20, so_luong_doan: 20, the_tich_m3: 0, v1: 0, v2: 0, v3: 0, mui_segments: 20, dai_kep_chi_a1: true, a1_mm: 100, a2_mm: 0, a3_mm: 100, p1_pct: 20, p2_pct: 0, p3_pct: 80, don_kep_factor: 2 },
          { ten_doan: 'THAN_1', len_m: 9, cnt: 20, so_luong_doan: 20, the_tich_m3: 0, v1: 0, v2: 0, v3: 0, mui_segments: 0, dai_kep_chi_a1: true, a1_mm: 100, a2_mm: 0, a3_mm: 100, p1_pct: 20, p2_pct: 0, p3_pct: 80, don_kep_factor: 2 },
          { ten_doan: 'THAN_2', len_m: 9, cnt: 20, so_luong_doan: 20, the_tich_m3: 0, v1: 0, v2: 0, v3: 0, mui_segments: 0, dai_kep_chi_a1: true, a1_mm: 100, a2_mm: 0, a3_mm: 100, p1_pct: 20, p2_pct: 0, p3_pct: 80, don_kep_factor: 2 },
        ],
      }

      const resp = await fetch('/api/boc-tach/boc-tach-nvl/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', payload }),
      })
      const body = await resp.json().catch(() => ({}))
      return { status: resp.status, body }
    },
    { daId, khId, nvlId }
  )

  let headerId = saveResult?.body?.data?.headerId || null
  const parsed = saveResult?.body || null
  const preview = saveResult?.body?.data?.preview || null

  const segmentSnapshots = preview?.segment_snapshots || []
  const mixMaterials = preview?.concrete_mix_materials || []
  const auxMaterials = preview?.auxiliary_materials || []

  const mui = segmentSnapshots.find((item) => item.ten_doan === 'MUI')
  const than1 = segmentSnapshots.find((item) => item.ten_doan === 'THAN_1')
  const checks = [
    Boolean(headerId),
    saveResult?.status === 200 && Boolean(parsed?.ok),
    mui && mui.v1 === 84 && mui.v2 === 0 && mui.v3 === 60,
    mui && mui.mat_bich === 40 && mui.mang_xong === 40 && mui.mui_coc === 20 && mui.tap === 20,
    mui && expectClose(mui.concrete_m3, 25.133) && expectClose(mui.pc_kg, 1398.307) && expectClose(mui.dai_kg, 368.614),
    than1 && than1.v1 === 76 && than1.v2 === 0 && than1.v3 === 54,
    Array.isArray(mixMaterials),
    Array.isArray(auxMaterials),
  ]

  testcase.pass = checks.every(Boolean)
  testcase.actual = JSON.stringify(
    {
      api_ok: parsed?.ok ?? false,
      api_status: saveResult?.status ?? null,
      khId,
      daId,
      nvlId,
      headerId,
      error: parsed?.error || null,
      body: parsed,
      mui,
      than1,
      concrete_mix_materials: mixMaterials,
      auxiliary_materials: auxMaterials,
    },
    null,
    2
  )

  console.log(JSON.stringify([testcase], null, 2))

  await context.close()
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

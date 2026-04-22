import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const BASE = 'http://localhost:3010'
const EMAIL = 'admin.dev@nguyentrinh.com.vn'
const PASSWORD = 'Duyyquang181216'

function loadEnvLocal() {
  const txt = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '')
  }
  return env
}

function pickIdField(row) {
  if (!row) return null
  const preferred = ['id', 'kh_id', 'da_id', 'ncc_id', 'nvl_id', 'gia_id', 'coc_template_id', 'dinh_muc_id', 'capphoi_id', 'boc_id', 'boc_tach_id']
  for (const key of preferred) {
    if (row[key] !== undefined && row[key] !== null) return key
  }
  for (const key of Object.keys(row)) {
    if (key.endsWith('_id') && row[key] !== null && row[key] !== undefined) return key
  }
  return null
}

async function sbSelectRows(sb, table, field, value) {
  const { data, error } = await sb.from(table).select('*').eq(field, value)
  if (error) throw new Error(`${table} select failed: ${error.message}`)
  return data ?? []
}

async function sbSelectOneByField(sb, table, field, value) {
  const rows = await sbSelectRows(sb, table, field, value)
  return rows[0] || null
}

async function sbFirstRow(sb, table) {
  const { data, error } = await sb.from(table).select('*').limit(1)
  if (error) throw new Error(`${table} sample failed: ${error.message}`)
  return data?.[0] || null
}

async function sbCountByAnyField(sb, table, fields, value) {
  let max = 0
  for (const f of fields) {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).eq(f, value)
    if (!error && typeof count === 'number') {
      if (count > max) max = count
    }
  }
  return max
}

function sanitizeFromSample(sample, dropFields = []) {
  const payload = { ...sample }
  const defaultsToDrop = ['created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_by']
  for (const key of [...defaultsToDrop, ...dropFields]) {
    delete payload[key]
  }
  return payload
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 20000 })
}

async function submitCreate(page, basePath, payload) {
  await page.goto(`${BASE}${basePath}`, { waitUntil: 'networkidle' })
  const createBox = page.locator('div.rounded-2xl').filter({ hasText: 'Tao moi' }).first()
  await createBox.locator('textarea[name="payload"]').fill(JSON.stringify(payload, null, 2))
  await createBox.getByRole('button', { name: 'Tao ban ghi' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  return page.url()
}

async function submitEdit(page, basePath, searchKey, editPayload) {
  await page.goto(`${BASE}${basePath}?q=${encodeURIComponent(searchKey)}`, { waitUntil: 'networkidle' })
  const row = page.locator('tr', { hasText: searchKey }).first()
  if (!(await row.count())) throw new Error(`Khong tim thay row q=${searchKey} de sua`)
  await row.getByRole('link', { name: 'Sua' }).click()
  await page.waitForLoadState('networkidle')

  const editBox = page.locator('div.rounded-2xl').filter({ hasText: 'Cap nhat' }).first()
  await editBox.locator('textarea[name="payload"]').fill(JSON.stringify(editPayload, null, 2))
  await editBox.getByRole('button', { name: 'Luu thay doi' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  return page.url()
}

async function submitSoftDelete(page, basePath, searchKey) {
  await page.goto(`${BASE}${basePath}?q=${encodeURIComponent(searchKey)}`, { waitUntil: 'networkidle' })
  const row = page.locator('tr', { hasText: searchKey }).first()
  if (!(await row.count())) throw new Error(`Khong tim thay row q=${searchKey} de xoa mem`)
  await row.getByRole('button', { name: 'Xoa mem' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)

  await page.goto(`${BASE}${basePath}?q=${encodeURIComponent(searchKey)}`, { waitUntil: 'networkidle' })
  const rowAfter = await page.locator('tr', { hasText: searchKey }).count()
  const body = (await page.textContent('body')) || ''
  return rowAfter === 0 && body.includes('Khong co du lieu phu hop')
}

async function runMaster({ page, sb, fixtures }) {
  const results = []

  const specs = [
    {
      table: 'dm_kh',
      path: '/master-data/dm-kh',
      markerField: 'ten_kh',
      dropFields: ['kh_id', 'ma_kh', 'code'],
      buildMarker: (seed) => `ZZ_RT_KH_${seed}`,
    },
    {
      table: 'dm_duan',
      path: '/master-data/dm-duan',
      markerField: 'ten_da',
      dropFields: ['da_id', 'ma_da', 'code'],
      buildMarker: (seed) => `ZZ_RT_DA_${seed}`,
    },
    {
      table: 'dm_ncc',
      path: '/master-data/dm-ncc',
      markerField: 'ten_ncc',
      dropFields: ['ncc_id', 'ma_ncc', 'code'],
      buildMarker: (seed) => `ZZ_RT_NCC_${seed}`,
    },
    {
      table: 'nvl',
      path: '/master-data/nvl',
      markerField: 'ten_hang',
      dropFields: ['nvl_id', 'ma_nvl', 'code'],
      buildMarker: (seed) => `ZZ_RT_NVL_${seed}`,
      afterCreate: (row) => {
        fixtures.nvlId = row.nvl_id ?? row.id ?? fixtures.nvlId
      },
    },
    {
      table: 'gia_nvl',
      path: '/master-data/gia-nvl',
      markerField: 'gia',
      dropFields: ['gia_id', 'code'],
      buildMarker: (seed) => 130000 + Number(seed),
    },
    {
      table: 'dm_coc_template',
      path: '/master-data/dm-coc-template',
      markerField: 'loai_coc',
      dropFields: ['coc_template_id', 'code'],
      buildMarker: (seed) => `ZZ_RT_COC_${seed}`,
    },
    {
      table: 'dm_dinh_muc_phu_md',
      path: '/master-data/dm-dinh-muc-phu-md',
      markerField: 'nhom_d',
      dropFields: ['dinh_muc_id', 'code'],
      buildMarker: (seed) => `ZZ_RT_DMP_${seed}`,
    },
    {
      table: 'dm_capphoi_bt',
      path: '/master-data/dm-capphoi-bt',
      markerField: 'mac_be_tong',
      dropFields: ['capphoi_id', 'code'],
      buildMarker: (seed) => `ZZ_RT_B${seed}`,
    },
  ]

  for (const s of specs) {
    const tc = {
      testcase: `${s.table} create/edit/soft-delete`,
      expected: 'Create/Edit/Soft delete tren UI thanh cong; DB verify dung; list an row da soft-delete.',
      actual: '',
      pass: false,
      sql_verify: [],
    }

    try {
      const seed = Date.now().toString().slice(-6)
      const sample = await sbFirstRow(sb, s.table)
      if (!sample) throw new Error(`${s.table} khong co sample row de clone payload`)

      const payload = sanitizeFromSample(sample, s.dropFields)
      payload[s.markerField] = s.buildMarker(seed)
      if (payload.is_active !== undefined) payload.is_active = true
      if (payload.deleted_at !== undefined) payload.deleted_at = null
      if (s.table === 'gia_nvl') {
        if (!fixtures.nvlId) {
          const nvlSample = await sbFirstRow(sb, 'nvl')
          fixtures.nvlId = nvlSample?.nvl_id ?? nvlSample?.id ?? null
        }
        if (fixtures.nvlId) payload.nvl_id = String(fixtures.nvlId)
      }

      const createUrl = await submitCreate(page, s.path, payload)
      const markerValue = payload[s.markerField]
      const rowsCreated = await sbSelectRows(sb, s.table, s.markerField, markerValue)
      if (rowsCreated.length < 1) {
        throw new Error(`${s.table} create DB verify fail; submit_url=${createUrl}`)
      }

      const created = rowsCreated[0]
      const idField = pickIdField(created)
      if (!idField) throw new Error(`${s.table} khong tim duoc id field`)
      const idValue = created[idField]

      if (typeof s.afterCreate === 'function') s.afterCreate(created)

      const editPayload = { ...created }
      const editMarker = s.markerField === 'gia'
        ? Number(markerValue) + 1
        : `${String(markerValue)}_ED`
      editPayload[s.markerField] = editMarker

      const editUrl = await submitEdit(page, s.path, String(markerValue), editPayload)
      const rowAfterEdit = await sbSelectOneByField(sb, s.table, idField, idValue)
      if (!rowAfterEdit) throw new Error(`${s.table} missing row after edit`)
      if (String(rowAfterEdit[s.markerField]) !== String(editMarker)) {
        throw new Error(`${s.table} edit value mismatch; submit_url=${editUrl}`)
      }

      const hideOk = await submitSoftDelete(page, s.path, String(editMarker))
      if (!hideOk) throw new Error(`${s.table} list van hien row sau soft-delete`)

      const rowAfterDelete = await sbSelectOneByField(sb, s.table, idField, idValue)
      if (!rowAfterDelete) throw new Error(`${s.table} missing row after soft-delete`)
      if (!(rowAfterDelete.is_active === false && rowAfterDelete.deleted_at)) {
        throw new Error(`${s.table} soft delete columns invalid`)
      }

      tc.sql_verify = [
        `SELECT * FROM public.${s.table} WHERE ${idField} = '${String(idValue)}';`,
      ]
      tc.actual = `PASS: id=${idField}:${String(idValue)}; marker ${String(markerValue)} -> ${String(editMarker)}; soft-delete DB ok.`
      tc.pass = true
    } catch (e) {
      tc.sql_verify = [`SELECT * FROM public.${s.table} ORDER BY 1 DESC LIMIT 20;`]
      tc.actual = e instanceof Error ? e.message : String(e)
      tc.pass = false
    }

    results.push(tc)
  }

  return results
}

async function pickAnyActiveId(sb, table) {
  const { data } = await sb.from(table).select('*').eq('is_active', true).limit(1)
  const row = data?.[0]
  if (!row) return null
  const idField = pickIdField(row)
  return idField ? String(row[idField]) : null
}

async function runBoc({ page, sb }) {
  const results = []
  const khId = await pickAnyActiveId(sb, 'dm_kh')
  const daId = await pickAnyActiveId(sb, 'dm_duan')
  const nvlId = await pickAnyActiveId(sb, 'nvl')

  if (!khId || !daId || !nvlId) {
    return [{
      testcase: 'boc_tach prerequisites',
      expected: 'Co fixture kh_id/da_id/nvl_id active',
      actual: `missing ids kh=${khId} da=${daId} nvl=${nvlId}`,
      pass: false,
      sql_verify: [
        'SELECT * FROM public.dm_kh WHERE is_active=true LIMIT 20;',
        'SELECT * FROM public.dm_duan WHERE is_active=true LIMIT 20;',
        'SELECT * FROM public.nvl WHERE is_active=true LIMIT 20;',
      ],
    }]
  }

  const seed = Date.now().toString().slice(-6)
  const tenBoc = `ZZ_BOC_${seed}`

  await page.goto(`${BASE}/boc-tach/boc-tach-nvl/new`, { waitUntil: 'networkidle' })
  await page.getByLabel('da_id').fill(daId)
  await page.getByLabel('kh_id').fill(khId)
  await page.getByLabel('Loai coc').fill('PHC')
  await page.getByLabel('Mac be tong').fill('B40')
  await page.getByLabel('Ten boc tach').fill(tenBoc)
  await page.getByLabel('Loai thep').fill('PC')

  await page.getByRole('button', { name: 'Vat tu' }).click()
  await page.locator('textarea').first().fill(JSON.stringify([
    { nvl_id: String(nvlId), ten_nvl: 'NVL_A', loai_nvl: 'CAP_PHOI_BT', so_luong: 10, dvt: 'kg', don_gia: 1000 },
    { nvl_id: String(nvlId), ten_nvl: 'NVL_B', loai_nvl: 'THEP', so_luong: 20, dvt: 'kg', don_gia: 2000 },
  ], null, 2))

  await page.getByRole('button', { name: 'Chi tiet tinh' }).click()
  await page.locator('textarea').first().fill(JSON.stringify([
    { ten_doan: 'Doan test', len_m: 6, cnt: 1, so_luong_doan: 1, the_tich_m3: 0, v1: 10, v2: 5, v3: 2, mui_segments: 1, dai_kep_chi_a1: false },
  ], null, 2))

  let bocId = null
  const tcSave = {
    testcase: 'boc_tach Save NHAP',
    expected: 'Save NHAP thanh cong va DB co header/items/seg; chua tao don_hang',
    actual: '',
    pass: false,
    sql_verify: [],
  }

  try {
    await page.getByRole('button', { name: /^Luu$/ }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const pathParts = new URL(page.url()).pathname.split('/')
    bocId = pathParts[pathParts.length - 1]
    if (!bocId || bocId === 'new') throw new Error('Khong lay duoc boc_id')

    const header = (await sbSelectRows(sb, 'boc_tach_nvl', 'boc_id', bocId)).at(0)
      || (await sbSelectRows(sb, 'boc_tach_nvl', 'boc_tach_id', bocId)).at(0)
    if (!header) throw new Error('Khong tim thay header boc_tach_nvl')
    if (String(header.trang_thai) !== 'NHAP') throw new Error(`trang_thai=${header.trang_thai}`)

    const itemCount = Math.max(
      await sbCountByAnyField(sb, 'boc_tach_nvl_items', ['boc_id', 'boc_tach_id'], bocId),
      0
    )
    const segCount = Math.max(
      await sbCountByAnyField(sb, 'boc_tach_seg_nvl', ['boc_id', 'boc_tach_id'], bocId),
      0
    )
    const donCount = Math.max(
      await sbCountByAnyField(sb, 'don_hang', ['boc_tach_nvl_id', 'boc_tach_id'], bocId),
      0
    )

    if (itemCount < 2) throw new Error(`itemCount=${itemCount}`)
    if (segCount < 1) throw new Error(`segCount=${segCount}`)
    if (donCount !== 0) throw new Error(`donCount=${donCount}`)

    tcSave.pass = true
    tcSave.actual = `PASS: boc_id=${bocId}, NHAP, items=${itemCount}, seg=${segCount}, don_hang=${donCount}`
    tcSave.sql_verify = [
      `SELECT * FROM public.boc_tach_nvl WHERE boc_id='${bocId}' OR boc_tach_id='${bocId}';`,
      `SELECT * FROM public.boc_tach_nvl_items WHERE boc_id='${bocId}' OR boc_tach_id='${bocId}';`,
      `SELECT * FROM public.boc_tach_seg_nvl WHERE boc_id='${bocId}' OR boc_tach_id='${bocId}';`,
      `SELECT * FROM public.don_hang WHERE boc_tach_nvl_id='${bocId}' OR boc_tach_id='${bocId}';`,
    ]
  } catch (e) {
    tcSave.actual = e instanceof Error ? e.message : String(e)
    tcSave.sql_verify = [
      'SELECT * FROM public.boc_tach_nvl ORDER BY created_at DESC NULLS LAST LIMIT 20;',
      'SELECT * FROM public.boc_tach_nvl_items ORDER BY 1 DESC LIMIT 20;',
      'SELECT * FROM public.boc_tach_seg_nvl ORDER BY 1 DESC LIMIT 20;',
    ]
  }
  results.push(tcSave)

  if (!tcSave.pass || !bocId) return results

  const tcSend = {
    testcase: 'boc_tach Save DA_GUI + don_hang 1:1',
    expected: 'DA_GUI, gui_qlsx_at/by set, don_hang count = 1',
    actual: '',
    pass: false,
    sql_verify: [
      `SELECT trang_thai, gui_qlsx_at, gui_qlsx_by FROM public.boc_tach_nvl WHERE boc_id='${bocId}' OR boc_tach_id='${bocId}';`,
      `SELECT * FROM public.don_hang WHERE boc_tach_nvl_id='${bocId}' OR boc_tach_id='${bocId}';`,
    ],
  }

  try {
    await page.getByRole('button', { name: 'Luu + Gui QLSX' }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const header = (await sbSelectRows(sb, 'boc_tach_nvl', 'boc_id', bocId)).at(0)
      || (await sbSelectRows(sb, 'boc_tach_nvl', 'boc_tach_id', bocId)).at(0)
    if (!header) throw new Error('Header missing')
    if (String(header.trang_thai) !== 'DA_GUI') throw new Error(`trang_thai=${header.trang_thai}`)
    if (!header.gui_qlsx_at || !header.gui_qlsx_by) throw new Error('gui_qlsx_at/by null')

    const { data: userData } = await sb.auth.getUser()
    if (String(header.gui_qlsx_by) !== String(userData?.user?.id || '')) {
      throw new Error('gui_qlsx_by mismatch current user')
    }

    const donCount = Math.max(
      await sbCountByAnyField(sb, 'don_hang', ['boc_tach_nvl_id', 'boc_tach_id'], bocId),
      0
    )
    if (donCount !== 1) throw new Error(`don_hang count=${donCount}`)

    tcSend.pass = true
    tcSend.actual = `PASS: DA_GUI, gui_qlsx fields set, don_hang count=${donCount}`
  } catch (e) {
    tcSend.actual = e instanceof Error ? e.message : String(e)
  }
  results.push(tcSend)

  const tcLock = {
    testcase: 'boc_tach lock sau DA_GUI + idempotency send',
    expected: 'Save lai bi chan tu server; send lai khong tao don_hang thu 2',
    actual: '',
    pass: false,
    sql_verify: [
      `SELECT * FROM public.boc_tach_nvl WHERE boc_id='${bocId}' OR boc_tach_id='${bocId}';`,
      `SELECT count(*) FROM public.don_hang WHERE boc_tach_nvl_id='${bocId}' OR boc_tach_id='${bocId}';`,
    ],
  }

  try {
    const saveAgain = await page.evaluate(async (id) => {
      const resp = await fetch(`/api/boc-tach/boc-tach-nvl/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', payload: { bocId: id, header: {}, items: [], segments: [] } }),
      })
      const json = await resp.json().catch(() => ({}))
      return { status: resp.status, json }
    }, bocId)

    if (saveAgain.status < 400) throw new Error(`save-after-DA_GUI not blocked status=${saveAgain.status}`)

    const sendAgain = await page.evaluate(async (id) => {
      const resp = await fetch(`/api/boc-tach/boc-tach-nvl/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', payload: { bocId: id, header: {}, items: [], segments: [] } }),
      })
      const json = await resp.json().catch(() => ({}))
      return { status: resp.status, json }
    }, bocId)

    const donCount = Math.max(
      await sbCountByAnyField(sb, 'don_hang', ['boc_tach_nvl_id', 'boc_tach_id'], bocId),
      0
    )
    if (donCount !== 1) throw new Error(`don_hang count=${donCount}`)

    tcLock.pass = true
    tcLock.actual = `PASS: save blocked status=${saveAgain.status}, sendAgain status=${sendAgain.status}, don_hang count=1`
  } catch (e) {
    tcLock.actual = e instanceof Error ? e.message : String(e)
  }

  results.push(tcLock)
  return results
}

async function main() {
  const env = loadEnvLocal()
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const signIn = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (signIn.error) throw new Error(`DB verify signIn failed: ${signIn.error.message}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  await login(page)

  const fixtures = { nvlId: null }
  const master = await runMaster({ page, sb, fixtures })
  const masterPass = master.every((r) => r.pass)
  const boc_tach = masterPass ? await runBoc({ page, sb }) : []

  const report = {
    generated_at: new Date().toISOString(),
    master,
    boc_tach,
    note: masterPass ? 'Master pass -> Boc tach retest executed' : 'Master has FAIL -> Boc tach blocked by requested order',
  }

  fs.writeFileSync('.tmp-retest-narrow-result.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  await context.close()
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

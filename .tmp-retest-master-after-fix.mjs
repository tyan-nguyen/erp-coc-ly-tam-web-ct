import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const BASE='http://localhost:3010'
const EMAIL='admin.dev@nguyentrinh.com.vn'
const PASSWORD='Duyyquang181216'

function envLocal(){
  const env={}
  for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
    const s=line.trim(); if(!s||s.startsWith('#')) continue
    const i=s.indexOf('='); if(i>0) env[s.slice(0,i)] = s.slice(i+1)
  }
  return env
}

function idField(row){
  const c=['kh_id','da_id','ncc_id','nvl_id','gia_nvl_id','template_id','dm_id','cp_id','id']
  for(const k of c){ if(row && row[k]!==undefined && row[k]!==null) return k }
  return null
}

async function login(page){
  await page.goto(`${BASE}/login`,{waitUntil:'networkidle'})
  await page.fill('input[type="email"]',EMAIL)
  await page.fill('input[type="password"]',PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))
}

async function retestCase(page,sb,{table,path,markerField,supportsSoftDelete}){
  const tc={module:table,testcase:'create/edit/soft-delete',expected:'CRUD pass + DB verify',actual:'',pass:false,sql_verify:[]}
  const seed=Date.now().toString().slice(-6)
  try{
    await page.goto(`${BASE}${path}`,{waitUntil:'networkidle'})
    const createBox=page.locator('div.rounded-2xl').filter({hasText:'Tao moi'}).first()
    const raw=await createBox.locator('textarea[name="payload"]').inputValue()
    const payload=JSON.parse(raw)

    if(payload[markerField]!==undefined){
      if(typeof payload[markerField]==='number') {
        payload[markerField]=Number(payload[markerField]||0)+1000
      } else {
        payload[markerField]=`${String(payload[markerField]||'ZZ')}_RT_${seed}`
      }
    }

    await createBox.locator('textarea[name="payload"]').fill(JSON.stringify(payload,null,2))
    await createBox.getByRole('button',{name:'Tao ban ghi'}).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const createUrl=new URL(page.url())
    const createErr=createUrl.searchParams.get('err')
    if(createErr){ throw new Error(`create fail: ${decodeURIComponent(createErr)}`) }

    const markerValue = payload[markerField]
    const {data:rows,error:selErr}=await sb.from(table).select('*').eq(markerField,markerValue)
    if(selErr) throw new Error(`db verify create fail: ${selErr.message}`)
    if(!rows?.length) throw new Error('db verify create fail: no row')
    const row=rows[0]
    const key=idField(row)
    if(!key) throw new Error('cannot resolve key field')

    const editedValue = typeof markerValue === 'number' ? markerValue + 1 : `${String(markerValue)}_ED`
    await page.goto(`${BASE}${path}?q=${encodeURIComponent(String(markerValue))}`,{waitUntil:'networkidle'})
    const targetRow=page.locator('tr',{hasText:String(markerValue)}).first()
    if(!(await targetRow.count())) throw new Error('edit row not found in list')
    await targetRow.getByRole('link',{name:'Sua'}).click()
    await page.waitForLoadState('networkidle')

    const editBox=page.locator('div.rounded-2xl').filter({hasText:'Cap nhat'}).first()
    const editRaw=await editBox.locator('textarea[name="payload"]').inputValue()
    const editPayload=JSON.parse(editRaw)
    editPayload[markerField]=editedValue
    await editBox.locator('textarea[name="payload"]').fill(JSON.stringify(editPayload,null,2))
    await editBox.getByRole('button',{name:'Luu thay doi'}).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const editUrl=new URL(page.url())
    const editErr=editUrl.searchParams.get('err')
    if(editErr) throw new Error(`edit fail: ${decodeURIComponent(editErr)}`)

    const {data:rowAfter,error:rowErr}=await sb.from(table).select('*').eq(key,row[key]).limit(1)
    if(rowErr) throw new Error(`db verify edit fail: ${rowErr.message}`)
    if(!rowAfter?.length || String(rowAfter[0][markerField])!==String(editedValue)) {
      throw new Error('db verify edit mismatch')
    }

    if (!supportsSoftDelete) {
      tc.actual=`create/edit pass; soft-delete not supported by schema`
      tc.pass=true
      tc.sql_verify=[`SELECT * FROM public.${table} WHERE ${key}='${row[key]}';`]
      return tc
    }

    await page.goto(`${BASE}${path}?q=${encodeURIComponent(String(editedValue))}`,{waitUntil:'networkidle'})
    const softButton=page.locator('tr',{hasText:String(editedValue)}).first().getByRole('button',{name:'Xoa mem'})
    if(!(await softButton.count())) {
      throw new Error('soft-delete button not found')
    }
    await softButton.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const deleteUrl=new URL(page.url())
    const delErr=deleteUrl.searchParams.get('err')
    if(delErr) throw new Error(`soft-delete fail: ${decodeURIComponent(delErr)}`)

    const {data:afterDelete,error:delErrDb}=await sb.from(table).select('*').eq(key,row[key]).limit(1)
    if(delErrDb) throw new Error(`db verify delete fail: ${delErrDb.message}`)
    if(!afterDelete?.length) throw new Error('row missing after soft delete')
    const r=afterDelete[0]
    if(!(r.is_active===false && r.deleted_at)) throw new Error('soft delete columns invalid')

    tc.actual=`create/edit/soft-delete pass; key=${key}:${row[key]}`
    tc.pass=true
    tc.sql_verify=[`SELECT * FROM public.${table} WHERE ${key}='${row[key]}';`]
    return tc
  }catch(e){
    tc.actual=e instanceof Error?e.message:String(e)
    tc.sql_verify=[`SELECT * FROM public.${table} ORDER BY 1 DESC LIMIT 20;`]
    return tc
  }
}

const env=envLocal()
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const sign=await sb.auth.signInWithPassword({email:EMAIL,password:PASSWORD})
if(sign.error) throw sign.error

const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()
await login(page)

const cases=[
  {table:'dm_kh',path:'/master-data/dm-kh',markerField:'ten_kh',supportsSoftDelete:true},
  {table:'dm_duan',path:'/master-data/dm-duan',markerField:'ten_da',supportsSoftDelete:true},
  {table:'dm_ncc',path:'/master-data/dm-ncc',markerField:'ten_ncc',supportsSoftDelete:true},
  {table:'nvl',path:'/master-data/nvl',markerField:'ten_hang',supportsSoftDelete:true},
  {table:'gia_nvl',path:'/master-data/gia-nvl',markerField:'don_gia',supportsSoftDelete:false},
  {table:'dm_coc_template',path:'/master-data/dm-coc-template',markerField:'loai_coc',supportsSoftDelete:true},
  {table:'dm_dinh_muc_phu_md',path:'/master-data/dm-dinh-muc-phu-md',markerField:'nhom_d',supportsSoftDelete:true},
  {table:'dm_capphoi_bt',path:'/master-data/dm-capphoi-bt',markerField:'mac_be_tong',supportsSoftDelete:true},
]

const results=[]
for(const c of cases){ results.push(await retestCase(page,sb,c)) }
console.log(JSON.stringify(results,null,2))
fs.writeFileSync('.tmp-master-retest-after-fix.json',JSON.stringify(results,null,2))

await ctx.close(); await browser.close()

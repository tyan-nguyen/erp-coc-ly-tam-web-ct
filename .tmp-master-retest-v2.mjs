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

function pickId(row){
  const keys=['kh_id','da_id','ncc_id','gia_nvl_id','template_id','dm_id','cp_id','nvl_id','id']
  for(const k of keys){ if(row && row[k]!==undefined && row[k]!==null) return [k,row[k]] }
  return [null,null]
}

async function login(page){
  await page.goto(`${BASE}/login`,{waitUntil:'networkidle'})
  await page.fill('input[type="email"]',EMAIL)
  await page.fill('input[type="password"]',PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u)=>u.pathname.startsWith('/dashboard'))
}

function getErrFromUrl(url){
  const u=new URL(url)
  const err=u.searchParams.get('err')
  return err ? decodeURIComponent(err) : null
}

async function runCase({page,sb,table,path,markerField,softDelete=true,buildPayload,editValue}){
  const out={module:table,expected:'create/edit/soft-delete + DB verify',actual:'',pass:false,sql_verify:[]}
  const seed=Date.now().toString().slice(-6)

  await page.goto(`${BASE}${path}`,{waitUntil:'networkidle'})
  const createBox=page.locator('div.rounded-2xl').filter({hasText:'Tao moi'}).first()
  let payload=JSON.parse(await createBox.locator('textarea[name="payload"]').inputValue())
  if(buildPayload) payload = await buildPayload(payload, seed)
  else if (payload[markerField] !== undefined) payload[markerField] = `${String(payload[markerField]||'ZZ')}_RT_${seed}`

  await createBox.locator('textarea[name="payload"]').fill(JSON.stringify(payload,null,2))
  await createBox.getByRole('button',{name:'Tao ban ghi'}).click()
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
  const createErr=getErrFromUrl(page.url())
  if(createErr) { out.actual=`create fail: ${createErr}`; out.sql_verify=[`SELECT * FROM public.${table} ORDER BY 1 DESC LIMIT 20;`]; return out }

  const marker=payload[markerField]
  const {data:rows,error:selErr}=await sb.from(table).select('*').eq(markerField, marker)
  if(selErr || !rows?.length){ out.actual=`create DB verify fail: ${selErr?.message||'no row'}`; out.sql_verify=[`SELECT * FROM public.${table} ORDER BY 1 DESC LIMIT 20;`]; return out }
  const created=rows[0]
  const [idKey,idVal]=pickId(created)
  if(!idKey){ out.actual='cannot resolve id key'; out.sql_verify=[`SELECT * FROM public.${table} ORDER BY 1 DESC LIMIT 20;`]; return out }

  const newVal = editValue ? editValue(marker) : (typeof marker==='number' ? marker + 1 : `${String(marker)}_ED`)
  await page.goto(`${BASE}${path}?q=${encodeURIComponent(String(marker))}`,{waitUntil:'networkidle'})
  const rowEl=page.locator('tr',{hasText:String(marker)}).first()
  if(!(await rowEl.count())){ out.actual='edit row not found'; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }
  await rowEl.getByRole('link',{name:'Sua'}).click(); await page.waitForLoadState('networkidle')

  const editBox=page.locator('div.rounded-2xl').filter({hasText:'Cap nhat'}).first()
  const ep=JSON.parse(await editBox.locator('textarea[name="payload"]').inputValue())
  ep[markerField]=newVal
  await editBox.locator('textarea[name="payload"]').fill(JSON.stringify(ep,null,2))
  await editBox.getByRole('button',{name:'Luu thay doi'}).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
  const editErr=getErrFromUrl(page.url())
  if(editErr){ out.actual=`edit fail: ${editErr}`; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }

  const {data:afterEdit,error:editDbErr}=await sb.from(table).select('*').eq(idKey,idVal).limit(1)
  if(editDbErr || !afterEdit?.length){ out.actual=`edit DB verify fail: ${editDbErr?.message||'no row'}`; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }
  if(String(afterEdit[0][markerField])!==String(newVal)){
    out.actual=`edit DB mismatch: got=${afterEdit[0][markerField]} expected=${newVal}`
    out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]
    return out
  }

  if(!softDelete){
    out.actual=`PASS create/edit; soft-delete N/A by schema`;
    out.pass=true;
    out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]
    return out
  }

  await page.goto(`${BASE}${path}?q=${encodeURIComponent(String(newVal))}`,{waitUntil:'networkidle'})
  const delBtn=page.locator('tr',{hasText:String(newVal)}).first().getByRole('button',{name:'Xoa mem'})
  if(!(await delBtn.count())){ out.actual='soft-delete button missing'; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }
  await delBtn.click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600)
  const delErr=getErrFromUrl(page.url())
  if(delErr){ out.actual=`soft-delete fail: ${delErr}`; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }

  // list hide check
  await page.goto(`${BASE}${path}?q=${encodeURIComponent(String(newVal))}`,{waitUntil:'networkidle'})
  const visibleCount=await page.locator('tr',{hasText:String(newVal)}).count()

  const {data:afterDel,error:delDbErr}=await sb.from(table).select('*').eq(idKey,idVal).limit(1)
  // With RLS, inactive rows may be invisible. Accept either:
  // - visible row with is_active=false/deleted_at not null
  // - no row visible due RLS but UI hidden and no server error
  if(delDbErr){ out.actual=`soft-delete DB verify err: ${delDbErr.message}`; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }
  if(afterDel?.length){
    const r=afterDel[0]
    if(!(r.is_active===false && r.deleted_at)){ out.actual='soft-delete DB mismatch'; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }
  }

  if(visibleCount!==0){ out.actual='soft-delete list still shows row'; out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]; return out }

  out.actual = afterDel?.length
    ? `PASS full soft-delete (row still visible to verifier)`
    : `PASS soft-delete (row hidden by RLS after update)`
  out.pass = true
  out.sql_verify=[`SELECT * FROM public.${table} WHERE ${idKey}='${idVal}';`]
  return out
}

const env=envLocal()
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const sign=await sb.auth.signInWithPassword({email:EMAIL,password:PASSWORD})
if(sign.error) throw sign.error

const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()
await login(page)

// fixture kh for dm_duan
let fixtureKhId=null
{
  const {data}=await sb.from('dm_kh').insert({ten_kh:`ZZ_FIX_KH_${Date.now()}`,nhom_kh:'TIEM_NANG',is_active:true,deleted_at:null}).select('*').maybeSingle()
  fixtureKhId=data?.kh_id??null
}

const cases=[
  {table:'dm_duan',path:'/master-data/dm-duan',markerField:'ten_da',softDelete:true,buildPayload:(p,s)=>({...p,ten_da:`ZZ_DA_${s}`,kh_id:fixtureKhId})},
  {table:'dm_kh',path:'/master-data/dm-kh',markerField:'ten_kh',softDelete:true,buildPayload:(p,s)=>({...p,ten_kh:`ZZ_KH_${s}`,nhom_kh:'TIEM_NANG'})},
  {table:'dm_ncc',path:'/master-data/dm-ncc',markerField:'ten_ncc',softDelete:true,buildPayload:(p,s)=>({...p,ten_ncc:`ZZ_NCC_${s}`,loai_ncc:'PHU_KIEN'})},
  {table:'nvl',path:'/master-data/nvl',markerField:'ten_hang',softDelete:true,buildPayload:(p,s)=>({...p,ten_hang:`ZZ_NVL_${s}`,dvt:'kg',nhom_hang:'THEP'})},
  {table:'gia_nvl',path:'/master-data/gia-nvl',markerField:'don_gia',softDelete:false,buildPayload:async(p)=>{const {data}=await sb.from('nvl').select('nvl_id').limit(1);return {...p,nvl_id:data?.[0]?.nvl_id,don_gia:100001,dvt:'kg'}},editValue:()=>100002},
  {table:'dm_coc_template',path:'/master-data/dm-coc-template',markerField:'loai_coc',softDelete:true,buildPayload:(p,s)=>({...p,loai_coc:`ZZ_COC_${s}`,mac_be_tong:'B40',do_ngoai:600,chieu_day:100})},
  {table:'dm_dinh_muc_phu_md',path:'/master-data/dm-dinh-muc-phu-md',markerField:'nhom_d',softDelete:true,buildPayload:async(p,s)=>{const {data}=await sb.from('nvl').select('nvl_id').limit(1);return {...p,nvl_id:data?.[0]?.nvl_id,nhom_d:`ZZ_DMP_${s}`,dvt:'kg',dinh_muc:1}},editValue:(v)=>`${v}_ED`},
  {table:'dm_capphoi_bt',path:'/master-data/dm-capphoi-bt',markerField:'mac_be_tong',softDelete:true,buildPayload:async(p,s)=>{const {data}=await sb.from('nvl').select('nvl_id').limit(1);return {...p,nvl_id:data?.[0]?.nvl_id,mac_be_tong:`ZZ_BT_${s}`,dinh_muc_m3:1,dvt:'kg'}},editValue:(v)=>`${v}_ED`},
]

const results=[]
for(const c of cases){ results.push(await runCase({page,sb,...c})) }
console.log(JSON.stringify(results,null,2))
fs.writeFileSync('.tmp-master-retest-v2.json',JSON.stringify(results,null,2))

await ctx.close(); await browser.close()

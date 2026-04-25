import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.join(process.cwd(), '.env.local')
const env = fs.readFileSync(envPath, 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (!m) continue
  process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function parseMeta(raw) {
  const prefix = 'ERP_BAO_GIA_META::'
  const text = String(raw || '')
  if (!text.startsWith(prefix)) return {}
  try {
    return JSON.parse(text.slice(prefix.length))
  } catch {
    return {}
  }
}

const { data: orders, error: orderError } = await supabase
  .from('don_hang')
  .select('order_id, ma_order, boc_id, da_id, kh_id, loai_coc, created_at, is_active')
  .eq('is_active', true)
  .order('created_at', { ascending: false })

if (orderError) {
  console.error('ORDER_ERROR', orderError)
  process.exit(1)
}

const targetByCode = (orders || []).find((row) => row.ma_order === 'DH-0021')
console.log('TARGET_BY_CODE', targetByCode || null)

const { data: projects } = await supabase
  .from('dm_duan')
  .select('da_id, ten_da')
  .ilike('ten_da', '%Hiệp Mỹ Tây%')

const { data: customers } = await supabase
  .from('dm_kh')
  .select('kh_id, ten_kh')
  .ilike('ten_kh', '%Tiến Lực%')

console.log('PROJECT_MATCHES', projects || [])
console.log('CUSTOMER_MATCHES', customers || [])

const projectIds = new Set((projects || []).map((row) => row.da_id))
const customerIds = new Set((customers || []).map((row) => row.kh_id))
const matchedOrders = (orders || []).filter((row) => projectIds.has(row.da_id) && customerIds.has(row.kh_id))
console.log('MATCHED_ORDERS', matchedOrders)

const bocIds = matchedOrders.map((row) => row.boc_id).filter(Boolean)
if (bocIds.length) {
  const { data: links, error: linkError } = await supabase
    .from('bao_gia_boc_tach')
    .select('quote_id, boc_id')
    .in('boc_id', bocIds)
  if (linkError) {
    console.error('LINK_ERROR', linkError)
    process.exit(1)
  }
  console.log('LINKS', links || [])

  const quoteIds = [...new Set((links || []).map((row) => row.quote_id).filter(Boolean))]
  if (quoteIds.length) {
    const { data: quotes, error: quoteError } = await supabase
      .from('bao_gia')
      .select('quote_id, ma_bao_gia, trang_thai, ghi_chu, updated_at, is_active')
      .in('quote_id', quoteIds)
      .eq('is_active', true)

    if (quoteError) {
      console.error('QUOTE_ERROR', quoteError)
      process.exit(1)
    }

    console.log(
      'QUOTES',
      (quotes || []).map((row) => ({
        quote_id: row.quote_id,
        ma_bao_gia: row.ma_bao_gia,
        trang_thai: row.trang_thai,
        meta: parseMeta(row.ghi_chu),
      }))
    )
  }
}

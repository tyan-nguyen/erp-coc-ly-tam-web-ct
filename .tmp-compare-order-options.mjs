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

const { loadDonHangList } = await import('./lib/don-hang/repository.ts')
const { loadXuatHangPageData } = await import('./lib/xuat-hang/repository.ts')

try {
  const approvedOrders = await loadDonHangList(supabase, { viewerRole: 'qlsx' })
  const pageData = await loadXuatHangPageData(supabase, 'ke toan ban hang')
  const interesting = approvedOrders.filter((item) => ['DH-0019', 'DH-0021'].includes(String(item.order.ma_order || '')))
  console.log('APPROVED_ORDERS', interesting.map((item) => ({
    maOrder: item.order.ma_order,
    orderId: item.order.order_id,
    bocId: item.order.boc_id,
    productionApproved: item.linkedQuote.productionApproved,
    quoteId: item.linkedQuote.quoteId,
    maBaoGia: item.linkedQuote.maBaoGia,
    khachHangName: item.khachHangName,
    duAnName: item.duAnName,
  })))
  console.log('ORDER_OPTIONS', pageData.orderOptions.filter((item) => ['DH-0019', 'DH-0021'].includes(String(item.maOrder || ''))))
} catch (error) {
  console.error(error)
  process.exit(1)
}

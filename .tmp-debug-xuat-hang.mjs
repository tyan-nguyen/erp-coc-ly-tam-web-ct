import { createClient } from '@supabase/supabase-js'
import { loadXuatHangPageData } from './lib/xuat-hang/repository.ts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const data = await loadXuatHangPageData(supabase, 'admin')

const orderRows = data.orderSources.filter((row) => row.maOrder === 'DH-0021')
const stockRows = data.stockSources.filter((row) => row.loaiCoc === 'PHC - A500 - 100')

console.log(JSON.stringify({
  orderRows,
  stockRows,
}, null, 2))

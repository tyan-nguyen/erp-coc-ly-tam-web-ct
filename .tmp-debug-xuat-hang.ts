import { createClient } from '@supabase/supabase-js'
import { loadXuatHangPageData } from '@/lib/xuat-hang/repository'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing env')

  const supabase = createClient(url, key)
  const data = await loadXuatHangPageData(supabase, 'admin')

  const orderRows = data.orderSources.filter((row) => row.maOrder === 'DH-0021')
  const stockRows = data.stockSources.filter((row) => row.loaiCoc === 'PHC - A500 - 100')

  console.log(JSON.stringify({ orderRows, stockRows }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

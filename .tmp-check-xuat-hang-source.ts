import { createClient } from '@supabase/supabase-js'
import { loadXuatHangCreateBootstrap } from '@/lib/xuat-hang/repository'

async function main() {
  const quoteMatcher = process.argv[2]
  const keyword = process.argv[3] || ''
  if (!quoteMatcher) throw new Error('Missing quote matcher')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const data = await loadXuatHangCreateBootstrap(supabase as never, 'admin')
  const matchedQuote = data.quoteOptions.find(
    (item) => item.quoteId === quoteMatcher || item.maBaoGia === quoteMatcher
  )
  if (!matchedQuote) {
    console.log(
      JSON.stringify(
        {
          error: 'quote_not_found',
          availableQuotes: data.quoteOptions.map((item) => ({ quoteId: item.quoteId, maBaoGia: item.maBaoGia })),
        },
        null,
        2
      )
    )
    return
  }
  const rows = data.orderSources.filter((row) => row.quoteId === matchedQuote.quoteId)
  const filtered = keyword
    ? rows.filter((row) => row.itemLabel.toLowerCase().includes(keyword.toLowerCase()))
    : rows

  console.log(
    JSON.stringify(
      filtered.map((row) => ({
        itemLabel: row.itemLabel,
        maBaoGia: row.maBaoGia,
        stockSourceKey: row.stockSourceKey,
        shippedQty: row.shippedQty,
        physicalQty: row.physicalQty,
        availableQty: row.availableQty,
        reservedQty: row.reservedQty,
        reservedByVouchers: row.reservedByVouchers,
      })),
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import { createClient } from '@supabase/supabase-js'
import { loadFinishedGoodsCountDetail } from './lib/finished-goods-counting/repository'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing Supabase env')
    process.exit(1)
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  try {
    const detail = await loadFinishedGoodsCountDetail({
      supabase,
      countSheetId: 'e673497c-fb93-4147-877e-9c034bd72ce6',
    })
    console.log(JSON.stringify({
      countMode: detail.countMode,
      status: detail.status,
      lines: detail.lines.map((line) => ({
        lineNo: line.lineNo,
        itemLabel: line.itemLabel,
        printableLots: line.printableLots,
      })),
    }, null, 2))
  } catch (error) {
    console.error('DETAIL_ERROR')
    console.error(error)
    if (error && typeof error === 'object') {
      console.error(JSON.stringify(error, null, 2))
    }
    process.exit(1)
  }
}

main()

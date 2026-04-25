import { createClient } from '@supabase/supabase-js'
import { loadFinishedGoodsCountDetail } from './lib/finished-goods-counting/repository'

async function main() {
  const countSheetId = process.argv[2]
  if (!countSheetId) {
    throw new Error('Missing countSheetId')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase env')
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const detail = await loadFinishedGoodsCountDetail({
    supabase,
    countSheetId,
  })

  console.log(JSON.stringify(detail, null, 2))
}

main().catch((error) => {
  console.error('DEBUG_ERROR_START')
  console.error(JSON.stringify(error, null, 2))
  console.error('DEBUG_ERROR_END')
  process.exit(1)
})

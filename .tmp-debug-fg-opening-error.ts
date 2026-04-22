import { createClient } from '@supabase/supabase-js'
import { loadFinishedGoodsCountDetail } from './lib/finished-goods-counting/repository'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const countSheetId = 'e673497c-fb93-4147-877e-9c034bd72ce6'

async function main() {
  try {
    const detail = await loadFinishedGoodsCountDetail({ supabase, countSheetId })
    console.log(
      JSON.stringify(
        {
          ok: true,
          countMode: detail?.countMode,
          lines: detail?.lines.length,
          printableLots: detail?.lines.map((line) => ({
            lineNo: line.lineNo,
            printableLots: line.printableLots,
          })),
        },
        null,
        2
      )
    )
  } catch (error) {
    console.error('RAW_ERROR', error)
    if (error && typeof error === 'object') {
      console.error(
        'JSON',
        JSON.stringify(
          {
            code: 'code' in error ? (error as { code?: unknown }).code : undefined,
            message: 'message' in error ? (error as { message?: unknown }).message : String(error),
            details: 'details' in error ? (error as { details?: unknown }).details : undefined,
            hint: 'hint' in error ? (error as { hint?: unknown }).hint : undefined,
          },
          null,
          2
        )
      )
    }
    process.exit(1)
  }
}

main()

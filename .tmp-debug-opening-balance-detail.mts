import { createClient } from '@supabase/supabase-js'
import repoModule from './lib/finished-goods-counting/repository.ts'

const repo = (repoModule as any)?.default ?? repoModule
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing Supabase envs')

const supabase = createClient(url, key)
const countSheetId = process.argv[2]

console.log('REPO_KEYS', Object.keys(repo || {}))

try {
  const detail = await repo.loadFinishedGoodsCountDetail({ supabase, countSheetId })
  console.log(JSON.stringify({
    ok: true,
    code: detail?.countSheetCode,
    mode: detail?.countMode,
    linePrintableLots: detail?.lines.map((x: any) => ({ lineNo: x.lineNo, printableLots: x.printableLots })),
  }, null, 2))
} catch (error) {
  console.error('ERROR_JSON', JSON.stringify(error, null, 2))
  console.error('ERROR_MESSAGE', error instanceof Error ? error.message : String(error))
  process.exit(1)
}

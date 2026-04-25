import { createClient } from '@supabase/supabase-js'
import repo from './lib/finished-goods-counting/repository.ts'

const supabase = createClient(
  'https://bnrdgdskdpauwbkfnzcv.supabase.co',
  'sb_publishable_iCXEcsm2khHtvhvV1Z9X4w_A5cL7LpD'
)

const countSheetId = 'e673497c-fb93-4147-877e-9c034bd72ce6'

console.log('default keys', Object.keys((repo as any) || {}))

try {
  const detail = await (repo as any).loadFinishedGoodsCountDetail({ supabase, countSheetId })
  console.log(JSON.stringify(detail, null, 2))
} catch (error) {
  console.error('ERR RAW', error)
  console.error('ERR JSON', JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2))
}

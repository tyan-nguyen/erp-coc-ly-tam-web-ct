import { createClient } from '@supabase/supabase-js'
import { loadFinishedGoodsCountDetail } from './lib/finished-goods-counting/repository'
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith(') && value.endsWith(')) || (value.startsWith(") && value.endsWith("))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey) throw new Error('Missing supabase env')

const countSheetId = process.argv[2]
if (!countSheetId) throw new Error('Missing countSheetId')

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

loadFinishedGoodsCountDetail({ supabase, countSheetId })
  .then((detail) => {
    console.log(JSON.stringify({ ok: true, countMode: detail?.countMode, lines: detail?.lines.map((line) => ({ lineNo: line.lineNo, printableLots: line.printableLots })) }, null, 2))
  })
  .catch((error) => {
    console.error('DEBUG_ERROR', JSON.stringify({
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    }, null, 2))
    process.exit(1)
  })

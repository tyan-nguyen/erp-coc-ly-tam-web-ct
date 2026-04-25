import { createClient } from '@supabase/supabase-js'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing Supabase env')
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, status, count_date, created_at, payload_json')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error

  const rows = (data || [])
    .filter((row) => {
      const payload = (row.payload_json as Record<string, unknown> | null) || {}
      return (
        normalizeText(row.count_type).toUpperCase() === 'OPENING_BALANCE' ||
        normalizeText(payload.countMode).toUpperCase() === 'TON_DAU_KY'
      )
    })
    .map((row) => ({
      countSheetId: normalizeText(row.count_sheet_id),
      countSheetCode: normalizeText(row.count_sheet_code),
      countType: normalizeText(row.count_type),
      status: normalizeText(row.status),
      countDate: normalizeText(row.count_date),
      createdAt: normalizeText(row.created_at),
    }))

  console.log(JSON.stringify(rows, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

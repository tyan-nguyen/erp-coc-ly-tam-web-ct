import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

async function main() {
  const { data, error } = await supabase
    .from('phieu_xuat_ban')
    .select('voucher_id, created_at, payload_json')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(3)

  console.log(JSON.stringify({ error, data }, null, 2))
}

void main()

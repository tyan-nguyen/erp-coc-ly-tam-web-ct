import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

async function main() {
  const loaiCoc = 'PHC - A500 - 100'
  const tenDoan = 'MUI'
  const chieuDaiM = 8

  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, loai_coc, ten_doan, chieu_dai_m, qc_status, disposition_status, lifecycle_status, current_shipment_voucher_id, is_active',
      { count: 'exact' }
    )
    .eq('is_active', true)
    .eq('loai_coc', loaiCoc)
    .eq('ten_doan', tenDoan)
    .eq('chieu_dai_m', chieuDaiM)

  console.log(
    JSON.stringify(
      {
        loaiCoc,
        tenDoan,
        chieuDaiM,
        error: error ? { message: error.message, code: (error as { code?: string }).code } : null,
        count: data?.length ?? 0,
        sample: (data || []).slice(0, 10),
      },
      null,
      2
    )
  )
}

void main()

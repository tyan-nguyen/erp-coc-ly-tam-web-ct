import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadBocTachReferenceData } from '@/lib/boc-tach/repository'

export async function GET() {
  try {
    const supabase = await createClient()
    const refs = await loadBocTachReferenceData(supabase, { includeFinancialData: true })
    return NextResponse.json({ ok: true, data: refs })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Không tải được dữ liệu bóc tách.',
      },
      { status: 500 }
    )
  }
}

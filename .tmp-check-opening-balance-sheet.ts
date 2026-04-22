import { createClient } from '@supabase/supabase-js'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

async function main() {
  const countSheetCode = process.argv[2]
  if (!countSheetCode) {
    throw new Error('Missing count sheet code')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing Supabase env')
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: header, error: headerError } = await supabase
    .from('inventory_count_sheet')
    .select('count_sheet_id, count_sheet_code, count_type, status, count_date, payload_json')
    .eq('count_sheet_code', countSheetCode)
    .maybeSingle()

  if (headerError) throw headerError
  if (!header) {
    console.log(JSON.stringify({ found: false, countSheetCode }, null, 2))
    return
  }

  const countSheetId = normalizeText(header.count_sheet_id)

  const { data: lines, error: lineError } = await supabase
    .from('inventory_count_line')
    .select('count_line_id, line_no, item_name, counted_qty, payload_json')
    .eq('count_sheet_id', countSheetId)
    .order('line_no', { ascending: true })

  if (lineError) throw lineError

  const { data: draftSerials, error: draftSerialsError } = await supabase
    .from('pile_serial')
    .select('serial_id, serial_code, lot_id, notes, is_active')
    .ilike('notes', `%Mở tồn từ phiếu ${countSheetCode}%`)
    .order('serial_code', { ascending: true })

  if (draftSerialsError) throw draftSerialsError

  const lotIds = Array.from(new Set((draftSerials || []).map((row) => normalizeText(row.lot_id)).filter(Boolean)))

  const { data: lots, error: lotError } =
    lotIds.length > 0
      ? await supabase
          .from('production_lot')
          .select('lot_id, lot_code, actual_qty, is_active')
          .in('lot_id', lotIds)
      : { data: [], error: null }

  if (lotError) throw lotError

  const lotsById = new Map((lots || []).map((row) => [normalizeText(row.lot_id), row]))

  const result = {
    found: true,
    header: {
      countSheetId,
      countSheetCode: normalizeText(header.count_sheet_code),
      countType: normalizeText(header.count_type),
      status: normalizeText(header.status),
      countDate: normalizeText(header.count_date),
      payload: header.payload_json,
    },
    lines: (lines || []).map((line) => {
      const payload = (line.payload_json as Record<string, unknown> | null) || {}
      return {
        countLineId: normalizeText(line.count_line_id),
        lineNo: Number(line.line_no || 0),
        itemName: normalizeText(line.item_name),
        countedQty: Number(line.counted_qty || 0),
        draftPrintableLots: Array.isArray(payload.draftPrintableLots) ? payload.draftPrintableLots : [],
        payloadKeys: Object.keys(payload).sort(),
      }
    }),
    draftSerialCount: (draftSerials || []).length,
    draftLots: lotIds.map((lotId) => {
      const lot = lotsById.get(lotId)
      const serialCount = (draftSerials || []).filter((row) => normalizeText(row.lot_id) === lotId).length
      return {
        lotId,
        lotCode: normalizeText(lot?.lot_code),
        actualQty: Number(lot?.actual_qty || 0),
        isActive: Boolean(lot?.is_active),
        serialCount,
      }
    }),
    draftSerialPreview: (draftSerials || []).slice(0, 10).map((row) => ({
      serialId: normalizeText(row.serial_id),
      serialCode: normalizeText(row.serial_code),
      lotId: normalizeText(row.lot_id),
      isActive: Boolean(row.is_active),
      notes: normalizeText(row.notes),
    })),
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import { createClient } from '@/lib/supabase/server'

type RowData = Record<string, unknown>

export type BocTachListRow = {
  id: string
  displayId: string
  daId: string
  khId: string
  duAn: string
  khachHang: string
  loaiCoc: string
  soLuongMd: number
  phuongThucVanChuyen: string
  trangThai: string
  trangThaiLabel: string
  canDelete: boolean
  createdAt: string
  linkedQuoteStatus: string | null
}

export type BocTachListPageData = {
  rows: BocTachListRow[]
  error: { message: string } | null
}

export async function loadBocTachListPageData(input: {
  qlsxViewer: boolean
}) {
  const supabase = await createClient()
  const [{ data: headerRows, error }, { data: projectRows }, { data: customerRows }, quoteStatusByBocId] = await Promise.all([
    loadBocTachHeadersForList(supabase),
    supabase.from('dm_duan').select('da_id, ma_da, ten_da').limit(500),
    supabase.from('dm_kh').select('kh_id, ma_kh, ten_kh').limit(500),
    loadQuoteStatusByBocId(supabase),
  ])

  const rows = (headerRows ?? []) as RowData[]
  const projectMap = new Map(
    ((projectRows ?? []) as RowData[]).map((row) => [
      String(row.da_id ?? ''),
      {
        ma_da: String(row.ma_da ?? ''),
        ten_da: String(row.ten_da ?? ''),
      },
    ])
  )
  const customerMap = new Map(
    ((customerRows ?? []) as RowData[]).map((row) => [
      String(row.kh_id ?? ''),
      {
        ma_kh: String(row.ma_kh ?? ''),
        ten_kh: String(row.ten_kh ?? ''),
      },
    ])
  )

  const listRows = rows
    .map((row) => {
      const id = resolveHeaderId(row)
      const project = projectMap.get(String(row.da_id ?? ''))
      const customer = customerMap.get(String(row.kh_id ?? ''))
      const loaiCoc = String(row.loai_coc ?? '').trim() || 'Chưa có loại cọc'
      const totalMd = deriveTotalMd(row)
      const status = String(row.trang_thai ?? 'NHAP')

      return {
        id,
        displayId: buildDisplayId(id, project?.ma_da || project?.ten_da || '', loaiCoc),
        daId: String(row.da_id ?? ''),
        khId: String(row.kh_id ?? ''),
        duAn: [project?.ma_da, project?.ten_da].filter(Boolean).join(' - ') || 'Chưa có dự án',
        khachHang: [customer?.ma_kh, customer?.ten_kh].filter(Boolean).join(' - ') || 'Chưa có khách hàng',
        loaiCoc,
        soLuongMd: totalMd,
        phuongThucVanChuyen: String(row.phuong_thuc_van_chuyen ?? ''),
        trangThai: status,
        trangThaiLabel: formatStatusLabel(status),
        canDelete: status === 'NHAP' || status === 'TRA_LAI',
        createdAt: String(row.created_at ?? row.gui_qlsx_at ?? row.updated_at ?? ''),
        linkedQuoteStatus: quoteStatusByBocId.get(id) ?? null,
      } satisfies BocTachListRow
    })
    .filter((row) =>
      input.qlsxViewer ? row.trangThai === 'DA_GUI' || row.trangThai === 'DA_DUYET_QLSX' : true
    )
    .sort((left, right) => compareRowsDesc(left.createdAt, right.createdAt, left.id, right.id))

  return {
    rows: listRows,
    error: error ? { message: error.message } : null,
  } satisfies BocTachListPageData
}

async function loadQuoteStatusByBocId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: linkRows, error: linkError }, { data: quoteRows, error: quoteError }] = await Promise.all([
    supabase.from('bao_gia_boc_tach').select('quote_id, boc_id').limit(1000),
    supabase.from('bao_gia').select('quote_id, trang_thai, updated_at').eq('is_active', true).limit(1000),
  ])

  if (linkError) throw linkError
  if (quoteError) throw quoteError

  const quoteMap = new Map(
    ((quoteRows ?? []) as RowData[]).map((row) => [
      String(row.quote_id ?? ''),
      {
        status: String(row.trang_thai ?? ''),
        updatedAt: new Date(String(row.updated_at ?? '')).getTime() || 0,
      },
    ])
  )

  const result = new Map<string, string>()
  for (const row of (linkRows ?? []) as RowData[]) {
    const bocId = String(row.boc_id ?? '')
    const quoteId = String(row.quote_id ?? '')
    const quote = quoteMap.get(quoteId)
    if (!bocId || !quote) continue

    const currentStatus = result.get(bocId)
    if (currentStatus === 'THAT_BAI') continue
    result.set(bocId, quote.status)
  }

  return result
}

async function loadBocTachHeadersForList(supabase: Awaited<ReturnType<typeof createClient>>) {
  const optimizedSelect =
    'boc_id,boc_tach_id,id,da_id,kh_id,loai_coc,to_hop_doan,trang_thai,phuong_thuc_van_chuyen,created_at,updated_at,gui_qlsx_at'

  const optimizedAttempt = await supabase
    .from('boc_tach_nvl')
    .select(optimizedSelect)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (!optimizedAttempt.error) {
    return optimizedAttempt
  }

  if (!optimizedAttempt.error.message.toLowerCase().includes('column')) {
    return optimizedAttempt
  }

  return supabase
    .from('boc_tach_nvl')
    .select('*')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
}

function resolveHeaderId(row: RowData) {
  return String(row.boc_id ?? row.boc_tach_id ?? row.id ?? '')
}

function deriveTotalMd(row: RowData) {
  const segments = Array.isArray(row.to_hop_doan) ? row.to_hop_doan : []
  return segments.reduce((acc, segment) => {
    if (!segment || typeof segment !== 'object') return acc
    const item = segment as Record<string, unknown>
    const len = Number(item.len_m ?? 0)
    const qty = Number(item.so_luong_doan ?? item.cnt ?? 0)
    if (!Number.isFinite(len) || !Number.isFinite(qty)) return acc
    return acc + len * qty
  }, 0)
}

function buildDisplayId(id: string, projectCode: string, loaiCoc: string) {
  const shortId = id.slice(-6).toUpperCase()
  const projectPart = projectCode || 'BT'
  return `${projectPart} · ${loaiCoc} · ${shortId}`
}

function formatStatusLabel(status: string) {
  switch (status) {
    case 'DA_GUI':
      return 'Đã gửi QLSX'
    case 'TRA_LAI':
      return 'Trả lại chỉnh sửa'
    case 'DA_DUYET_QLSX':
      return 'Đã duyệt QLSX'
    case 'HUY':
      return 'Hủy'
    case 'NHAP':
    default:
      return 'Nháp'
  }
}

function compareRowsDesc(leftDate: string, rightDate: string, leftId: string, rightId: string) {
  const leftTime = leftDate ? new Date(leftDate).getTime() : 0
  const rightTime = rightDate ? new Date(rightDate).getTime() : 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return rightId.localeCompare(leftId)
}

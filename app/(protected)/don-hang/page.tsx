import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isQlsxRole } from '@/lib/auth/roles'
import { loadDonHangListPageData } from '@/lib/don-hang/page-data'

type SearchParams = Promise<{
  q?: string
  trang_thai?: string
}>

export default async function DonHangListPage(props: {
  searchParams: SearchParams
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const { rows } = await loadDonHangListPageData(supabase, {
    query: searchParams.q,
    trangThai: searchParams.trang_thai,
    viewerRole: profile.role,
  })
  const qlsxViewer = isQlsxRole(profile.role)

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Don hang
            </div>
            <h1 className="mt-4 text-2xl font-bold">Danh sach don hang</h1>
            <p className="app-muted mt-2 text-sm">
              {qlsxViewer
                ? 'QLSX chỉ thấy các đơn hàng đã được Kế toán bán hàng duyệt sản xuất.'
                : 'Đơn hàng được tạo từ bóc tách và vận hành theo state machine trong DB.'}
            </p>
          </div>
        </div>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <form className="flex flex-wrap items-center gap-3">
          <input
            name="q"
            defaultValue={searchParams.q || ''}
            placeholder="Tim theo ma order, du an, khach hang, trang thai..."
            className="app-input w-full max-w-xl rounded-xl px-3 py-2 text-sm"
          />
          <input
            name="trang_thai"
            defaultValue={searchParams.trang_thai || ''}
            placeholder="Loc trang thai"
            className="app-input w-full max-w-xs rounded-xl px-3 py-2 text-sm"
          />
          <button type="submit" className="app-primary rounded-xl px-4 py-2 text-sm font-semibold transition">
            Loc
          </button>
        </form>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ket qua</h2>
          <p className="app-muted text-sm">{rows.length} don hang</p>
        </div>

        {rows.length === 0 ? (
          <p className="app-muted mt-4 text-sm">Chua co don hang nao.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="px-3 py-2">Chi tiet</th>
                  <th className="px-3 py-2">Ma order</th>
                  <th className="px-3 py-2">Trang thai</th>
                  <th className="px-3 py-2">Khach hang</th>
                  <th className="px-3 py-2">Du an</th>
                  <th className="px-3 py-2">Bao gia</th>
                  <th className="px-3 py-2">Duyet SX</th>
                  <th className="px-3 py-2">Loai coc</th>
                  <th className="px-3 py-2">Logs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.order.order_id}
                    className="border-b"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/don-hang/${item.order.order_id}`}
                        className="app-outline rounded-lg px-3 py-1 text-xs font-medium transition"
                      >
                        Mo
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">{item.order.ma_order || item.order.order_id}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold app-primary-soft">
                        {item.order.trang_thai_label || item.order.trang_thai}
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.khachHangName || item.order.kh_id}</td>
                    <td className="px-3 py-2">{item.duAnName || item.order.da_id}</td>
                    <td className="px-3 py-2">{item.linkedQuote.maBaoGia || '-'}</td>
                    <td className="px-3 py-2">{item.linkedQuote.productionApprovalLabel || '-'}</td>
                    <td className="px-3 py-2">{item.order.loai_coc}</td>
                    <td className="px-3 py-2">{item.timelineCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

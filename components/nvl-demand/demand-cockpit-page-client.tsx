'use client'

import { useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import type { NvlDemandCockpitPageData, NvlDemandStatus } from '@/lib/nvl-demand/types'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function resolveStatusLabel(status: NvlDemandStatus) {
  switch (status) {
    case 'COVERED':
      return 'Đã cover'
    case 'SHORTAGE':
      return 'Thiếu'
    case 'SURPLUS':
      return 'Dư'
    case 'RISK':
      return 'Rủi ro'
    default:
      return status
  }
}

export function NvlDemandCockpitPageClient(props: { pageData: NvlDemandCockpitPageData }) {
  const [onlyOverrunRisk, setOnlyOverrunRisk] = useState(false)
  const visibleRows = useMemo(
    () => (onlyOverrunRisk ? props.pageData.rows.filter((row) => row.hasOverrunRisk) : props.pageData.rows),
    [onlyOverrunRisk, props.pageData.rows]
  )
  const visibleSourcePlans = useMemo(
    () => {
      const sourcePlans = Array.isArray(props.pageData.sourcePlans) ? props.pageData.sourcePlans : []
      return onlyOverrunRisk ? sourcePlans.filter((plan) => plan.hasOverrunRisk) : sourcePlans
    },
    [onlyOverrunRisk, props.pageData.sourcePlans]
  )
  const showSourcePlans = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold">Decision cockpit cho NVL</h2>
            <p className="app-muted mt-2 text-sm">
              Màn này chưa phải ledger kho. Nó là nơi QLSX, KTMH và người duyệt nhìn cùng một bức tranh:
              nhu cầu, tồn hiện tại, hàng đang mua, reusable coverage và phần còn thiếu thật sự.
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Trạng thái</div>
            <div className="mt-2 text-base font-semibold">
              {props.pageData.mode === 'LIVE_DEMAND_ONLY' ? 'Demand thật / chưa nối tồn' : 'Full'}
            </div>
          </div>
        </div>

        {props.pageData.mode === 'LIVE_DEMAND_ONLY' ? (
          <div
            className="mt-5 rounded-2xl border px-4 py-4 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
              color: 'var(--color-primary)',
            }}
          >
            Màn này đang dùng <strong>demand thật từ các kế hoạch đã chốt</strong>. Các cột `Tồn hiện tại`, `Khả dụng`,
            `Đang mua` và `Coverage` sẽ được nối ở bước tiếp theo, nên hiện chưa dùng để ra quyết định mua cuối cùng.
            {props.pageData.stockTruthReady ? ' Schema stock truth đã sẵn sàng để nối ở phase kế tiếp.' : ' Schema stock truth hiện vẫn chưa có trong v2.'}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {props.pageData.summaryCards.map((card) => (
            <article key={card.label} className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold">{card.value}</div>
              <div className="app-muted mt-2 text-sm">{card.helpText}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">Các dòng minh họa quyết định</h3>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={onlyOverrunRisk} onChange={(event) => setOnlyOverrunRisk(event.target.checked)} />
            Chỉ hiện dòng có cảnh báo vượt
          </label>
        </div>
        <p className="app-muted mt-2 text-sm">
          Các dòng dưới đây đang là dữ liệu mẫu để khóa layout. Bước tiếp theo sẽ nối dần với demand snapshot,
          open inbound, coverage và stock truth thật.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="px-4 py-3">NVL</th>
                <th className="px-4 py-3">Kỳ nhu cầu</th>
                <th className="px-4 py-3 text-right">Số KHSX</th>
                <th className="px-4 py-3 text-right">Nhu cầu</th>
                <th className="px-4 py-3 text-right">Tồn hiện tại</th>
                <th className="px-4 py-3 text-right">Khả dụng</th>
                <th className="px-4 py-3 text-right">Đang mua</th>
                <th className="px-4 py-3 text-right">Coverage</th>
                <th className="px-4 py-3 text-right">Thiếu</th>
                <th className="px-4 py-3 text-right">Dư</th>
                <th className="px-4 py-3">Khuyến nghị</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{row.materialName}</div>
                    <div className="app-muted mt-1 text-xs">
                      {row.materialCode}
                      {row.unit ? ` · ${row.unit}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-4">{row.windowLabel}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.planCount)}</td>
                  <td className="px-4 py-4 text-right font-semibold">{formatNumber(row.demandQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.stockQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.availableQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.openInboundQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.reusableCoverageQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.shortageQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.surplusQty)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{row.recommendation}</div>
                      {row.hasOverrunRisk ? (
                        <span
                          className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                          style={{ backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)', color: '#b91c1c' }}
                        >
                          Vượt đơn hàng
                        </span>
                      ) : null}
                    </div>
                    <div className="app-muted mt-1 text-xs">{resolveStatusLabel(row.status)}</div>
                  </td>
                </tr>
              ))}
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center app-muted">
                    Không có dòng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <h3 className="text-lg font-semibold">Giải thích</h3>
        <div className="mt-4 space-y-3">
          {visibleRows.map((row) => (
            <article key={`${row.id}-explanation`} className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="font-semibold">{row.materialName}</div>
              <div className="app-muted mt-2 text-sm">{row.explanation}</div>
            </article>
          ))}
        </div>
      </section>

      {showSourcePlans ? (
        <section className="app-surface rounded-2xl p-6">
          <div>
            <h3 className="text-lg font-semibold">Nguồn demand theo kế hoạch</h3>
            <p className="app-muted mt-2 text-sm">
              Khối này cho thấy từng kế hoạch nào đang góp vào `Nhu cầu NVL`, và mỗi kế hoạch đang cộng bao nhiêu NVL.
              Nếu có dòng ra `0` hoặc thiếu NVL, mình sẽ lần theo đúng bảng này để sửa tiếp.
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {visibleSourcePlans.length ? (
              visibleSourcePlans.map((plan) => (
                <article
                  key={plan.planId}
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Kế hoạch {plan.planId}</div>
                    <div className="app-muted mt-1 text-sm">Ngày kế hoạch: {formatDateLabel(plan.ngayKeHoach)}</div>
                    <div className="app-muted mt-1 text-sm">
                      {plan.lineCount} dòng kế hoạch · Tổng SL kế hoạch: {formatNumber(plan.plannedQtyTotal)}
                    </div>
                    {plan.hasOverrunRisk ? (
                      <div className="mt-2 text-sm font-semibold" style={{ color: '#b91c1c' }}>
                        Kế hoạch này đang vượt đơn hàng ở {formatNumber(plan.overrunLineCount)} dòng.
                      </div>
                    ) : null}
                  </div>
                    <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                      {plan.materialRows.length} dòng NVL
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="min-w-full text-sm">
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="px-4 py-3">NVL</th>
                          <th className="px-4 py-3">Mã</th>
                          <th className="px-4 py-3 text-right">Nhu cầu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.materialRows.map((item) => (
                          <tr key={`${plan.planId}-${item.materialCode}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.materialName}</div>
                              <div className="app-muted mt-1 text-xs">{item.unit || '-'}</div>
                            </td>
                            <td className="px-4 py-3">{item.materialCode}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.demandQty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="min-w-full text-sm">
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="px-4 py-3">Dòng KH</th>
                          <th className="px-4 py-3 text-right">SL kế hoạch</th>
                          <th className="px-4 py-3 text-right">Base đoạn</th>
                          <th className="px-4 py-3 text-right">BT/mỗi cây</th>
                          <th className="px-4 py-3 text-right">PC/mỗi cây</th>
                          <th className="px-4 py-3 text-right">Đai/mỗi cây</th>
                          <th className="px-4 py-3 text-right">Buộc/mỗi cây</th>
                          <th className="px-4 py-3 text-right">Dòng NVL &gt; 0</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.lineDebugs.map((item) => (
                          <tr key={`${plan.planId}-${item.lineId}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.tenDoan || item.lineId}</div>
                              <div className="app-muted mt-1 text-xs">{item.lineId}</div>
                            </td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.plannedQty)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.segmentQtyBase)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.concretePerUnit)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.pcPerUnit)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.daiPerUnit)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.buocPerUnit)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.positiveMaterialCount)}</td>
                          </tr>
                        ))}
                        {plan.lineDebugs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-3 text-center app-muted">
                              Chưa có trace line-level cho kế hoạch này.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border px-4 py-4 text-sm app-muted" style={{ borderColor: 'var(--color-border)' }}>
                Hiện chưa có kế hoạch mở nào góp demand NVL.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

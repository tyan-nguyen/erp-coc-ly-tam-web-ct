'use client'

import { useState, useTransition } from 'react'
import { useProtectedSession } from '@/components/auth/protected-session-provider'
import { isQlsxRole } from '@/lib/auth/roles'
import { submitDonHangTransition } from '@/lib/don-hang/client-api'
import {
  filterTransitionsByRole,
  type DonHangDetail,
  type DonHangStateTransitionRow,
} from '@/lib/don-hang/repository'

type SegmentView = {
  key: string
  tenDoan: string
  chieuDaiM: number
  soLuongDoan: number
  tongMd: number
}

export function DonHangDetailClient(props: {
  orderId: string
  detail: DonHangDetail
  actorDisplayMap: Record<string, string>
}) {
  const { profile } = useProtectedSession()
  const [orderOverride, setOrderOverride] = useState<DonHangDetail['order'] | null>(null)
  const [latestTimelineOverride, setLatestTimelineOverride] = useState<DonHangDetail['timeline'][number] | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const detail = {
    ...props.detail,
    order: orderOverride || props.detail.order,
    timeline: latestTimelineOverride
      ? [latestTimelineOverride, ...props.detail.timeline.filter((row) => row.log_id !== latestTimelineOverride.log_id)]
      : props.detail.timeline,
  }

  const qlsxViewer = isQlsxRole(profile.role)
  const allowedTransitions = qlsxViewer ? [] : filterTransitionsByRole(detail.transitions, profile.role)
  const segments = parseSegments(detail.order.to_hop_doan)
  const totalMd = segments.reduce((sum, row) => sum + row.tongMd, 0)
  const displayBocId = buildDisplayBocId(
    detail.order.boc_id,
    detail.order.da_id,
    detail.order.loai_coc
  )

  function handleTransition(transition: DonHangStateTransitionRow) {
    setMessage('')
    setError('')

    startTransition(async () => {
      try {
        const result = await submitDonHangTransition({
          orderId: props.orderId,
          toState: transition.to_state,
          note,
        })

        if (result.data?.order) {
          setOrderOverride(result.data.order)
        }
        if (result.data?.latestLog) {
          setLatestTimelineOverride(result.data.latestLog)
        }
        setMessage(`Đã chuyển sang ${formatTransitionState(transition.to_state)}`)
        setNote('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không chuyển trạng thái được')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Mã đơn hàng" value={detail.order.ma_order || '-'} />
          <Info label="Trạng thái" value={detail.order.trang_thai_label || detail.order.trang_thai} />
          <Info label="Khách hàng" value={detail.khachHangName || detail.order.kh_id} />
          <Info label="Dự án" value={detail.duAnName || detail.order.da_id} />
          <Info label="Báo giá" value={detail.linkedQuote.maBaoGia || '-'} />
          <Info label="Duyệt sản xuất" value={detail.linkedQuote.productionApprovalLabel || 'Chưa duyệt sản xuất'} />
          <Info label="Loại cọc" value={detail.order.loai_coc} />
          <Info label="Độ ngoài" value={`D${formatNumber(detail.order.do_ngoai)}`} />
          <Info label="Mác bê tông" value={formatConcreteLabel(detail.order.mac_be_tong)} />
          <Info label="Nguồn bóc tách" value={displayBocId} />
          <Info label="Ngày yêu cầu giao" value={formatDate(detail.order.ngay_yeu_cau_giao)} />
          <Info label="Ngày dự kiến hoàn" value={formatDate(detail.order.ngay_du_kien_hoan)} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="app-surface rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Thông số kỹ thuật đơn hàng</h2>
              <p className="app-muted mt-2 text-sm">
                Hiển thị lại tổ hợp đoạn và tổng md để kỹ thuật, QLSX và admin nhìn nhanh đúng thông số đã chốt.
              </p>
            </div>
            <div className="text-right">
              <p className="app-muted text-xs">Tổng md</p>
              <p className="text-lg font-bold">{formatNumber(totalMd)}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Chiều dài (m)</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số đoạn</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Tổng md</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => (
                  <tr key={segment.key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3 font-semibold">{segment.tenDoan}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(segment.chieuDaiM)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(segment.soLuongDoan)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(segment.tongMd)}</td>
                  </tr>
                ))}
                {segments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                      Chưa có tổ hợp đoạn cho đơn hàng này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Info label="Giá bán gốc" value={displayNullableNumber(detail.order.gia_ban_goc)} />
            <Info label="Giá bán sau giảm" value={displayNullableNumber(detail.order.gia_ban_sau_giam)} />
          </div>

          <div className="mt-5">
            <p className="app-muted text-sm">Ghi chú hiện tại</p>
            <p className="mt-2 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--color-border)' }}>
              {detail.order.ghi_chu || '-'}
            </p>
          </div>
        </section>

        <section className="app-surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Thao tác theo role</h2>
          <p className="app-muted mt-2 text-sm">
            Role hiện tại: <span className="font-semibold">{profile.role}</span>
          </p>

          {qlsxViewer ? (
            <p className="app-muted mt-4 text-sm">
              QLSX mở đơn hàng để xem thông tin kỹ thuật và theo dõi tiến độ, không thao tác chuyển trạng thái tại màn này.
            </p>
          ) : null}

          {allowedTransitions.length === 0 ? (
            <p className="app-muted mt-4 text-sm">
              Không có action hợp lệ cho role này tại trạng thái hiện tại.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú cho chuyển trạng thái (nếu cần)"
                className="app-input min-h-28 w-full rounded-xl p-3 text-sm"
              />

              <div className="space-y-3">
                {allowedTransitions.map((transition) => (
                  <button
                    key={`${transition.from_state}-${transition.to_state}`}
                    type="button"
                    onClick={() => handleTransition(transition)}
                    disabled={isPending}
                    className="app-primary flex w-full flex-col rounded-xl px-4 py-3 text-left transition disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold">{formatTransitionState(transition.to_state)}</span>
                    <span className="text-xs text-white/80">{transition.mo_ta || 'Chuyển trạng thái'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {message ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--color-primary)' }}>{message}</p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>{error}</p>
          ) : null}
        </section>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Timeline đơn hàng</h2>
        {detail.timeline.length === 0 ? (
          <p className="app-muted mt-4 text-sm">Chưa có log chuyển trạng thái.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {detail.timeline.map((row) => (
              <article
                key={row.log_id}
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {formatTransitionState(row.from_state)} {'->'} {formatTransitionState(row.to_state)}
                    </p>
                    <p className="app-muted mt-1 text-xs">
                      {props.actorDisplayMap[row.changed_by || ''] || row.changed_by || '-'} /{' '}
                      {row.changed_by_role || '-'}
                    </p>
                  </div>
                  <p className="app-muted text-xs">{formatDateTime(row.changed_at)}</p>
                </div>
                <p className="mt-3 text-sm">{row.ghi_chu || 'Không có ghi chú'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Info(props: { label: string; value: string }) {
  return (
    <div className="app-surface rounded-xl p-4">
      <p className="app-muted text-xs">{props.label}</p>
      <p className="mt-1 text-sm font-semibold">{props.value}</p>
    </div>
  )
}

function displayNullableNumber(value: number | null) {
  if (value === null || value === undefined) return '-'
  return formatCurrency(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatTransitionState(value: string | null) {
  const state = String(value || '').trim()
  switch (state) {
    case 'CHO_DUYET_SX':
      return 'Chờ duyệt SX'
    case 'DA_DUYET_SX':
      return 'Đã duyệt SX'
    case 'DANG_SAN_XUAT':
      return 'Đang sản xuất'
    case 'HOAN_THANH':
      return 'Hoàn thành'
    default:
      return state || '-'
  }
}

function buildDisplayBocId(bocId: string | null, projectCode: string, loaiCoc: string) {
  if (!bocId) return '-'
  const shortId = String(bocId).slice(-6).toUpperCase()
  return `${projectCode || 'BT'} · ${loaiCoc} · ${shortId}`
}

function formatConcreteLabel(value: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  if (/^\d+$/.test(raw)) return `M${raw}`
  return raw
}

function parseSegments(raw: unknown): SegmentView[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((segment, index) => {
      if (!segment || typeof segment !== 'object') return null
      const row = segment as Record<string, unknown>
      const tenDoan = normalizeSegmentName(
        String(row.ten_doan ?? row.tenDoan ?? `Đoạn ${index + 1}`)
      )
      const chieuDaiM = Number(row.len_m ?? row.chieu_dai_m ?? 0)
      const soLuongDoan = Number(row.so_luong_doan ?? row.cnt ?? 0)
      return {
        key: String(row.doan_key ?? row.ten_doan ?? index),
        tenDoan,
        chieuDaiM: Number.isFinite(chieuDaiM) ? chieuDaiM : 0,
        soLuongDoan: Number.isFinite(soLuongDoan) ? soLuongDoan : 0,
        tongMd:
          (Number.isFinite(chieuDaiM) ? chieuDaiM : 0) *
          (Number.isFinite(soLuongDoan) ? soLuongDoan : 0),
      } satisfies SegmentView
    })
    .filter((item): item is SegmentView => Boolean(item))
}

function normalizeSegmentName(value: string) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'MUI') return 'Mũi'
  if (normalized.startsWith('THAN_')) return `Thân ${normalized.slice(5)}`
  return value
}

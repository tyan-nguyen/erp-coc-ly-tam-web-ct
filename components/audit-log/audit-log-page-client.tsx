'use client'

import type { AuditLogPageData, AuditLogRow } from '@/lib/audit-log/types'

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'CREATE', label: 'Tạo' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'CONFIRM', label: 'Xác nhận' },
  { value: 'APPROVE', label: 'Duyệt' },
  { value: 'CANCEL', label: 'Hủy' },
  { value: 'REOPEN', label: 'Mở lại' },
  { value: 'DELETE', label: 'Xóa' },
  { value: 'POST', label: 'Ghi sổ' },
]

const ENTITY_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'KE_HOACH_SX_NGAY', label: 'KHSX ngày' },
  { value: 'KE_HOACH_SX_LINE', label: 'Dòng KHSX' },
  { value: 'SX_XUAT_NVL', label: 'Xuất NVL SX' },
  { value: 'SX_QC_NGHIEM_THU', label: 'QC nghiệm thu' },
]

const ROLE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'admin', label: 'Admin' },
  { value: 'qlsx', label: 'QLSX' },
  { value: 'thu kho', label: 'Thủ kho' },
  { value: 'qc', label: 'QC' },
  { value: 'ktmh', label: 'KT mua hàng' },
  { value: 'kinh doanh', label: 'Kinh doanh' },
  { value: 'ke toan ban hang', label: 'KT bán hàng' },
  { value: 'kiem ke', label: 'Kiểm kê' },
]

const tableHeaderClass = 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]'
const tableHeaderStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatAction(value: string) {
  return ACTION_OPTIONS.find((item) => item.value === value)?.label || value || '-'
}

function formatEntity(value: string) {
  return ENTITY_OPTIONS.find((item) => item.value === value)?.label || value.replaceAll('_', ' ') || '-'
}

function formatRole(value: string) {
  return ROLE_OPTIONS.find((item) => item.value === value)?.label || value || '-'
}

function shortValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return `${value.length} mục`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function SummaryPreview({ row }: { row: AuditLogRow }) {
  const entries = Object.entries(row.summaryJson || {}).slice(0, 4)
  if (!entries.length) return <span className="text-[var(--color-muted)]">-</span>

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--color-muted)]">
      {entries.map(([key, value]) => (
        <span key={key}>
          {key}: <span className="text-[var(--color-foreground)]">{shortValue(value)}</span>
        </span>
      ))}
    </div>
  )
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="app-muted text-[11px] uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-1 text-sm">{props.value}</div>
    </div>
  )
}

export function AuditLogPageClient(props: { pageData: AuditLogPageData }) {
  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="px-6 py-6">
        <h1 className="text-2xl font-bold">Nhật ký thao tác</h1>
      </section>

      <section className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <form className="grid gap-4 md:grid-cols-[repeat(6,minmax(0,1fr))_auto]" method="get">
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Từ ngày</span>
            <input type="date" name="from" defaultValue={props.pageData.filters.fromDate} className="app-input w-full rounded-xl px-3 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Đến ngày</span>
            <input type="date" name="to" defaultValue={props.pageData.filters.toDate} className="app-input w-full rounded-xl px-3 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Hành động</span>
            <select name="action" defaultValue={props.pageData.filters.action} className="app-input w-full rounded-xl px-3 py-3 text-sm">
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Loại phiếu</span>
            <select name="entity_type" defaultValue={props.pageData.filters.entityType} className="app-input w-full rounded-xl px-3 py-3 text-sm">
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Người thao tác</span>
            <input name="actor" defaultValue={props.pageData.filters.actor} placeholder="Email" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Role</span>
            <select name="role" defaultValue={props.pageData.filters.role} className="app-input w-full rounded-xl px-3 py-3 text-sm">
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="app-primary w-full rounded-xl px-5 py-3 text-sm font-semibold md:w-auto">Lọc</button>
          </div>
        </form>

        {!props.pageData.schemaReady ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            {props.pageData.errorMessage}
          </div>
        ) : null}
      </section>

      <section className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="grid gap-5 md:grid-cols-5">
          <Metric label="Số log" value={props.pageData.rows.length} />
          <Metric label="Khoảng ngày" value={`${props.pageData.filters.fromDate} - ${props.pageData.filters.toDate}`} />
          <Metric label="Hành động" value={props.pageData.filters.action ? formatAction(props.pageData.filters.action) : 'Tất cả'} />
          <Metric label="Loại phiếu" value={props.pageData.filters.entityType ? formatEntity(props.pageData.filters.entityType) : 'Tất cả'} />
          <Metric label="Role" value={props.pageData.filters.role ? formatRole(props.pageData.filters.role) : 'Tất cả'} />
        </div>
      </section>

      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {props.pageData.rows.map((row) => (
            <details key={row.logId} className="px-6 py-5">
              <summary className="cursor-pointer list-none">
                <div className="text-base font-semibold">{formatAction(row.action)} · {formatEntity(row.entityType)}</div>
                <div className="mt-1 text-sm text-[var(--color-muted)]">{formatDateTime(row.createdAt)} · {row.actorEmail || row.actorRole || '-'}</div>
                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
                  <Metric label="Đối tượng" value={row.entityCode || row.entityId || '-'} />
                  <Metric label="Role" value={row.actorRole || '-'} />
                </div>
              </summary>
              <div className="mt-4 border-t pt-4 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                <SummaryPreview row={row} />
                {row.note ? <div className="mt-3 text-[var(--color-muted)]">Ghi chú: {row.note}</div> : null}
              </div>
            </details>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} text-left`} style={tableHeaderStyle}>Thời gian</th>
                <th className={`${tableHeaderClass} text-left`} style={tableHeaderStyle}>Người</th>
                <th className={`${tableHeaderClass} text-left`} style={tableHeaderStyle}>Hành động</th>
                <th className={`${tableHeaderClass} text-left`} style={tableHeaderStyle}>Đối tượng</th>
                <th className={`${tableHeaderClass} text-left`} style={tableHeaderStyle}>Tóm tắt</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.rows.map((row) => (
                <tr key={row.logId} className="border-t align-top" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="whitespace-nowrap px-4 py-4">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{row.actorEmail || '-'}</div>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">{row.actorRole || '-'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{formatAction(row.action)}</div>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">{formatEntity(row.entityType)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{row.entityCode || row.entityId || '-'}</div>
                    {row.entityId ? <div className="mt-1 text-xs text-[var(--color-muted)]">{row.entityId}</div> : null}
                  </td>
                  <td className="max-w-[520px] px-4 py-4">
                    <SummaryPreview row={row} />
                    {row.note ? <div className="mt-2 text-xs text-[var(--color-muted)]">{row.note}</div> : null}
                  </td>
                </tr>
              ))}
              {props.pageData.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">Chưa có nhật ký thao tác trong khoảng lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

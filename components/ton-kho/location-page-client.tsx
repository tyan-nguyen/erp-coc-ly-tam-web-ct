'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { submitWarehouseLocationAssignment } from '@/lib/ton-kho-thanh-pham/location-assignment-client-api'
import type { WarehouseLocationPageData } from '@/lib/ton-kho-thanh-pham/location-types'

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatLocationSerialNote(note: string) {
  const normalized = String(note || '').trim()
  if (!normalized) return '-'

  const externalPurchasePrefix = 'Nhập mua cọc ngoài từ phiếu '
  const openingBalancePrefix = 'Mở tồn từ phiếu '

  if (normalized.startsWith(externalPurchasePrefix)) {
    return normalized
      .slice(externalPurchasePrefix.length)
      .replace(/\s*-\s*dòng\s+\d+\s*$/i, '')
      .trim()
  }

  if (normalized.startsWith(openingBalancePrefix)) {
    return normalized
      .slice(openingBalancePrefix.length)
      .replace(/\s*-\s*dòng\s+\d+\s*$/i, '')
      .trim()
  }

  return normalized
}

export function WarehouseLocationPageClient(props: { pageData: WarehouseLocationPageData }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [quality, setQuality] = useState(searchParams.get('quality') || props.pageData.filters.quality || 'ALL')
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([])
  const [targetLocationId, setTargetLocationId] = useState('')
  const [moving, setMoving] = useState(false)
  const [moveMessage, setMoveMessage] = useState('')
  const [moveError, setMoveError] = useState('')

  const selectedDetail = props.pageData.selectedLocationDetail
  const selectedSerialRows = selectedDetail?.serialRows || []
  const targetLocationOptions = useMemo(
    () => props.pageData.locations.filter((location) => location.locationId !== selectedDetail?.locationId),
    [props.pageData.locations, selectedDetail?.locationId]
  )

  useEffect(() => {
    setSelectedSerialIds([])
    setTargetLocationId('')
    setMoveMessage('')
    setMoveError('')
  }, [selectedDetail?.locationId, selectedDetail?.serialPage])

  const buildHref = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }
    const queryString = params.toString()
    return queryString ? `${pathname}?${queryString}` : pathname
  }

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    router.push(
      buildHref({
        q: query.trim() || null,
        quality: quality === 'ALL' ? null : quality,
        page: '1',
        location: null,
        serial_page: null,
      })
    )
  }

  const selectedSerialCodes = selectedSerialRows
    .filter((row) => selectedSerialIds.includes(row.serialId))
    .map((row) => row.serialCode)

  const allCurrentPageSelected = selectedSerialRows.length > 0 && selectedSerialRows.every((row) => selectedSerialIds.includes(row.serialId))

  async function handleMoveSelected() {
    if (!selectedDetail) return
    if (!targetLocationId) {
      setMoveError('Cần chọn bãi đích.')
      setMoveMessage('')
      return
    }
    if (!selectedSerialCodes.length) {
      setMoveError('Cần tick ít nhất một serial để chuyển bãi.')
      setMoveMessage('')
      return
    }

    setMoving(true)
    setMoveError('')
    setMoveMessage('')
    try {
      const response = await submitWarehouseLocationAssignment({
        locationId: targetLocationId,
        serialCodesText: selectedSerialCodes.join('\n'),
        note: `Chuyển nhanh từ màn Serial theo bãi (${selectedDetail.locationLabel})`,
      })
      if (!response.data) throw new Error('Không chuyển được serial sang bãi mới.')
      setMoveMessage(`Đã chuyển ${response.data.assignedCount} serial sang ${response.data.locationLabel}.`)
      setSelectedSerialIds([])
      router.refresh()
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'Không chuyển được serial sang bãi mới.')
    } finally {
      setMoving(false)
    }
  }

  if (!props.pageData.schemaReady) {
    return (
      <section className="app-surface rounded-2xl p-6">
        <div
          className="rounded-2xl border px-4 py-4 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, white)',
            color: 'var(--color-accent)',
          }}
        >
          Chưa thấy schema `pile_serial`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới xem được serial theo bãi.
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <form className="grid gap-4 lg:grid-cols-[1.2fr_220px_auto]" onSubmit={handleApplyFilters}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Tìm nhanh</span>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: A1, A2, serial, lô, loại cọc..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Chất lượng</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
            >
              <option value="ALL">Tất cả</option>
              <option value="DAT">Đạt</option>
              <option value="LOI">Lỗi</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              className="h-[46px] min-w-[140px] rounded-xl px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
              type="submit"
            >
              Lọc bãi
            </button>
          </div>
        </form>
      </section>

      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Tổng hợp theo bãi</h3>
            <p className="app-muted mt-1 text-sm">Tổng số bãi: {props.pageData.summaryTotalCount}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)' }}
              href="/ton-kho/thanh-pham/vi-tri-bai/dieu-chuyen"
            >
              Mở màn điều chuyển
            </Link>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="px-4 py-3">Bãi</th>
                <th className="px-4 py-3 text-right">Tổng serial</th>
                <th className="px-4 py-3 text-right">Đạt</th>
                <th className="px-4 py-3 text-right">Lỗi</th>
                <th className="px-4 py-3 text-right">Số mặt hàng</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.summaryRows.length ? (
                props.pageData.summaryRows.map((row) => {
                  const selected = props.pageData.selectedLocationDetail?.locationId === row.locationId
                  return (
                    <tr
                      key={row.locationId}
                      className="cursor-pointer"
                      style={{
                        borderTop: '1px solid var(--color-border)',
                        backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 4%, white)' : undefined,
                      }}
                      onClick={() => {
                        router.push(
                          selected
                            ? buildHref({ location: null, serial_page: null })
                            : buildHref({
                                location: row.locationId,
                                page: String(props.pageData.filters.page),
                                serial_page: '1',
                                quality: quality === 'ALL' ? null : quality,
                              })
                        )
                      }}
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold">{row.locationLabel}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">{row.totalQty}</td>
                      <td className="px-4 py-4 text-right">{row.acceptedQty}</td>
                      <td className="px-4 py-4 text-right">{row.defectQty}</td>
                      <td className="px-4 py-4 text-right">{row.itemCount}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center app-muted" colSpan={5}>
                    Không có bãi nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {props.pageData.selectedLocationDetail ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Serial trong bãi {props.pageData.selectedLocationDetail.locationLabel}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span>
                <span className="app-muted">Tổng </span>
                <span className="font-semibold">{props.pageData.selectedLocationDetail.totalQty}</span>
              </span>
              <span>
                <span className="app-muted">Đạt </span>
                <span className="font-semibold">{props.pageData.selectedLocationDetail.acceptedQty}</span>
              </span>
              <span>
                <span className="app-muted">Lỗi </span>
                <span className="font-semibold">{props.pageData.selectedLocationDetail.defectQty}</span>
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedSerialIds(selectedSerialRows.map((row) => row.serialId))
                        } else {
                          setSelectedSerialIds([])
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3">Serial</th>
                  <th className="px-4 py-3">Mặt hàng</th>
                  <th className="px-4 py-3">Ngày SX</th>
                  <th className="px-4 py-3">Chất lượng</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {props.pageData.selectedLocationDetail.serialRows.map((row) => (
                  <tr key={row.serialId} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSerialIds.includes(row.serialId)}
                        onChange={(event) => {
                          setSelectedSerialIds((current) => {
                            if (event.target.checked) {
                              return current.includes(row.serialId) ? current : [...current, row.serialId]
                            }
                            return current.filter((item) => item !== row.serialId)
                          })
                        }}
                      />
                    </td>
                    <td className="px-4 py-4 font-semibold">{row.serialCode}</td>
                    <td className="px-4 py-4">{row.itemLabel}</td>
                    <td className="px-4 py-4">{formatDate(row.productionDate)}</td>
                    <td className="px-4 py-4">{row.qualityLabel}</td>
                    <td className="px-4 py-4">{formatLocationSerialNote(row.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSerialCodes.length ? (
            <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  value={targetLocationId}
                  onChange={(event) => setTargetLocationId(event.target.value)}
                >
                  <option value="">Chọn bãi đến</option>
                  {targetLocationOptions.map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.locationLabel}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  disabled={moving || !targetLocationId}
                  onClick={() => {
                    void handleMoveSelected()
                  }}
                >
                  {moving ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển'}
                </button>
              </div>
            </div>
          ) : null}

          {moveMessage ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                color: 'var(--color-primary)',
              }}
            >
              {moveMessage}
            </div>
          ) : null}

          {moveError ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-danger)',
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
                color: 'var(--color-danger)',
              }}
            >
              {moveError}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeRole } from '@/lib/auth/roles'
import { fetchInventoryCountDetail, submitCreateInventoryCountSheet } from '@/lib/inventory-counting/client-api'
import type {
  InventoryCountCatalogOption,
  InventoryCountDetail,
  InventoryCountDraftLine,
  InventoryCountingPageData,
} from '@/lib/inventory-counting/types'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatStatusLabel(value: string) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'NHAP') return 'Nháp'
  if (normalized === 'CHO_XAC_NHAN_KHO') return 'Chờ thủ kho xác nhận'
  if (normalized === 'CHO_DUYET_CHENH_LECH') return 'Chờ duyệt chênh lệch'
  if (normalized === 'DA_DIEU_CHINH_TON') return 'Đã điều chỉnh tồn'
  return value || '-'
}

function buildDraftLineFromOption(option: InventoryCountCatalogOption): InventoryCountDraftLine {
  return {
    id: `line-${option.itemType}-${option.value}`,
    itemType: option.itemType,
    itemId: option.value,
    itemCode: option.itemCode,
    itemName: option.itemName,
    itemGroup: option.itemGroup,
    unit: option.unit,
    systemQty: option.systemQty,
    countedQty: option.systemQty,
    varianceQty: 0,
    variancePct: 0,
    allowedLossPct: option.allowedLossPct,
    note: '',
  }
}

function buildEmptyDraftLine(): InventoryCountDraftLine {
  return {
    id: `line-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
    itemType: 'NVL',
    itemId: '',
    itemCode: '',
    itemName: '',
    itemGroup: '',
    unit: '',
    systemQty: 0,
    countedQty: 0,
    varianceQty: 0,
    variancePct: 0,
    allowedLossPct: 0,
    note: '',
  }
}

export function InventoryCountPageClient(props: { pageData: InventoryCountingPageData; currentRole: string }) {
  const router = useRouter()
  const normalizedRole = normalizeRole(props.currentRole)
  const [countType, setCountType] = useState<'OPENING_BALANCE' | 'OPERATIONAL'>('OPERATIONAL')
  const [countDate, setCountDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<InventoryCountDraftLine[]>([])
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeSheetId, setActiveSheetId] = useState('')
  const [activeSheetDetail, setActiveSheetDetail] = useState<InventoryCountDetail | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailCache, setDetailCache] = useState<Record<string, InventoryCountDetail>>({})

  const canCreateSheets =
    normalizedRole === 'kiem ke vien' ||
    normalizedRole === 'kiemke vien' ||
    normalizedRole === 'kiem ke' ||
    normalizedRole === 'inventory counter' ||
    normalizedRole === 'admin'

  function addEmptyLine() {
    setSaveError('')
    setLines((current) => [...current, buildEmptyDraftLine()])
  }

  function updateLine(lineId: string, updater: (line: InventoryCountDraftLine) => InventoryCountDraftLine) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line
        const next = updater(line)
        const varianceQty = Number(next.countedQty || 0) - Number(next.systemQty || 0)
        const variancePct = Number(next.systemQty || 0) === 0 ? 0 : (varianceQty / Number(next.systemQty || 0)) * 100
        return {
          ...next,
          varianceQty,
          variancePct,
        }
      })
    )
  }

  function updateLineItem(lineId: string, optionValue: string) {
    const selectedOption = props.pageData.catalogOptions.find((item) => item.value === optionValue)
    if (!selectedOption) {
      updateLine(lineId, (current) => ({
        ...current,
        itemId: '',
        itemCode: '',
        itemName: '',
        itemGroup: '',
        unit: '',
        systemQty: 0,
        countedQty: 0,
        varianceQty: 0,
        variancePct: 0,
        allowedLossPct: 0,
      }))
      return
    }

    const duplicateLine = lines.find(
      (line) =>
        line.id !== lineId &&
        line.itemType === selectedOption.itemType &&
        line.itemId === selectedOption.value
    )
    if (duplicateLine) {
      setSaveError('Mặt hàng này đã có trong phiếu kiểm kê.')
      return
    }

    setSaveError('')
    updateLine(lineId, () => ({
      ...buildDraftLineFromOption(selectedOption),
      id: lineId,
      note: '',
    }))
  }

  async function handleToggleSheet(sheetId: string) {
    if (sheetId === activeSheetId) {
      setActiveSheetId('')
      setActiveSheetDetail(null)
      setDetailError('')
      setDetailLoadingId('')
      return
    }

    setActiveSheetId(sheetId)
    setDetailError('')

    if (detailCache[sheetId]) {
      setActiveSheetDetail(detailCache[sheetId])
      return
    }

    setActiveSheetDetail(null)
    setDetailLoadingId(sheetId)
    try {
      const result = await fetchInventoryCountDetail(sheetId)
      if (!result.data) throw new Error('Không tải được chi tiết phiếu kiểm kê.')
      setDetailCache((current) => ({ ...current, [sheetId]: result.data as InventoryCountDetail }))
      setActiveSheetDetail(result.data as InventoryCountDetail)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Không tải được chi tiết phiếu kiểm kê.')
    } finally {
      setDetailLoadingId('')
    }
  }

  async function handleCreateSheet() {
    setSaveMessage('')
    setSaveError('')

    if (!props.pageData.schemaReady) {
      setSaveError('Schema kiểm kê chưa sẵn sàng. Cần chạy inventory_counting_setup.sql trước khi lưu phiếu.')
      return
    }

    const validLines = lines.filter((line) => String(line.itemCode || '').trim())
    if (!validLines.length) {
      setSaveError('Phiếu kiểm kê cần ít nhất một dòng mặt hàng.')
      return
    }

    try {
      setIsSaving(true)
      const result = await submitCreateInventoryCountSheet({
        countType,
        countDate,
        note,
        rows: validLines.map((line) => ({
          id: line.id,
          itemType: line.itemType,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          itemGroup: line.itemGroup,
          unit: line.unit,
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          allowedLossPct: line.allowedLossPct,
          note: line.note,
        })),
      })
      setSaveMessage(`Đã tạo phiếu kiểm kê ${result.data?.countSheetCode || ''} với ${result.data?.lineCount || 0} dòng.`)
      setLines([])
      setNote('')
      setActiveSheetId('')
      setActiveSheetDetail(null)
      router.refresh()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không tạo được phiếu kiểm kê.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="app-surface overflow-hidden rounded-[28px]">
      {canCreateSheets ? (
        <section className="px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Tạo phiếu kiểm kê</h2>
            <button
              type="button"
              onClick={addEmptyLine}
              className="text-2xl font-medium leading-none text-slate-700"
              aria-label="Thêm dòng kiểm kê"
            >
              +
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Loại kiểm kê</span>
              <select
                value={countType}
                onChange={(event) => setCountType(event.target.value === 'OPENING_BALANCE' ? 'OPENING_BALANCE' : 'OPERATIONAL')}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="OPERATIONAL">Kiểm kê vận hành</option>
                <option value="OPENING_BALANCE">Nhập tồn đầu kỳ</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Ngày kiểm kê</span>
              <input
                type="date"
                value={countDate}
                onChange={(event) => setCountDate(event.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </label>
          </div>

          {saveMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{saveMessage}</div> : null}
          {saveError ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{saveError}</div> : null}

          <div className="mt-6 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-black/[0.03] text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Mặt hàng</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Nhóm</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">ĐVT</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Tồn hệ thống</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">SL kiểm kê</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Hao hụt</th>
                  <th className="px-4 py-3 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody>
                {lines.length ? (
                  lines.map((line) => (
                    <tr key={line.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3 align-middle">
                        <select
                          value={line.itemId}
                          onChange={(event) => updateLineItem(line.id, event.target.value)}
                          className="w-full min-w-[240px] rounded-xl border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <option value="">Chọn mặt hàng...</option>
                          {props.pageData.catalogOptions.map((option) => (
                            <option key={`${option.itemType}-${option.value}`} value={option.value}>
                              {option.itemCode} - {option.itemName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{line.itemGroup || '-'}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{line.unit || '-'}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{formatNumber(line.systemQty)}</td>
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.countedQty}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value)
                            updateLine(line.id, (current) => ({
                              ...current,
                              countedQty: Number.isFinite(nextValue) ? nextValue : 0,
                            }))
                          }}
                          className="w-28 rounded-xl border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{formatNumber(line.allowedLossPct)}%</td>
                      <td className="px-4 py-3 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          className="text-lg leading-none text-slate-500"
                          aria-label="Bỏ dòng"
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm app-muted">
                      Chưa có dòng kiểm kê nào. Bấm dấu `+` để thêm dòng rồi chọn trực tiếp ở cột mặt hàng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <label className="min-w-[320px] flex-1 space-y-2 text-sm">
              <span className="font-medium">Ghi chú</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: kiểm kê kho NVL đầu tháng"
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </label>
            <button
              type="button"
              onClick={handleCreateSheet}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--color-primary)' }}
            >
              {isSaving ? 'Đang lưu phiếu...' : 'Lưu phiếu kiểm kê'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="border-t px-6 py-6" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="text-2xl font-semibold">Phiếu kiểm kê đã lưu</h2>
        </div>

        <div className="mt-6 max-h-[420px] overflow-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-black/[0.03] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã phiếu</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Ngày</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Số dòng</th>
                <th className="px-4 py-3 font-semibold">Tồn hệ thống</th>
                <th className="px-4 py-3 font-semibold">SL kiểm kê</th>
                <th className="px-4 py-3 font-semibold">Chênh lệch</th>
                <th className="px-4 py-3 font-semibold">Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.savedSheets.length ? (
                props.pageData.savedSheets.map((sheet) => (
                  <tr
                    key={sheet.countSheetId}
                    className="cursor-pointer border-t"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: activeSheetId === sheet.countSheetId ? 'color-mix(in srgb, var(--color-primary) 6%, white)' : undefined,
                    }}
                    onClick={() => void handleToggleSheet(sheet.countSheetId)}
                  >
                    <td className="px-4 py-3 font-medium">{sheet.countSheetCode}</td>
                    <td className="px-4 py-3">{sheet.countType === 'OPENING_BALANCE' ? 'Nhập tồn đầu kỳ' : 'Kiểm kê vận hành'}</td>
                    <td className="px-4 py-3">{formatDateLabel(sheet.countDate)}</td>
                    <td className="px-4 py-3">{formatStatusLabel(sheet.status)}</td>
                    <td className="px-4 py-3">{sheet.lineCount}</td>
                    <td className="px-4 py-3">{formatNumber(sheet.systemQtyTotal)}</td>
                    <td className="px-4 py-3">{formatNumber(sheet.countedQtyTotal)}</td>
                    <td className={`px-4 py-3 ${sheet.varianceQtyTotal === 0 ? '' : sheet.varianceQtyTotal > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatNumber(sheet.varianceQtyTotal)}
                    </td>
                    <td className="px-4 py-3">{formatDateLabel(sheet.createdAt.slice(0, 10))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm app-muted">
                    {props.pageData.schemaReady
                      ? 'Chưa có phiếu kiểm kê nào được lưu.'
                      : 'Schema kiểm kê chưa sẵn sàng nên chưa thể hiện danh sách phiếu từ DB.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activeSheetId ? (
          <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
            {detailLoadingId === activeSheetId ? (
              <div className="text-sm app-muted">Đang tải chi tiết phiếu kiểm kê...</div>
            ) : detailError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{detailError}</div>
            ) : activeSheetDetail ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{activeSheetDetail.countSheetCode}</h3>
                    <div className="app-muted mt-1 text-sm">
                      {activeSheetDetail.countType === 'OPENING_BALANCE' ? 'Nhập tồn đầu kỳ' : 'Kiểm kê vận hành'} · {formatDateLabel(activeSheetDetail.countDate)} · {formatStatusLabel(activeSheetDetail.status)}
                    </div>
                  </div>
                  <div className="text-sm app-muted">
                    Số dòng: {activeSheetDetail.lines.length}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-black/[0.03] text-left">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Mặt hàng</th>
                        <th className="px-4 py-3 font-semibold">Nhóm</th>
                        <th className="px-4 py-3 font-semibold">Tồn hệ thống</th>
                        <th className="px-4 py-3 font-semibold">SL kiểm kê</th>
                        <th className="px-4 py-3 font-semibold">Chênh lệch</th>
                        <th className="px-4 py-3 font-semibold">% hao hụt</th>
                        <th className="px-4 py-3 font-semibold">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSheetDetail.lines.map((line) => (
                        <tr key={line.countLineId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{line.itemName}</div>
                            <div className="app-muted text-xs">{line.itemCode} · {line.unit}</div>
                          </td>
                          <td className="px-4 py-3">{line.itemGroup || '-'}</td>
                          <td className="px-4 py-3">{formatNumber(line.systemQty)}</td>
                          <td className="px-4 py-3">{formatNumber(line.countedQty)}</td>
                          <td className={`px-4 py-3 ${line.varianceQty === 0 ? '' : line.varianceQty > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatNumber(line.varianceQty)}
                          </td>
                          <td className="px-4 py-3">{formatNumber(line.allowedLossPct)}%</td>
                          <td className="px-4 py-3">{line.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

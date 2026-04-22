'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type PileGroupOption = {
  value: string
  label: string
}

type NvlOption = {
  nvl_id: string
  ten_hang: string
  dvt: string
}

type LineItem = {
  id?: string
  nvl_id: string
  query: string
  dvt: string
  dinh_muc: string
}

type Props = {
  pileGroups: PileGroupOption[]
  nvlOptions: NvlOption[]
  initialGroup?: string
  initialItems?: LineItem[]
}

const AUX_GRID_CLASS = 'grid gap-3 md:grid-cols-[minmax(0,2fr)_140px_180px_36px]'
const AUX_HEADER_CLASS =
  'hidden gap-3 rounded-t-2xl border-b px-4 py-3 md:grid md:grid-cols-[minmax(0,2fr)_140px_180px_36px]'

export function DmDinhMucPhuForm({ pileGroups, nvlOptions, initialGroup, initialItems }: Props) {
  const [selectedGroup, setSelectedGroup] = useState(initialGroup ?? '')
  const [items, setItems] = useState<LineItem[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [{ id: '', nvl_id: '', query: '', dvt: '', dinh_muc: '' }]
  )

  const serializedItems = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          id: item.id ?? '',
          nvl_id: item.nvl_id,
          dvt: item.dvt,
          dinh_muc: item.dinh_muc,
        }))
      ),
    [items]
  )

  function updateItem(index: number, updater: (current: LineItem) => LineItem) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)))
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">ĐK ngoài + Thành cọc</span>
        <select
          name="pile_group"
          required
          value={selectedGroup}
          onChange={(event) => setSelectedGroup(event.target.value)}
          className="app-input w-full rounded-xl px-3 py-3 text-sm"
        >
          <option value="">-- Chọn loại cọc -- bắt buộc</option>
          {pileGroups.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="items_json" value={serializedItems} />

      {selectedGroup ? (
        <div className="space-y-4">
          <div
            className={AUX_HEADER_CLASS}
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-background) 55%, white)',
            }}
          >
            <div className="text-sm font-semibold">Vật tư phụ</div>
            <div className="text-right text-sm font-semibold">ĐVT</div>
            <div className="text-right text-sm font-semibold">Định mức</div>
            <div />
          </div>

          <div
            className="overflow-visible rounded-b-2xl border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {items.map((item, index) => (
              <AuxiliaryItemRow
                key={index}
                item={item}
                nvlOptions={nvlOptions}
                isLast={index === items.length - 1}
                onChange={(nextItem) => updateItem(index, () => nextItem)}
                onRemove={
                  items.length > 1
                    ? () => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    : () => updateItem(index, () => ({ id: item.id ?? '', nvl_id: '', query: '', dvt: '', dinh_muc: '' }))
                }
              />
            ))}
          </div>

          <button
            type="button"
            className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
            onClick={() => setItems((current) => [...current, { id: '', nvl_id: '', query: '', dvt: '', dinh_muc: '' }])}
          >
            + Thêm vật tư phụ
          </button>
        </div>
      ) : (
        <div className="app-primary-soft rounded-2xl px-4 py-3 text-sm">
          Chọn ĐK ngoài + Thành cọc trước, sau đó thêm các dòng vật tư phụ như than đá, dầu DO, que hàn, điện...
        </div>
      )}
    </div>
  )
}

function AuxiliaryItemRow({
  item,
  nvlOptions,
  isLast,
  onChange,
  onRemove,
}: {
  item: LineItem
  nvlOptions: NvlOption[]
  isLast: boolean
  onChange: (nextItem: LineItem) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const filteredOptions = useMemo(() => {
    const keyword = item.query.trim().toLowerCase()
    if (!keyword) return nvlOptions.slice(0, 12)
    return nvlOptions.filter((option) => option.ten_hang.toLowerCase().includes(keyword)).slice(0, 12)
  }, [item.query, nvlOptions])

  return (
    <div
      className="px-4 py-3"
      style={{
        borderBottom: isLast ? 'none' : '1px solid color-mix(in srgb, var(--color-border) 72%, white)',
      }}
    >
      <div className={AUX_GRID_CLASS}>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold md:hidden">Vật tư phụ</span>
          <div ref={containerRef} className="relative">
            <input
              type="text"
              value={item.query}
              placeholder="Tìm vật tư phụ -- bắt buộc"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                const nextQuery = event.target.value
                const exact = nvlOptions.find(
                  (option) => option.ten_hang.toLowerCase() === nextQuery.trim().toLowerCase()
                )
                setOpen(true)
                onChange({
                  nvl_id: exact?.nvl_id ?? '',
                  query: nextQuery,
                  dvt: exact?.dvt ?? '',
                  dinh_muc: item.dinh_muc,
                })
              }}
              className="app-input w-full rounded-xl px-3 py-3 text-sm"
            />
            {open ? (
              <div
                className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border shadow-lg"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div className="app-muted px-3 py-2 text-sm">Không có vật tư phù hợp.</div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option.nvl_id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        setOpen(false)
                        onChange({
                          nvl_id: option.nvl_id,
                          query: option.ten_hang,
                          dvt: option.dvt,
                          dinh_muc: item.dinh_muc,
                        })
                      }}
                      className="block w-full px-3 py-2 text-left text-sm transition hover:app-primary-soft"
                    >
                      {option.ten_hang}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold md:hidden">ĐVT</span>
          <input
            type="text"
            value={item.dvt}
            readOnly
            placeholder="Tự nhảy theo NVL"
            className="app-input w-full rounded-xl px-3 py-3 text-right text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold md:hidden">Định mức</span>
          <input
            type="text"
            inputMode="decimal"
            value={item.dinh_muc}
            placeholder="Nhập số lượng -- bắt buộc"
            onChange={(event) => onChange({ ...item, dinh_muc: event.target.value })}
            className="app-input w-full rounded-xl px-3 py-3 text-right text-sm"
          />
        </label>

        <div className="flex items-center justify-center md:items-end">
          <button
            type="button"
            aria-label="Xóa dòng"
            title="Xóa dòng"
            className="app-accent-soft inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold leading-none transition"
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'

type DiameterOption = {
  value: string
  label: string
}

type LineItem = {
  id?: string
  min_md: string
  loi_nhuan_pct: string
}

type Props = {
  diameterOptions: DiameterOption[]
  initialDiameter?: string
  initialItems?: LineItem[]
}

const GRID_CLASS = 'grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]'
const HEADER_CLASS =
  'hidden gap-3 rounded-t-2xl border-b px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]'

export function DmBienLoiNhuanForm({
  diameterOptions,
  initialDiameter,
  initialItems,
}: Props) {
  const [selectedDiameter, setSelectedDiameter] = useState(initialDiameter ?? '')
  const [items, setItems] = useState<LineItem[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [{ id: '', min_md: '', loi_nhuan_pct: '' }]
  )

  const serializedItems = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          id: item.id ?? '',
          min_md: item.min_md,
          loi_nhuan_pct: item.loi_nhuan_pct,
        }))
      ),
    [items]
  )

  function updateItem(index: number, nextItem: LineItem) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)))
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Đường kính cọc</span>
        <select
          name="duong_kinh_mm"
          required
          value={selectedDiameter}
          onChange={(event) => setSelectedDiameter(event.target.value)}
          className="app-input w-full rounded-xl px-3 py-3 text-sm"
        >
          <option value="">-- Chọn đường kính cọc -- bắt buộc</option>
          {diameterOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="items_json" value={serializedItems} />

      {selectedDiameter ? (
        <div className="space-y-4">
          <div
            className={HEADER_CLASS}
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-background) 55%, white)',
            }}
          >
            <div className="text-right text-sm font-semibold">MD từ</div>
            <div className="text-right text-sm font-semibold">% lợi nhuận</div>
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
              <div
                key={index}
                className="px-4 py-3"
                style={{
                  borderBottom:
                    index === items.length - 1 ? 'none' : '1px solid color-mix(in srgb, var(--color-border) 72%, white)',
                }}
              >
                <div className={GRID_CLASS}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold md:hidden">MD từ</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.min_md}
                      placeholder="Nhập md -- bắt buộc"
                      onChange={(event) => updateItem(index, { ...item, min_md: event.target.value })}
                      className="app-input w-full rounded-xl px-3 py-3 text-right text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold md:hidden">% lợi nhuận</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.loi_nhuan_pct}
                      placeholder="Nhập % -- bắt buộc"
                      onChange={(event) => updateItem(index, { ...item, loi_nhuan_pct: event.target.value })}
                      className="app-input w-full rounded-xl px-3 py-3 text-right text-sm"
                    />
                  </label>

                  <div className="flex items-center justify-center md:items-end">
                    <button
                      type="button"
                      aria-label="Xóa dòng"
                      title="Xóa dòng"
                      className="app-accent-soft inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold leading-none transition"
                      onClick={() => {
                        if (items.length === 1) {
                          updateItem(index, { id: item.id ?? '', min_md: '', loi_nhuan_pct: '' })
                          return
                        }
                        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
            onClick={() => setItems((current) => [...current, { id: '', min_md: '', loi_nhuan_pct: '' }])}
          >
            + Thêm mốc lợi nhuận
          </button>
        </div>
      ) : (
        <div className="app-primary-soft rounded-2xl px-4 py-3 text-sm">
          Chọn đường kính cọc trước, sau đó thêm các mốc sản lượng và % lợi nhuận tương ứng.
        </div>
      )}
    </div>
  )
}

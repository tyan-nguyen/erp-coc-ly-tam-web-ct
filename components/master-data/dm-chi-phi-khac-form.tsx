'use client'

import { useMemo, useState } from 'react'

type MatrixRow = {
  item_name: string
  dvt: string
  values: Record<string, string>
}

type Props = {
  initialDiameters: string[]
  initialRows: MatrixRow[]
}

const DEFAULT_ROW_LABELS = [
  'Chi phí vật dụng',
  'Chi phí thí nghiệm',
  'Chi phí chứng chỉ/hồ sơ',
  'Chi phí sửa chữa, bảo trì',
  'Chi phí khác: Hoa hồng',
  'Chi phí khen thưởng',
  'Chi phí sản xuất/ var',
  'Chi phí sản xuất/ fix',
  'Chi phí khấu hao',
  'Chi phí bán hàng/ var',
  'Chi phí bán hàng/ fix',
]

export function DmChiPhiKhacForm(props: Props) {
  const [diameters, setDiameters] = useState<string[]>(
    props.initialDiameters.length > 0 ? props.initialDiameters : ['300', '350', '400', '500']
  )
  const [rows, setRows] = useState<MatrixRow[]>(
    props.initialRows.length > 0
      ? props.initialRows
      : DEFAULT_ROW_LABELS.map((item) => ({
          item_name: item,
          dvt: 'vnd/md',
          values: {},
        }))
  )

  const serializedMatrix = useMemo(
    () =>
      JSON.stringify({
        diameters,
        rows,
      }),
    [diameters, rows]
  )

  const columnTotals = useMemo(() => {
    const result: Record<string, number> = {}
    for (const diameter of diameters) {
      result[diameter] = rows.reduce((sum, row) => sum + parseNumber(row.values[diameter]), 0)
    }
    return result
  }, [diameters, rows])

  function updateRow(index: number, nextRow: MatrixRow) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? nextRow : row)))
  }

  function updateDiameter(index: number, nextValue: string) {
    const trimmed = nextValue.replace(/[^\d]/g, '')
    setDiameters((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? trimmed : item))
    )
    setRows((current) =>
      current.map((row) => {
        const nextValues = { ...row.values }
        const previousKey = diameters[index]
        const previousValue = nextValues[previousKey] ?? ''
        delete nextValues[previousKey]
        if (trimmed) nextValues[trimmed] = previousValue
        return { ...row, values: nextValues }
      })
    )
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="matrix_json" value={serializedMatrix} />

      <div className="overflow-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full min-w-[860px] border-collapse text-sm table-fixed">
          <colgroup>
            <col style={{ width: '36%' }} />
            <col style={{ width: '10%' }} />
            {diameters.map((diameter, index) => (
              <col key={`${diameter}-${index}-width`} />
            ))}
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: 'color-mix(in srgb, var(--color-text) 58%, white)' }}>
                Khoản mục chi phí
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: 'color-mix(in srgb, var(--color-text) 58%, white)' }}>
                ĐVT
              </th>
              {diameters.map((diameter, index) => (
                <th
                  key={`${diameter}-${index}`}
                  className="px-3 py-3 text-center text-xs font-semibold tracking-[0.14em] uppercase"
                  style={{ color: 'color-mix(in srgb, var(--color-text) 58%, white)' }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>D</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={diameter}
                      onChange={(event) => updateDiameter(index, event.target.value)}
                      className="app-input h-9 w-14 rounded-lg px-2 py-1 text-center text-sm"
                    />
                    <button
                      type="button"
                      aria-label="Xóa cột đường kính"
                      className="app-accent-soft inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                      onClick={() => {
                        if (diameters.length === 1) {
                          setDiameters([''])
                          return
                        }
                        const keyToRemove = diameters[index]
                        setDiameters((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        setRows((current) =>
                          current.map((row) => {
                            const nextValues = { ...row.values }
                            delete nextValues[keyToRemove]
                            return { ...row, values: nextValues }
                          })
                        )
                      }}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center">
                <button
                  type="button"
                  className="app-outline inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
                  onClick={() => {
                    const nextDiameter = suggestNextDiameter(diameters)
                    setDiameters((current) => [...current, nextDiameter])
                    setRows((current) =>
                      current.map((row) => ({
                        ...row,
                        values: { ...row.values, [nextDiameter]: row.values[nextDiameter] ?? '' },
                      }))
                    )
                  }}
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.item_name}-${index}`}
                className="border-t"
                style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}
              >
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={row.item_name}
                    onChange={(event) => updateRow(index, { ...row, item_name: event.target.value })}
                    placeholder="Nhập khoản mục chi phí"
                    className="app-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={row.dvt}
                    onChange={(event) => updateRow(index, { ...row, dvt: event.target.value })}
                    placeholder="vnd/md"
                    className="app-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </td>
                {diameters.map((diameter) => (
                  <td key={`${row.item_name}-${diameter}`} className="px-3 py-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.values[diameter] ?? ''}
                      onChange={(event) =>
                        updateRow(index, {
                          ...row,
                          values: { ...row.values, [diameter]: event.target.value },
                        })
                      }
                      placeholder="0"
                      className="app-input w-full rounded-lg px-3 py-2 text-right text-sm"
                    />
                  </td>
                ))}
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    aria-label="Xóa dòng"
                    className="app-accent-soft inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold"
                    onClick={() => {
                      if (rows.length === 1) {
                        updateRow(index, { item_name: '', dvt: 'vnd/md', values: {} })
                        return
                      }
                      setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <td className="px-3 py-4 text-sm font-semibold" colSpan={2}>
                Tổng chi phí khác / md
              </td>
              {diameters.map((diameter) => (
                <td key={`total-${diameter}`} className="px-3 py-4 text-right text-sm font-semibold">
                  {formatNumber(columnTotals[diameter] || 0)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
        onClick={() =>
          setRows((current) => [
            ...current,
            {
              item_name: '',
              dvt: 'vnd/md',
              values: Object.fromEntries(diameters.map((diameter) => [diameter, ''])),
            },
          ])
        }
      >
        + Thêm khoản mục chi phí
      </button>
    </div>
  )
}

function parseNumber(input: string | number | null | undefined) {
  const raw = String(input ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/[,\s]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function suggestNextDiameter(diameters: string[]) {
  const numeric = diameters.map((item) => Number(item)).filter((value) => Number.isFinite(value) && value > 0)
  if (numeric.length === 0) return '300'
  return String(Math.max(...numeric) + 50)
}

'use client'

import { useMemo, useState } from 'react'

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

type MatrixRow = {
  item_name: string
  dvt: string
  values: Record<string, string>
}

type Props = {
  diameters: string[]
  rows: MatrixRow[]
}

export function DmChiPhiKhacView(props: Props) {
  const [expanded, setExpanded] = useState(true)
  const displayRows = useMemo(() => {
    const normalized = props.rows
      .filter((row) => String(row.item_name ?? '').trim().length > 0)
      .map((row) => ({
        ...row,
        dvt: String(row.dvt ?? '').trim() || 'vnd/md',
        values: Object.fromEntries(
          props.diameters.map((diameter) => [diameter, row.values?.[diameter] ?? ''])
        ),
      }))

    if (normalized.length > 0) return normalized

    return DEFAULT_ROW_LABELS.map((item_name) => ({
      item_name,
      dvt: 'vnd/md',
      values: Object.fromEntries(props.diameters.map((diameter) => [diameter, ''])),
    }))
  }, [props.diameters, props.rows])

  const totals = useMemo(() => {
    return Object.fromEntries(
      props.diameters.map((diameter) => [
        diameter,
        displayRows.reduce((sum, row) => sum + parseDisplayNumber(row.values[diameter]), 0),
      ])
    ) as Record<string, number>
  }, [displayRows, props.diameters])

  return (
    <div className="mt-5 space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
        >
          {expanded ? 'Thu gọn' : 'Mở rộng'}
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '36%' }} />
            <col style={{ width: '10%' }} />
            {props.diameters.map((diameter, index) => (
              <col key={`${diameter}-${index}-view-width`} />
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
              {props.diameters.map((diameter) => (
                <th
                  key={`view-${diameter}`}
                  className="px-3 py-3 text-center text-xs font-semibold tracking-[0.14em] uppercase"
                  style={{ color: 'color-mix(in srgb, var(--color-text) 58%, white)' }}
                >
                  D{diameter}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: 'transparent' }}>
                thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {expanded
              ? displayRows.map((row, index) => (
                  <tr
                    key={`view-row-${row.item_name}-${index}`}
                    className="border-t"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}
                  >
                    <td className="px-3 py-3">{row.item_name}</td>
                    <td className="px-3 py-3">{row.dvt || 'vnd/md'}</td>
                    {props.diameters.map((diameter) => (
                      <td key={`view-${row.item_name}-${diameter}`} className="px-3 py-3 text-right">
                        {formatDisplayNumber(row.values[diameter])}
                      </td>
                    ))}
                    <td />
                  </tr>
                ))
              : null}
            <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <td className="px-3 py-4 text-sm font-semibold" colSpan={2}>
                Tổng chi phí khác / md
              </td>
              {props.diameters.map((diameter) => (
                <td key={`view-total-${diameter}`} className="px-3 py-4 text-right text-sm font-semibold">
                  {formatDisplayNumber(String(totals[diameter] || 0))}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function parseDisplayNumber(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/[,\s]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDisplayNumber(value: string | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(parseDisplayNumber(value))
}

type V2StatItem = {
  label: string
  value: string
  note?: string
}

export function V2StatGrid(props: { items: V2StatItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {props.items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--color-muted)]">
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-bold">{item.value}</div>
          {item.note ? <div className="app-muted mt-2 text-sm">{item.note}</div> : null}
        </div>
      ))}
    </div>
  )
}

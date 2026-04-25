type V2ChecklistItem = {
  title: string
  description?: string
}

export function V2Checklist(props: { items: V2ChecklistItem[] }) {
  return (
    <div className="space-y-3">
      {props.items.map((item, index) => (
        <div
          key={`${index}-${item.title}`}
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-start gap-3">
            <div className="app-primary-soft inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{item.title}</div>
              {item.description ? <p className="app-muted mt-1 text-sm">{item.description}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

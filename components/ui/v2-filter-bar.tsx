export function V2FilterBar(props: {
  title: string
  description?: string
  actions: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-semibold">{props.title}</div>
          {props.description ? <p className="app-muted mt-1 text-sm">{props.description}</p> : null}
        </div>
        <div className="min-w-0 flex-1">{props.actions}</div>
      </div>
    </div>
  )
}

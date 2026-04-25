export function V2PageHeader(props: {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="app-surface rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {props.eyebrow ? (
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              {props.eyebrow}
            </div>
          ) : null}
          <h1 className="mt-4 text-2xl font-bold">{props.title}</h1>
          {props.description ? <p className="app-muted mt-2 max-w-3xl text-sm">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
      </div>
    </section>
  )
}

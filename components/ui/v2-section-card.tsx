export function V2SectionCard(props: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="app-surface rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          {props.description ? <p className="app-muted mt-2 text-sm">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  )
}

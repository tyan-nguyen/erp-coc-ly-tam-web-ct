import Link from 'next/link'

export function V2EmptyState(props: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-10 text-center"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="text-lg font-semibold">{props.title}</div>
      <p className="app-muted mx-auto mt-2 max-w-2xl text-sm">{props.description}</p>
      {props.actionHref ? (
        <div className="mt-5">
          <Link
            href={props.actionHref}
            prefetch={false}
            className="app-primary inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition"
          >
            {props.actionLabel || 'Tiếp tục'}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

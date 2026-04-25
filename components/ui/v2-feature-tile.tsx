import Link from 'next/link'

type V2FeatureTileProps = {
  title: string
  description: string
  href?: string
  ctaLabel?: string
  eyebrow?: string
  meta?: string
}

export function V2FeatureTile(props: V2FeatureTileProps) {
  const content = (
    <>
      {props.eyebrow ? (
        <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--color-muted)]">
          {props.eyebrow}
        </div>
      ) : null}
      <div className="mt-2 text-lg font-semibold">{props.title}</div>
      <p className="app-muted mt-2 text-sm">{props.description}</p>
      {props.meta ? <div className="app-muted mt-4 text-xs">{props.meta}</div> : null}
      {props.href ? (
        <div className="mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold app-primary-soft">
          {props.ctaLabel || 'Mở'}
        </div>
      ) : null}
    </>
  )

  if (!props.href) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href={props.href}
      prefetch={false}
      className="block rounded-2xl border p-5 transition hover:-translate-y-0.5"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {content}
    </Link>
  )
}

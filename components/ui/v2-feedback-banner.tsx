type V2FeedbackTone = 'info' | 'success' | 'warning' | 'error'

const TONE_STYLES: Record<V2FeedbackTone, { borderColor: string; backgroundColor: string; color: string }> = {
  info: {
    borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
    color: 'var(--color-primary)',
  },
  success: {
    borderColor: 'color-mix(in srgb, #16a34a 24%, white)',
    backgroundColor: 'color-mix(in srgb, #16a34a 8%, white)',
    color: '#166534',
  },
  warning: {
    borderColor: 'color-mix(in srgb, #f59e0b 26%, white)',
    backgroundColor: 'color-mix(in srgb, #f59e0b 10%, white)',
    color: '#b45309',
  },
  error: {
    borderColor: 'color-mix(in srgb, var(--color-accent) 30%, white)',
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, white)',
    color: 'var(--color-accent)',
  },
}

export function V2FeedbackBanner(props: {
  tone?: V2FeedbackTone
  children: React.ReactNode
}) {
  const tone = props.tone || 'info'
  return (
    <div className="rounded-2xl border px-4 py-3 text-sm" style={TONE_STYLES[tone]}>
      {props.children}
    </div>
  )
}

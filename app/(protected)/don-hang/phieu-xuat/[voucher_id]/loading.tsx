export default function LoadingVoucherDetail() {
  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, white 88%, var(--color-primary) 4%)' }} />
          <div className="h-7 w-56 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, white 88%, var(--color-primary) 4%)' }} />
        </div>
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}>
          <div className="h-8 w-40 rounded-xl" style={{ backgroundColor: 'white' }} />
          <div className="h-5 w-60 rounded-lg" style={{ backgroundColor: 'white' }} />
          <div className="h-5 w-44 rounded-lg" style={{ backgroundColor: 'white' }} />
        </div>
      </section>
    </div>
  )
}

export default function LoadingShipmentPage() {
  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="h-6 w-32 rounded-full bg-slate-100" />
        <div className="mt-5 h-8 w-56 rounded bg-slate-100" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-slate-100" />
        <div className="mt-5 flex gap-2">
          <div className="h-10 w-36 rounded-xl bg-slate-100" />
          <div className="h-10 w-36 rounded-xl bg-slate-100" />
        </div>
      </section>
      <section className="app-surface rounded-2xl p-6">
        <div className="h-6 w-40 rounded bg-slate-100" />
        <div className="mt-5 h-40 rounded-2xl bg-slate-100" />
      </section>
    </div>
  )
}

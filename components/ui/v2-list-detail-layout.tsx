export function V2ListDetailLayout(props: {
  list: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <div className="min-w-0">{props.list}</div>
      <div className="min-w-0">{props.detail || null}</div>
    </div>
  )
}

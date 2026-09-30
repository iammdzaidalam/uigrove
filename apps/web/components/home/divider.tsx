export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line-strong" />
      <span className="label">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line-strong" />
    </div>
  )
}

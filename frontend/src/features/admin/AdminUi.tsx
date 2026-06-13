import { Button } from '@/components/ui/button'

type Props = {
  total: number
  limit: number
  offset: number
  onPageChange: (offset: number) => void
}

export function AdminPagination({ total, limit, offset, onPageChange }: Props) {
  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const canPrev = offset > 0
  const canNext = offset + limit < total

  if (total <= limit) return null

  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-content-secondary">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => onPageChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={!canNext} onClick={() => onPageChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function AdminSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
    />
  )
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card px-4 py-3 shadow-whisper">
      <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-content-secondary">{hint}</p> : null}
    </div>
  )
}

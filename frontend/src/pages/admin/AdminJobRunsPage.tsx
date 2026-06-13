import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminJobRunsQueryKey, fetchAdminJobRuns } from '@/lib/adminApi'
import { AdminPagination, formatDate } from '@/features/admin/AdminUi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 50

export function AdminJobRunsPage() {
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminJobRunsQueryKey({ limit: PAGE_SIZE, offset, status: status || undefined }),
    queryFn: () => fetchAdminJobRuns({ limit: PAGE_SIZE, offset, status: status || undefined }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Job runs</h1>
        <p className="mt-1 text-sm text-content-secondary">Background pipeline jobs — embed, match, tailor, discovery.</p>
      </div>

      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value); setOffset(0) }}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="running">Running</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>

      {isLoading ? <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" /> : null}
      {error ? <Card><CardContent className="py-5 text-sm text-destructive">{(error as Error).message}</CardContent></Card> : null}

      {data ? (
        <div className="overflow-x-auto rounded-md border bg-card shadow-whisper">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-surface-tertiary/40 text-left text-xs uppercase tracking-wide text-content-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <tr key={run.id} className="border-b last:border-b-0 hover:bg-surface-tertiary/30">
                  <td className="px-4 py-3 font-medium">{run.jobType}</td>
                  <td className="px-4 py-3">
                    <Badge variant={run.status === 'failed' ? 'destructive' : run.status === 'completed' ? 'secondary' : 'outline'}>
                      {run.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{run.attempts}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-content-secondary" title={run.lastError ?? undefined}>
                    {run.lastError ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">{formatDate(run.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={setOffset} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

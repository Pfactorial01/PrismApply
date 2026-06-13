import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { adminApplicationsQueryKey, fetchAdminApplications } from '@/lib/adminApi'
import { AdminPagination, AdminSearchBar, formatDate } from '@/features/admin/AdminUi'
import { MatchTierBadge } from '@/features/applications/MatchInsights'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 50

export function AdminApplicationsPage() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState('')
  const [markedSent, setMarkedSent] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminApplicationsQueryKey({
      limit: PAGE_SIZE,
      offset,
      search,
      status: status || undefined,
      markedSent: markedSent === '' ? undefined : markedSent === 'true',
    }),
    queryFn: () => fetchAdminApplications({
      limit: PAGE_SIZE,
      offset,
      search,
      status: status || undefined,
      markedSent: markedSent === '' ? undefined : markedSent === 'true',
    }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Applications</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Tailored packages across all users — inspect form answers and match metadata.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminSearchBar value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="Search job, company, or user email…" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="completed">Completed</option>
        </select>
        <select value={markedSent} onChange={(e) => { setMarkedSent(e.target.value); setOffset(0) }} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">All send states</option>
          <option value="true">Marked sent</option>
          <option value="false">Not sent</option>
        </select>
      </div>

      {isLoading ? <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" /> : null}
      {error ? <Card><CardContent className="py-5 text-sm text-destructive">{(error as Error).message}</CardContent></Card> : null}

      {data ? (
        <div className="overflow-x-auto rounded-md border bg-card shadow-whisper">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-surface-tertiary/40 text-left text-xs uppercase tracking-wide text-content-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Fields</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((app) => (
                <tr key={app.id} className="border-b last:border-b-0 hover:bg-surface-tertiary/30">
                  <td className="px-4 py-3">
                    <Link to="/admin/applications/$id" params={{ id: app.id }} className="font-medium text-primary hover:underline">
                      {app.title}
                    </Link>
                    <p className="text-xs text-content-secondary">@{app.company}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to="/admin/users/$id" params={{ id: app.userId }} className="text-content-secondary hover:underline">
                      {app.userEmail}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><MatchTierBadge app={app} showScore /></td>
                  <td className="px-4 py-3 text-content-secondary">{app.status}</td>
                  <td className="px-4 py-3">{app.markedSent ? <Badge variant="secondary">Sent</Badge> : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{Array.isArray(app.formAnswers) ? app.formAnswers.length : 0}</td>
                  <td className="px-4 py-3 text-content-secondary">{formatDate(app.createdAt)}</td>
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

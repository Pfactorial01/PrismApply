import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { adminMatchesQueryKey, fetchAdminMatches } from '@/lib/adminApi'
import { AdminPagination, AdminSearchBar, formatDate } from '@/features/admin/AdminUi'
import { MatchTierBadge } from '@/features/applications/MatchInsights'
import type { TailoredApplication } from '@/lib/applicationsApi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 50

export function AdminMatchesPage() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState('')
  const [hasApplication, setHasApplication] = useState<string>('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminMatchesQueryKey({
      limit: PAGE_SIZE,
      offset,
      search,
      status: status || undefined,
      hasApplication: hasApplication === '' ? undefined : hasApplication === 'true',
    }),
    queryFn: () => fetchAdminMatches({
      limit: PAGE_SIZE,
      offset,
      search,
      status: status || undefined,
      hasApplication: hasApplication === '' ? undefined : hasApplication === 'true',
    }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Matches</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Review match quality — scores, gate results, adjudication, and whether tailoring ran.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminSearchBar value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="Search job, company, or user email…" />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setOffset(0) }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={hasApplication}
          onChange={(e) => { setHasApplication(e.target.value); setOffset(0) }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All matches</option>
          <option value="true">Has application</option>
          <option value="false">No application</option>
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
                <th className="px-4 py-3 font-medium">Gate</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">App</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((match) => {
                const appLike = match as unknown as TailoredApplication
                return (
                  <tr key={match.id} className="border-b last:border-b-0 hover:bg-surface-tertiary/30">
                    <td className="px-4 py-3">
                      <Link to="/admin/matches/$id" params={{ id: String(match.id) }} className="font-medium text-primary hover:underline">
                        {match.jobTitle}
                      </Link>
                      <p className="text-xs text-content-secondary">@{match.jobCompany}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/admin/users/$id" params={{ id: match.userId }} className="text-content-secondary hover:underline">
                        {match.userEmail}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><MatchTierBadge app={appLike} showScore /></td>
                    <td className="px-4 py-3">
                      {match.gatePassed == null ? '—' : match.gatePassed ? (
                        <Badge variant="secondary">Pass</Badge>
                      ) : (
                        <Badge variant="destructive">Fail</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{match.status}</td>
                    <td className="px-4 py-3">
                      {match.hasApplication && match.applicationId ? (
                        <Link to="/admin/applications/$id" params={{ id: match.applicationId }} className="text-primary hover:underline">
                          View
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{formatDate(match.createdAt)}</td>
                  </tr>
                )
              })}
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

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { adminUserQueryKey, fetchAdminUser } from '@/lib/adminApi'
import { formatDate } from '@/features/admin/AdminUi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminUserDetailPage() {
  const { id } = useParams({ from: '/_admin/admin/users/$id' })
  const { data, isLoading, error } = useQuery({
    queryKey: adminUserQueryKey(id),
    queryFn: () => fetchAdminUser(id),
  })

  if (isLoading) return <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" />
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (!data) return <p className="text-sm text-content-secondary">User not found.</p>

  const profile = data.profile ?? {}
  const identity = (profile.identity ?? {}) as Record<string, string>
  const fullName = [identity.firstName, identity.lastName].filter(Boolean).join(' ') || '—'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" render={<Link to="/admin/users" />} className="mb-2 -ml-2">
            ← Users
          </Button>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.email}</h1>
          <p className="mt-1 text-sm text-content-secondary">Joined {formatDate(data.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
          <Button variant="outline" size="sm" render={<Link to="/admin/matches" search={{ userId: data.id }} />}>
            View matches
          </Button>
          <Button variant="outline" size="sm" render={<Link to="/admin/applications" search={{ userId: data.id }} />}>
            View applications
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-content-tertiary">Matches</p><p className="text-2xl font-semibold">{data.matchCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-content-tertiary">Applications</p><p className="text-2xl font-semibold">{data.applicationCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-content-tertiary">Marked sent</p><p className="text-2xl font-semibold">{data.sentCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-content-tertiary">Profile status</p><p className="text-sm font-medium">{data.profileSubmittedAt ? 'Submitted' : data.hasProfile ? 'Draft' : 'None'}</p></CardContent></Card>
      </div>

      <Card className="shadow-whisper">
        <CardHeader><CardTitle className="text-sm font-medium">Profile summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-content-tertiary">Name:</span> {fullName}</p>
          <p><span className="text-content-tertiary">Submitted:</span> {formatDate(data.profileSubmittedAt)}</p>
          <p><span className="text-content-tertiary">Updated:</span> {formatDate(data.profileUpdatedAt)}</p>
        </CardContent>
      </Card>

      {data.profile ? (
        <Card className="shadow-whisper">
          <CardHeader><CardTitle className="text-sm font-medium">Raw profile JSON</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto rounded-md bg-surface-tertiary/40 p-3 text-xs leading-relaxed text-content-secondary">
              {JSON.stringify(data.profile, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

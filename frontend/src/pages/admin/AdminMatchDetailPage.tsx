import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { adminMatchQueryKey, fetchAdminMatch } from '@/lib/adminApi'
import { formatDate } from '@/features/admin/AdminUi'
import { MatchInsightsPanel, MatchTierBadge } from '@/features/applications/MatchInsights'
import type { TailoredApplication } from '@/lib/applicationsApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminMatchDetailPage() {
  const { id } = useParams({ from: '/_admin/admin/matches/$id' })
  const { data, isLoading, error } = useQuery({
    queryKey: adminMatchQueryKey(id),
    queryFn: () => fetchAdminMatch(id),
  })

  if (isLoading) return <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" />
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (!data) return <p className="text-sm text-content-secondary">Match not found.</p>

  const appLike = data as unknown as TailoredApplication

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/admin/matches" />} className="mb-2 -ml-2">
          ← Matches
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.jobTitle}</h1>
            <p className="mt-1 text-sm text-content-secondary">@{data.jobCompany}{data.jobLocation ? ` · ${data.jobLocation}` : ''}</p>
          </div>
          <MatchTierBadge app={appLike} showScore />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">User: {data.userEmail}</Badge>
        <Badge variant="outline">Status: {data.status}</Badge>
        <Badge variant="outline">Created: {formatDate(data.createdAt)}</Badge>
        {data.gatePassed != null ? (
          <Badge variant={data.gatePassed ? 'secondary' : 'destructive'}>
            Gate {data.gatePassed ? 'passed' : 'failed'}
          </Badge>
        ) : null}
      </div>

      <MatchInsightsPanel app={appLike} />

      {data.matchReason?.gate?.reasons?.length ? (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Gate reasons</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-content-secondary">
              {data.matchReason.gate.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.scoreBreakdown ? (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Score breakdown</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(data.scoreBreakdown).map(([key, value]) => (
              <p key={key}><span className="text-content-tertiary">{key}:</span> {String(value)}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.adjudication ? (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">LLM adjudication</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Recommend: {data.adjudication.recommend ? 'Yes' : 'No'}</p>
            <p>Fit score: {data.adjudication.fitScore}</p>
            <p>Seniority fit: {data.adjudication.seniorityFit ?? '—'}</p>
            {data.adjudication.strengths?.length ? (
              <div>
                <p className="font-medium">Strengths</p>
                <ul className="list-disc pl-5 text-content-secondary">{data.adjudication.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            ) : null}
            {data.adjudication.gaps?.length ? (
              <div>
                <p className="font-medium">Gaps</p>
                <ul className="list-disc pl-5 text-content-secondary">{data.adjudication.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data.hasApplication && data.applicationId ? (
        <Button render={<Link to="/admin/applications/$id" params={{ id: data.applicationId }} />}>
          View tailored application
        </Button>
      ) : null}
    </div>
  )
}

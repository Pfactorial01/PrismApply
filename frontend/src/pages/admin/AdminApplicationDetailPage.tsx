import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { adminApplicationQueryKey, fetchAdminApplication } from '@/lib/adminApi'
import { formatDate } from '@/features/admin/AdminUi'
import { MatchInsightsPanel, MatchTierBadge } from '@/features/applications/MatchInsights'
import { buildApplicationPackageFields } from '@/features/applications/applicationPackage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function AdminApplicationDetailPage() {
  const { id } = useParams({ from: '/_admin/admin/applications/$id' })
  const { data, isLoading, error } = useQuery({
    queryKey: adminApplicationQueryKey(id),
    queryFn: () => fetchAdminApplication(id),
  })

  if (isLoading) return <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" />
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (!data) return <p className="text-sm text-content-secondary">Application not found.</p>

  const fields = buildApplicationPackageFields(data)

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/admin/applications" />} className="mb-2 -ml-2">
          ← Applications
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.title}</h1>
            <p className="mt-1 text-sm text-content-secondary">@{data.company}{data.location ? ` · ${data.location}` : ''}</p>
            <p className="mt-1 text-xs text-content-tertiary">
              User:{' '}
              <Link to="/admin/users/$id" params={{ id: data.userId }} className="text-primary hover:underline">
                {data.userEmail}
              </Link>
              {' · '}
              Match #{data.matchId}
            </p>
          </div>
          <MatchTierBadge app={data} showScore />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">Status: {data.status}</Badge>
        <Badge variant="outline">{data.markedSent ? 'Marked sent' : 'Not sent'}</Badge>
        <Badge variant="outline">Created: {formatDate(data.createdAt)}</Badge>
        {data.applyUrl ? (
          <a href={data.applyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Apply URL
          </a>
        ) : null}
      </div>

      <MatchInsightsPanel app={data} />

      <Card className="shadow-whisper">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Form field answers ({fields.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-content-secondary">No form fields for this job.</p>
          ) : (
            fields.map((field) => (
              <div key={field.label} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </p>
                <div className="rounded-md border bg-surface-tertiary/30 px-3.5 py-2.5 text-sm text-content-secondary whitespace-pre-wrap">
                  {field.value.trim() || '—'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-whisper">
        <CardHeader><CardTitle className="text-sm font-medium">Cover letter</CardTitle></CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm text-content-secondary">{data.tailoredCoverLetter || '—'}</pre>
        </CardContent>
      </Card>

      <Card className="shadow-whisper">
        <CardHeader><CardTitle className="text-sm font-medium">Tailored resume (text)</CardTitle></CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-content-secondary">{data.tailoredResume || '—'}</pre>
        </CardContent>
      </Card>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { Briefcase, Send, ChevronRight, FileText, Inbox, TrendingUp, Target } from 'lucide-react'
import { authMeQueryKey, fetchAuthMe } from '@/lib/auth'
import { getProfileFirstName } from '@/lib/displayName'
import { applicantProfileQueryKeyFor, fetchApplicantProfile } from '@/lib/profileApi'
import { applicationsQueryKey, fetchApplications } from '@/lib/applicationsApi'
import { interviewPrepLine } from '@/lib/copy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function OverviewPage() {
  const navigate = useNavigate()

  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })

  const { data: profile } = useQuery({
    queryKey: applicantProfileQueryKeyFor(user?.id ?? ''),
    queryFn: fetchApplicantProfile,
    staleTime: Infinity,
    enabled: Boolean(user?.id),
  })

  const { data: apps } = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
    enabled: Boolean(user?.id),
  })

  useEffect(() => {
    if (profile && !profile.resumePlainText.trim()) {
      void navigate({ to: '/profile' })
    }
  }, [profile, navigate])

  const totalApps = apps?.length ?? 0
  const sentApps = apps?.filter((a) => a.markedSent).length ?? 0
  const unsentApps = totalApps - sentApps
  const recentApps = useMemo(() => (apps ?? []).slice(0, 5), [apps])
  const firstName = getProfileFirstName(profile)

  if (!profile || !profile.resumePlainText.trim()) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Hello{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-content-secondary">
            {interviewPrepLine} Review tailored packages and track what you have sent.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-whisper">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-normal text-content-secondary">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                <Briefcase className="size-3.5 text-primary" />
              </span>
              Total packages
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">{totalApps}</p>
          </CardContent>
        </Card>

        <Card className="shadow-whisper">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-normal text-content-secondary">
              <span className="flex size-6 items-center justify-center rounded-md bg-chart-3/15">
                <Send className="size-3.5 text-chart-3" />
              </span>
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">{sentApps}</p>
          </CardContent>
        </Card>

        <Card className="shadow-whisper">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-normal text-content-secondary">
              <span className="flex size-6 items-center justify-center rounded-md bg-accent/15">
                <Inbox className="size-3.5 text-accent" />
              </span>
              Ready to send
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">{unsentApps}</p>
          </CardContent>
        </Card>

        <Card className="shadow-whisper">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-normal text-content-secondary">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                <TrendingUp className="size-3.5 text-primary" />
              </span>
              Submission rate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">
              {totalApps > 0 ? `${Math.round((sentApps / totalApps) * 100)}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-whisper lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent applications</CardTitle>
              {totalApps > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate({ to: '/applications' })}>
                  View all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentApps.length === 0 ? (
              <p className="text-sm text-content-secondary">No applications yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => navigate({ to: '/applications/$id', params: { id: app.id } })}
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-sm transition-colors hover:bg-surface-tertiary/50 rounded-md -mx-2"
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                      app.markedSent ? 'bg-chart-3/15' : 'bg-primary/10'
                    }`}>
                      {app.markedSent ? (
                        <Send className="size-4 text-chart-3" />
                      ) : (
                        <FileText className="size-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`truncate font-medium ${
                        app.markedSent ? 'text-content-secondary line-through' : ''
                      }`}>{app.title}</p>
                      <p className="truncate text-xs text-content-secondary">@{app.company}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-content-tertiary" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-whisper">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="size-4 text-primary" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="rounded-md border bg-surface-tertiary/30 px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Applications sent</span>
                <span className="font-semibold">{sentApps}</span>
              </div>
            </div>
            <div className="rounded-md border bg-surface-tertiary/30 px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Awaiting submission</span>
                <span className="font-semibold">{unsentApps}</span>
              </div>
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm dark:border-primary/30 dark:bg-primary/10">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Submission rate</span>
                <span className="font-semibold text-primary">
                  {totalApps > 0 ? `${Math.round((sentApps / totalApps) * 100)}%` : '—'}
                </span>
              </div>
            </div>

            {totalApps > 0 && (
              <div className="pt-2">
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className="rounded-full bg-chart-3 transition-all"
                    style={{ width: `${(sentApps / totalApps) * 100}%` }}
                  />
                  <div
                    className="rounded-full bg-accent transition-all"
                    style={{ width: `${(unsentApps / totalApps) * 100}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-content-secondary">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-chart-3" />
                    Sent
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-accent" />
                    Unsent
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { trackOnce } from '@/lib/analytics'
import {
  FileText,
  Briefcase,
  MapPin,
  Send,
  Inbox,
  ChevronRight,
} from 'lucide-react'
import {
  applicationsQueryKey,
  fetchApplications,
  type TailoredApplication,
} from '@/lib/applicationsApi'
import { authMeQueryKey, fetchAuthMe } from '@/lib/auth'
import { applicantProfileQueryKeyFor, fetchApplicantProfile } from '@/lib/profileApi'
import { isApplicantProfileComplete } from '@/features/applicant-profile/profileCompletion'
import { MatchTierBadge } from '@/features/applications/MatchInsights'
import { truthPledge } from '@/lib/copy'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function AppListCard({ app }: { app: TailoredApplication }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/applications/$id', params: { id: app.id } })}
      className="flex w-full items-center gap-4 rounded-md border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-surface-tertiary/50 shadow-whisper"
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
        app.markedSent ? 'bg-chart-3/15' : 'bg-primary/10'
      }`}>
        {app.markedSent ? (
          <Send className="size-4 text-chart-3" />
        ) : (
          <Briefcase className="size-4 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${
            app.markedSent ? 'text-content-secondary line-through' : ''
          }`}>
            {app.title}
          </span>
          <span className="shrink-0 text-sm text-content-secondary">
            @{app.company}
          </span>
        </div>
        {app.location && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-content-tertiary">
            <MapPin className="size-3" />
            {app.location}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <MatchTierBadge app={app} showScore />
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-content-tertiary" />
    </button>
  )
}

function AppSection({
  title,
  icon: Icon,
  apps,
  emptyMessage,
}: {
  title: string
  icon: typeof Inbox
  apps: TailoredApplication[]
  emptyMessage: string
}) {
  return (
    <Card className="shadow-whisper">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-content-secondary" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <span className="ml-auto text-xs text-content-secondary tabular-nums">{apps.length}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {apps.length === 0 ? (
          <p className="text-sm text-content-secondary">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {apps.map((app) => (
              <AppListCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ApplicationsPage() {
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

  const { data: apps, isLoading, error } = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
  })

  const profileComplete = isApplicantProfileComplete(profile)

  const sentApps = useMemo(() => (apps ?? []).filter((a) => a.markedSent), [apps])
  const unsentApps = useMemo(() => (apps ?? []).filter((a) => !a.markedSent), [apps])

  useEffect(() => {
    if (apps && apps.length > 0) {
      trackOnce('first-match', 'First Match', { count: String(apps.length) })
    }
  }, [apps])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Applications</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Tailored packages for every match — factual, role-specific, ready when you are.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-content-tertiary">{truthPledge}</p>
      </div>

      {isLoading && (
        <div className="space-y-3" role="status" aria-label="Loading applications">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-surface-tertiary" />
          ))}
        </div>
      )}

      {error && (
        <Card className="shadow-whisper">
          <CardContent className="px-4 py-5">
            <p className="font-medium text-destructive">Failed to load applications</p>
            <p className="mt-1 text-sm text-content-secondary">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      )}

      {apps && apps.length === 0 && (
        <Card className="shadow-whisper">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <FileText className="size-10 text-content-tertiary" />
            {profileComplete ? (
              <p className="max-w-md text-sm text-content-secondary">
                No applications yet. Your profile is saved — we are searching for roles and
                tailoring packages. Check back here soon, or focus on interview prep in the meantime.
              </p>
            ) : (
              <>
                <p className="max-w-md text-sm text-content-secondary">
                  No applications yet. Complete every step of your profile and click
                  Save profile so we can find matching roles and build your applications.
                </p>
                <Button render={<Link to="/profile" />}>Complete profile</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {apps && apps.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          <AppSection
            title="Ready to send"
            icon={Inbox}
            apps={unsentApps}
            emptyMessage="All applications have been sent."
          />
          <AppSection
            title="Sent"
            icon={Send}
            apps={sentApps}
            emptyMessage="No applications marked as sent yet."
          />
        </div>
      )}
    </div>
  )
}

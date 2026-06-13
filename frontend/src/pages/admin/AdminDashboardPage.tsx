import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { adminStatsQueryKey, fetchAdminStats } from '@/lib/adminApi'
import { StatCard } from '@/features/admin/AdminUi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminStatsQueryKey,
    queryFn: fetchAdminStats,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Admin dashboard</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Platform overview for users, matches, applications, and background jobs.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-surface-tertiary" />
          ))}
        </div>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="py-5 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users" value={data.totalUsers} hint={`${data.usersWithSubmittedProfile} submitted profiles`} />
            <StatCard label="Matches" value={data.totalMatches} hint={`${data.pendingMatches} pending`} />
            <StatCard label="Applications" value={data.totalApplications} hint={`${data.completedApplications} completed`} />
            <StatCard label="Marked sent" value={data.markedSentApplications} />
            <StatCard label="Discovered jobs" value={data.totalJobs} hint={`${data.jobsLast7Days} in last 7 days`} />
            <StatCard label="Matches → apps" value={data.matchesWithApplications} />
            <StatCard label="Failed job runs" value={data.failedJobRuns} />
            <StatCard label="Pending job runs" value={data.pendingJobRuns} />
          </section>

          <Card className="shadow-whisper">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link to="/admin/users" />}>Browse users</Button>
              <Button variant="outline" size="sm" render={<Link to="/admin/matches" />}>Review matches</Button>
              <Button variant="outline" size="sm" render={<Link to="/admin/applications" />}>Inspect applications</Button>
              <Button variant="outline" size="sm" render={<Link to="/admin/job-runs" />}>Job runs</Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

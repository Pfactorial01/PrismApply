import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthPageLayout } from '@/components/auth/AuthPageLayout'
import { authMeQueryKey, loginRequest, sanitizeRedirectParam } from '@/lib/auth'
import { applicantProfileQueryKey, fetchApplicantProfile } from '@/lib/profileApi'
import { isProfileSubmitted } from '@/features/applicant-profile/profileCompletion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const redirectTo = useRouterState({
    select: (s) =>
      sanitizeRedirectParam(
        (s.location.search as { redirect?: unknown }).redirect,
      ),
  })
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const signupSearch =
    redirectTo != null ? { redirect: redirectTo } : undefined

  async function resolveRedirect() {
    const profile = await fetchApplicantProfile()
    if (isProfileSubmitted(profile)) {
      return redirectTo ?? '/'
    }
    return '/profile'
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const user = await loginRequest(email, password)
      queryClient.removeQueries({ queryKey: applicantProfileQueryKey })
      queryClient.setQueryData(authMeQueryKey, user)
      await router.invalidate()
      const to = await resolveRedirect()
      await navigate({ to })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPageLayout
      title="Log in"
      description={
        <>
          No account?{' '}
          <Link
            to="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
            search={signupSearch}
          >
            Sign up
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
          {pending ? 'Signing in\u2026' : 'Sign in'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}

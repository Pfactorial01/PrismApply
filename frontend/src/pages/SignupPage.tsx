import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { signupSourceFromUrl, trackEvent, identifyUser } from '@/lib/analytics'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthPageLayout } from '@/components/auth/AuthPageLayout'
import { authMeQueryKey, sanitizeRedirectParam, signupRequest } from '@/lib/auth'
import { applicantProfileQueryKey } from '@/lib/profileApi'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SIGNUP_STEPS = [
  'Create your account',
  'Tell your story once (profile & resume)',
  'Focus on interview prep — we search & tailor',
] as const

export function SignupPage() {
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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acknowledgedPilot, setAcknowledgedPilot] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const passwordsMatch = password === confirmPassword
  const canSubmit =
    acknowledgedPilot &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    passwordsMatch

  const loginSearch =
    redirectTo != null ? { redirect: redirectTo } : undefined

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!acknowledgedPilot) {
      setError('Please acknowledge the pilot stage scope before creating an account.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    try {
      const user = await signupRequest(email, password)
      identifyUser(user.id, { email: user.email })
      trackEvent('Signup Complete', { source: signupSourceFromUrl() })
      queryClient.removeQueries({ queryKey: applicantProfileQueryKey })
      queryClient.setQueryData(authMeQueryKey, user)
      await router.invalidate()
      await navigate({ to: '/profile' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPageLayout
      title="Create your account"
      description={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
            search={loginSearch}
          >
            Log in
          </Link>
        </>
      }
    >
      <ol className="mb-1 space-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
        {SIGNUP_STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-2.5 text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className={i === 0 ? 'font-medium text-foreground' : undefined}>{step}</span>
          </li>
        ))}
      </ol>

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
          />
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <p className="text-sm text-destructive">Passwords do not match.</p>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-3">
          <Checkbox
            id="pilot-acknowledgment"
            checked={acknowledgedPilot}
            onCheckedChange={(v) => setAcknowledgedPilot(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Tech roles only.</span>{' '}
            More industries are coming. I understand and want to sign up.
          </span>
        </label>
        {error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={pending || !canSubmit} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
          {pending ? 'Creating account\u2026' : 'Create account'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}

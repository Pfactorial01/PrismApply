import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthPageLayout } from '@/components/auth/AuthPageLayout'
import { authMeQueryKey, sanitizeRedirectParam, signupRequest } from '@/lib/auth'
import { applicantProfileQueryKey } from '@/lib/profileApi'
import { Button } from '@/components/ui/button'
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
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const loginSearch =
    redirectTo != null ? { redirect: redirectTo } : undefined

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const user = await signupRequest(email, password)
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
        {error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
          {pending ? 'Creating account\u2026' : 'Create account'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}

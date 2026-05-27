import { Link, Outlet, useNavigate, useRouter, useLocation } from '@tanstack/react-router'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  LayoutDashboard,
  Briefcase,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react'
import { authMeQueryKey, fetchAuthMe, logoutRequest } from '@/lib/auth'
import { getProfileFirstName } from '@/lib/displayName'
import {
  applicantProfileQueryKey,
  applicantProfileQueryKeyFor,
  fetchApplicantProfile,
} from '@/lib/profileApi'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const FULL_NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true, requiresProfile: true },
  { to: '/applications', label: 'Applications', icon: Briefcase, exact: false, requiresProfile: true },
  { to: '/profile', label: 'Profile', icon: UserCircle, exact: false, requiresProfile: false },
  { to: '/settings', label: 'Settings', icon: Settings, exact: false, requiresProfile: false },
] as const

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const router = useRouter()
  const location = useLocation()
  const { theme, toggle: toggleTheme } = useTheme()

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

  const profileComplete = Boolean(profile?.resumePlainText?.trim())
  const firstName = getProfileFirstName(profile)
  const avatarLetter = (firstName?.charAt(0) ?? user?.email?.charAt(0) ?? '?').toUpperCase()

  async function onLogout() {
    await logoutRequest()
    queryClient.removeQueries({ queryKey: applicantProfileQueryKey })
    queryClient.removeQueries({ queryKey: authMeQueryKey })
    await router.invalidate()
    await navigate({ to: '/login' })
  }

  const isOnProfile = location.pathname === '/profile'

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-3 px-3 py-4">
        <img src="/favicon.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
        <span className="text-sm font-semibold text-foreground">PrismApply</span>
      </div>

      {!profileComplete && !isOnProfile ? (
        <div className="mx-3 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Complete your profile to access all features.</span>
          </div>
        </div>
      ) : null}

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {FULL_NAV.map((item) => {
          const blocked = item.requiresProfile && !profileComplete
          return (
            <Link
              key={item.to}
              to={blocked ? '/profile' : item.to}
              activeOptions={{ exact: item.exact }}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                blocked
                  ? 'text-content-tertiary/40 cursor-not-allowed hover:bg-transparent hover:text-content-tertiary/40'
                  : 'text-content-secondary hover:bg-surface-tertiary hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary dark:[&.active]:bg-primary/15 dark:[&.active]:text-primary'
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {blocked ? <span className="ml-auto text-xs text-content-tertiary/40">Locked</span> : null}
            </Link>
          )
        })}
      </nav>

      <Separator />

      <div className="flex flex-col gap-2 p-3">
        {user && (
          <div className="flex items-start gap-3 rounded-md px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-xs font-semibold text-content-secondary">
              {avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              {firstName ? (
                <p className="text-sm font-medium text-foreground">{firstName}</p>
              ) : null}
              <p className="break-all text-xs leading-snug text-content-secondary">
                {user.email}
              </p>
            </div>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={toggleTheme} className="justify-start gap-3">
          {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </Button>

        <Button variant="ghost" size="sm" onClick={() => void onLogout()} className="justify-start gap-3 text-destructive hover:text-destructive">
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </div>
  )
}

export function SidepanelLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="h-dvh overflow-hidden">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <img src="/favicon.svg" alt="" width={24} height={24} className="size-6 shrink-0" />
        <span className="text-sm font-semibold">PrismApply</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col lg:border-r lg:border-border lg:bg-sidebar">
        <NavContent />
      </aside>

      {/* Main content */}
      <main className="h-dvh overflow-y-auto pt-14 lg:ml-80 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

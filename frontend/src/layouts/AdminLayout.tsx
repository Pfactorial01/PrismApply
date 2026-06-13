import { Link, Outlet, useNavigate, useRouter, useLocation } from '@tanstack/react-router'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  GitCompareArrows,
  Briefcase,
  Activity,
  ArrowLeft,
  LogOut,
  Menu,
  Sun,
  Moon,
} from 'lucide-react'
import { authMeQueryKey, fetchAuthMe, logoutRequest } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users, exact: false },
  { to: '/admin/matches', label: 'Matches', icon: GitCompareArrows, exact: false },
  { to: '/admin/applications', label: 'Applications', icon: Briefcase, exact: false },
  { to: '/admin/job-runs', label: 'Job runs', icon: Activity, exact: false },
] as const

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { theme, toggle: toggleTheme } = useTheme()

  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })

  async function onLogout() {
    await logoutRequest()
    queryClient.removeQueries({ queryKey: authMeQueryKey })
    await router.invalidate()
    await navigate({ to: '/login' })
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-3 px-3 py-4">
        <img src="/favicon.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
        <div>
          <span className="text-sm font-semibold text-foreground">PrismApply</span>
          <p className="text-xs text-content-secondary">Admin</p>
        </div>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-tertiary hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary dark:[&.active]:bg-primary/15"
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator />

      <div className="flex flex-col gap-2 p-3">
        {user ? (
          <p className="break-all px-3 text-xs text-content-secondary">{user.email}</p>
        ) : null}

        <Button variant="ghost" size="sm" render={<Link to="/" />} className="justify-start gap-3">
          <ArrowLeft className="size-4" />
          Back to app
        </Button>

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

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="h-dvh overflow-hidden">
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">Admin</span>
        <span className="truncate text-xs text-content-secondary">{location.pathname}</span>
      </div>

      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-border lg:bg-sidebar">
        <NavContent />
      </aside>

      <main className="h-dvh overflow-y-auto pt-14 lg:ml-72 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { OverviewPage } from './pages/OverviewPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminMatchesPage } from './pages/admin/AdminMatchesPage'
import { AdminMatchDetailPage } from './pages/admin/AdminMatchDetailPage'
import { AdminApplicationsPage } from './pages/admin/AdminApplicationsPage'
import { AdminApplicationDetailPage } from './pages/admin/AdminApplicationDetailPage'
import { AdminJobRunsPage } from './pages/admin/AdminJobRunsPage'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { authMeQueryKey, fetchAuthMe } from './lib/auth'
import { applicantProfileQueryKeyFor, fetchApplicantProfile } from './lib/profileApi'
import { isProfileReadyForApp } from './features/applicant-profile/profileCompletion'

async function ensureSessionUser(queryClient: QueryClient) {
  return queryClient.ensureQueryData({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  ),
})

const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ context, location }) => {
    const user = await ensureSessionUser(context.queryClient)
    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
  },
  component: AuthenticatedLayout,
})

async function ensureProfile(queryClient: QueryClient) {
  const user = await ensureSessionUser(queryClient)
  if (!user) {
    throw redirect({ to: '/login' })
  }
  return queryClient.ensureQueryData({
    queryKey: applicantProfileQueryKeyFor(user.id),
    queryFn: fetchApplicantProfile,
    staleTime: 30_000,
  })
}

const indexRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const profile = await ensureProfile(context.queryClient)
    if (!isProfileReadyForApp(profile)) {
      throw redirect({ to: '/profile' })
    }
  },
  component: OverviewPage,
})

const applicationsRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/applications',
  beforeLoad: async ({ context }) => {
    const profile = await ensureProfile(context.queryClient)
    if (!isProfileReadyForApp(profile)) {
      throw redirect({ to: '/profile' })
    }
  },
  component: ApplicationsPage,
})

const applicationDetailRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/applications/$id',
  beforeLoad: async ({ context }) => {
    const profile = await ensureProfile(context.queryClient)
    if (!isProfileReadyForApp(profile)) {
      throw redirect({ to: '/profile' })
    }
  },
  component: ApplicationDetailPage,
})

const profileRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/profile',
  component: ProfilePage,
})

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/settings',
  beforeLoad: async ({ context }) => {
    const profile = await ensureProfile(context.queryClient)
    if (!isProfileReadyForApp(profile)) {
      throw redirect({ to: '/profile' })
    }
  },
  component: SettingsPage,
})

async function ensureAdminUser(queryClient: QueryClient) {
  const user = await ensureSessionUser(queryClient)
  if (!user) {
    throw redirect({ to: '/login' })
  }
  if (!user.isAdmin) {
    throw redirect({ to: '/' })
  }
  return user
}

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_admin',
  beforeLoad: async ({ context }) => {
    await ensureAdminUser(context.queryClient)
  },
  component: AdminLayout,
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin',
  component: AdminDashboardPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/users',
  component: AdminUsersPage,
})

const adminUserDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/users/$id',
  component: AdminUserDetailPage,
})

const adminMatchesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/matches',
  component: AdminMatchesPage,
})

const adminMatchDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/matches/$id',
  component: AdminMatchDetailPage,
})

const adminApplicationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/applications',
  component: AdminApplicationsPage,
})

const adminApplicationDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/applications/$id',
  component: AdminApplicationDetailPage,
})

const adminJobRunsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/job-runs',
  component: AdminJobRunsPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async ({ context }) => {
    const user = await ensureSessionUser(context.queryClient)
    if (user) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  beforeLoad: async ({ context }) => {
    const user = await ensureSessionUser(context.queryClient)
    if (user) throw redirect({ to: '/' })
  },
  component: SignupPage,
})

const routeTree = rootRoute.addChildren([
  authenticatedLayoutRoute.addChildren([
    indexRoute,
    applicationsRoute,
    applicationDetailRoute,
    profileRoute,
    settingsRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminIndexRoute,
    adminUsersRoute,
    adminUserDetailRoute,
    adminMatchesRoute,
    adminMatchDetailRoute,
    adminApplicationsRoute,
    adminApplicationDetailRoute,
    adminJobRunsRoute,
  ]),
  loginRoute,
  signupRoute,
])

export function getRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

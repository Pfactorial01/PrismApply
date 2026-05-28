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

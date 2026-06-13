import { apiFetch } from './api'

export const authMeQueryKey = ['auth', 'me'] as const

export type AuthUser = {
  id: string
  email: string
  isAdmin?: boolean
}

/** Dev-only mock session when the API is unreachable (Vite only). */
const DEV_SESSION_KEY = 'prismapply:devAuthUser'

function readDevUser(): AuthUser | null {
  if (!import.meta.env.DEV) return null
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function writeDevUser(user: AuthUser) {
  if (import.meta.env.DEV) {
    sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify(user))
  }
}

function clearDevUser() {
  sessionStorage.removeItem(DEV_SESSION_KEY)
}

export function sanitizeRedirectParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return undefined
  return raw
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/** Prefer real HttpOnly-cookie session; in dev, fall back to sessionStorage mock only if /me is 401 or the request fails. */
export async function fetchAuthMe(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch('/api/auth/me', { method: 'GET' })
    if (res.ok) {
      return (await res.json()) as AuthUser
    }
    if (res.status === 401) {
      const dev = readDevUser()
      if (import.meta.env.DEV && dev) return dev
      return null
    }
    throw new Error(await readErrorMessage(res))
  } catch {
    const dev = readDevUser()
    if (import.meta.env.DEV && dev) return dev
    return null
  }
}

async function devFallbackMockLogin(email: string): Promise<AuthUser> {
  const user: AuthUser = {
    id: 'dev-user',
    email: email.trim() || 'dev@local.test',
  }
  writeDevUser(user)
  return user
}

export async function loginRequest(email: string, password: string): Promise<AuthUser> {
  let res: Response
  try {
    res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  } catch (e) {
    if (import.meta.env.DEV) {
      return devFallbackMockLogin(email)
    }
    throw e
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  clearDevUser()
  if (res.status === 204) {
    const me = await fetchAuthMe()
    if (!me) throw new Error('Login succeeded but session could not be loaded.')
    return me
  }
  return (await res.json()) as AuthUser
}

export async function signupRequest(email: string, password: string): Promise<AuthUser> {
  let res: Response
  try {
    res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  } catch (e) {
    if (import.meta.env.DEV) {
      return devFallbackMockLogin(email)
    }
    throw e
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  clearDevUser()
  if (res.status === 204) {
    const me = await fetchAuthMe()
    if (!me) throw new Error('Signup succeeded but session could not be loaded.')
    return me
  }
  return (await res.json()) as AuthUser
}

export async function logoutRequest(): Promise<void> {
  clearDevUser()
  try {
    const res = await apiFetch('/api/auth/logout', { method: 'POST' })
    if (!res.ok && res.status !== 401) {
      throw new Error(await readErrorMessage(res))
    }
  } catch {
    // Offline or no server — cookies cleared client-side where applicable.
  }
}

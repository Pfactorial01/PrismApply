/** Base URL for API (e.g. `https://api.example.com`). Empty = same origin / Vite proxy. */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok || res.status === 204
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function shouldRetryAfterRefresh(path: string): boolean {
  if (path === '/api/auth/refresh' || path === '/api/auth/login' || path === '/api/auth/signup' || path === '/api/auth/logout') {
    return false
  }
  return true
}

/** Fetch with HttpOnly cookies (access + refresh) sent on each request. Retries once after POST /api/auth/refresh on 401. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const doFetch = () =>
    fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    })

  let res = await doFetch()
  if (res.status === 401 && shouldRetryAfterRefresh(path)) {
    const ok = await refreshAccessToken()
    if (ok) {
      res = await doFetch()
    }
  }
  return res
}

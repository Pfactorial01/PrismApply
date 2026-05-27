import posthog from 'posthog-js'

let initialized = false

function posthogHost(): string {
  return import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
}

function crossSubdomainCookie(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'prismapply.com' || host.endsWith('.prismapply.com')
}

/** Initialize PostHog once. No-op when VITE_POSTHOG_KEY is unset. */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return

  const key = import.meta.env.VITE_POSTHOG_KEY?.trim()
  if (!key) return

  posthog.init(key, {
    api_host: posthogHost(),
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    cross_subdomain_cookie: crossSubdomainCookie(),
    persistence: 'localStorage+cookie',
  })
  initialized = true
}

export function identifyUser(userId: string, props?: Record<string, string>) {
  if (!initialized) return
  posthog.identify(userId, props)
}

/** Capture a custom event. */
export function trackEvent(name: string, props?: Record<string, string>) {
  if (!initialized) return
  posthog.capture(name, props)
}

/** Fire an analytics event at most once per browser (localStorage key). */
export function trackOnce(storageKey: string, name: string, props?: Record<string, string>) {
  if (typeof window === 'undefined') return
  const key = `ph:tracked:${storageKey}`
  try {
    if (localStorage.getItem(key)) return
    trackEvent(name, props)
    localStorage.setItem(key, '1')
  } catch {
    trackEvent(name, props)
  }
}

export function signupSourceFromUrl(): string {
  if (typeof window === 'undefined') return 'direct'
  const params = new URLSearchParams(window.location.search)
  return params.get('ref')?.trim() || params.get('utm_source')?.trim() || 'direct'
}

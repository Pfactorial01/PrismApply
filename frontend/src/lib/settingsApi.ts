import { apiFetch } from './api'

export type MatchTierMode = 'strong_only' | 'strong_and_promising'

export type UserSettings = {
  matchTierMode: MatchTierMode
  allowStretchMatches: boolean
}

export const defaultUserSettings: UserSettings = {
  matchTierMode: 'strong_and_promising',
  allowStretchMatches: false,
}

export const userSettingsQueryKey = ['user-settings'] as const

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function fetchUserSettings(): Promise<UserSettings> {
  const res = await apiFetch('/api/settings')
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  const raw = (await res.json()) as Partial<UserSettings>
  return {
    ...defaultUserSettings,
    ...raw,
    matchTierMode:
      raw.matchTierMode === 'strong_only' ? 'strong_only' : 'strong_and_promising',
    allowStretchMatches: raw.allowStretchMatches === true,
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const res = await apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
}

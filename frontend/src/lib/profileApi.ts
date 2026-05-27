import type { QueryClient } from '@tanstack/react-query'
import { normalizeProfileDraftFromUnknown } from '../features/applicant-profile/normalizeProfileDraft'
import type { ApplicantProfileDraft } from '../features/applicant-profile/types'
import { apiFetch } from './api'

/** Prefix for all profile queries (logout clears every cached user). */
export const applicantProfileQueryKey = ['applicant-profile'] as const

export function applicantProfileQueryKeyFor(userId: string) {
  return [...applicantProfileQueryKey, userId] as const
}

export function setApplicantProfileCache(
  queryClient: QueryClient,
  userId: string,
  draft: ApplicantProfileDraft,
) {
  queryClient.setQueryData(applicantProfileQueryKeyFor(userId), draft)
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function fetchApplicantProfile(): Promise<ApplicantProfileDraft> {
  const res = await apiFetch('/api/profile')
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  const raw: unknown = await res.json()
  return normalizeProfileDraftFromUnknown(raw)
}

/** Autosave draft progress only; does not run embeddings or job matching. */
export async function saveApplicantProfile(draft: ApplicantProfileDraft): Promise<void> {
  const res = await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify(draft) })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
}

/** Final wizard submit: upserts profile and enqueues embed + reverse job matching. */
export async function submitApplicantProfile(draft: ApplicantProfileDraft): Promise<void> {
  const res = await apiFetch('/api/profile', { method: 'POST', body: JSON.stringify(draft) })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
}

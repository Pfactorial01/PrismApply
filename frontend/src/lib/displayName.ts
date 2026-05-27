import type { ApplicantProfileDraft } from '@/features/applicant-profile/types'

/** First name for greetings: preferred name, else first token of legal name. */
export function getProfileFirstName(
  profile: ApplicantProfileDraft | undefined,
): string | null {
  if (!profile) return null

  const preferred = profile.preferredName.trim()
  if (preferred) {
    return preferred.split(/\s+/)[0] ?? null
  }

  const full = profile.fullName.trim()
  if (full) {
    return full.split(/\s+/)[0] ?? null
  }

  return null
}

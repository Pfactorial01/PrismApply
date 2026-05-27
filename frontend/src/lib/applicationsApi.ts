import { apiFetch, apiUrl } from './api'

export type MatchTier = 'strong' | 'promising'

export interface ScoreBreakdown {
  resumePosting: number
  skillsReqs: number
  targetsPosting: number
  experienceDesc: number
  maxChunkSim: number
  matchedChunks: number
  finalScore: number
}

export interface MatchGateResult {
  ok: boolean
  reasons?: string[]
}

export interface ApplicationMatchReason {
  gate?: MatchGateResult
  direction?: 'forward' | 'reverse' | string
  strengths?: string[]
  gaps?: string[]
}

export interface MatchAdjudication {
  recommend: boolean
  fitScore: number
  preferenceViolations?: string[]
  strengths?: string[]
  gaps?: string[]
  seniorityFit?: 'good' | 'stretch' | 'under' | 'over' | string
}

export interface JobFormField {
  label: string
  fieldType: string
  required: boolean
  position: number
}

export interface TailoredApplication {
  id: string
  jobId: string
  matchId: number
  title: string
  company: string
  location: string | null
  applyUrl: string
  tailoredResume: string
  tailoredCoverLetter: string
  resumePdfUrl: string
  resumeFilename?: string
  coverLetterPdfUrl: string
  coverLetterFilename?: string
  formAnswers: { label: string; value: string }[]
  jobFormFields: JobFormField[]
  status: string
  markedSent: boolean
  sentAt: string | null
  createdAt: string
  matchScore?: number
  matchedChunks?: number
  gatePassed?: boolean
  scoreBreakdown?: ScoreBreakdown
  matchReason?: ApplicationMatchReason
  adjudication?: MatchAdjudication
  /** strong | promising — for future settings filter */
  matchTier?: MatchTier
  matchTierLabel?: string
}

export const applicationsQueryKey = ['applications'] as const

export async function fetchApplications(): Promise<TailoredApplication[]> {
  const res = await apiFetch('/api/applications')
  if (!res.ok) {
    throw new Error(`Failed to fetch applications (${res.status})`)
  }
  const apps = (await res.json()) as TailoredApplication[]
  return apps.map((app) => ({
    ...app,
    jobFormFields: app.jobFormFields ?? [],
  }))
}

export async function markApplicationSent(
  appId: string,
  markedSent: boolean,
): Promise<void> {
  const res = await apiFetch(`/api/applications/${appId}/mark-sent`, {
    method: 'PATCH',
    body: JSON.stringify({ markedSent }),
  })
  if (!res.ok) {
    throw new Error(`Failed to update application (${res.status})`)
  }
}

/** Download resume PDF with friendly filename via API proxy. */
export function resumePdfDownloadUrl(appId: string): string {
  return apiUrl(`/api/applications/${appId}/resume.pdf`)
}

/** Download cover letter PDF with friendly filename via API proxy. */
export function coverLetterPdfDownloadUrl(appId: string): string {
  return apiUrl(`/api/applications/${appId}/cover-letter.pdf`)
}

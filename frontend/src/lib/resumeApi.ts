import { apiUrl } from './api'
import { normalizeProfileDraftFromUnknown } from '../features/applicant-profile/normalizeProfileDraft'
import type { ApplicantProfileDraft } from '../features/applicant-profile/types'

export type ResumeUploadResult = {
  profile: ApplicantProfileDraft
  r2Url: string
}

export async function uploadResume(
  pdfFile: File,
  extractedText: string,
): Promise<ResumeUploadResult> {
  const formData = new FormData()
  formData.append('resume', pdfFile)
  formData.append('resumeText', extractedText)

  const res = await fetch(apiUrl('/api/resume/upload'), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!res.ok) {
    let message = 'Upload failed'
    try {
      const body = (await res.json()) as { message?: string; error?: string }
      message = body.message ?? body.error ?? message
    } catch {
      message = `Upload failed (${res.status})`
    }
    throw new Error(message)
  }

  const raw = (await res.json()) as { profile: unknown; r2Url: string }
  return {
    profile: normalizeProfileDraftFromUnknown(raw.profile),
    r2Url: raw.r2Url,
  }
}

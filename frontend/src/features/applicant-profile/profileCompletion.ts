import type { ApplicantProfileDraft } from './types'
import {
  countCompleteWorkEntries,
  getWizardSteps,
  isFeaturedProjectComplete,
  needsStateOrProvince,
} from './profileMode'

export function isWizardStepComplete(
  step: string,
  draft: ApplicantProfileDraft,
): boolean {
  switch (step) {
    case 'resume':
      return Boolean(draft.resumePlainText.trim())
    case 'basics':
      return Boolean(
        draft.fullName.trim() &&
          draft.phoneNumber.trim() &&
          draft.cityOrDetail.trim() &&
          draft.region &&
          draft.country.trim() &&
          draft.timezone &&
          (draft.timezone !== 'other' || draft.timezoneOtherNote.trim()) &&
          draft.headline.trim() &&
          (!needsStateOrProvince(draft.region) || draft.stateOrProvince.trim()),
      )
    case 'preferences':
      return Boolean(
        draft.yearsExperience &&
          draft.seniorityTarget &&
          draft.primaryDiscipline &&
          draft.workArrangement &&
          draft.englishProficiency,
      )
    case 'stack-logistics': {
      const hasTools =
        draft.selectedToolSlugs.length > 0 || draft.toolsOtherNote.trim().length > 0
      return Boolean(
        hasTools &&
          draft.compensationBand &&
          hasWorkAuthorizationAnswered(draft) &&
          draft.startAvailability &&
          isFeaturedProjectComplete(draft),
      )
    }
    case 'story':
      return Boolean(draft.storyHardestTechnicalChallenge.trim())
    default:
      return false
  }
}

/** True when every wizard step is filled and the user can save their profile. */
export function isApplicantProfileComplete(
  profile: ApplicantProfileDraft | undefined,
): boolean {
  if (!profile) return false
  const steps = getWizardSteps(profile)
  return steps.every((s) => isWizardStepComplete(s.id, profile))
}

/** Gate for app routes that require a submitted-ready profile. */
export function isProfileReadyForApp(
  profile: ApplicantProfileDraft | undefined,
): boolean {
  return isApplicantProfileComplete(profile)
}

/** True after the user has clicked Save profile at least once. */
export function isProfileSubmitted(
  profile: ApplicantProfileDraft | undefined,
): boolean {
  return Boolean(profile?.profileSubmittedAt?.trim())
}

/** Whether a wizard step can be jumped to from the progress bar. */
export function isWizardStepReachable(
  stepIndex: number,
  steps: { id: string }[],
  draft: ApplicantProfileDraft,
  current: number,
): boolean {
  if (stepIndex === current) return true
  const completed = steps.map((s) => isWizardStepComplete(s.id, draft))
  if (completed[stepIndex]) return true
  for (let j = 0; j < stepIndex; j++) {
    if (!completed[j]) return false
  }
  return true
}

/** First incomplete step index, or last step if all complete. */
export function getInitialWizardStep(draft: ApplicantProfileDraft): number {
  const steps = getWizardSteps(draft)
  const idx = steps.findIndex((s) => !isWizardStepComplete(s.id, draft))
  return idx === -1 ? steps.length - 1 : idx
}

export function workHistorySummary(draft: ApplicantProfileDraft): string {
  const n = countCompleteWorkEntries(draft)
  if (n === 0) return 'No roles detected — tap to add'
  return `${n} role${n === 1 ? '' : 's'} detected — tap to edit`
}

/** At least one work-auth answer: US/CA status, sponsorship need, or other country. */
export function hasWorkAuthorizationAnswered(draft: ApplicantProfileDraft): boolean {
  if (draft.workAuthorizedInUS || draft.workAuthorizedInCanada) return true
  if (draft.needsVisaSponsorship) return true
  return draft.authorizedCountries.length > 0
}

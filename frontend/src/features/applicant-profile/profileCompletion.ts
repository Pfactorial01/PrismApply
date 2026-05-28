import type { ApplicantProfileDraft } from './types'
import {
  countCompleteProjects,
  countCompleteWorkEntries,
  deriveProfileMode,
  getWizardSteps,
  minProjectsRequired,
} from './profileMode'

export function isWizardStepComplete(
  step: string,
  draft: ApplicantProfileDraft,
): boolean {
  const mode = deriveProfileMode(draft)

  switch (step) {
    case 'basics':
      return Boolean(draft.fullName && draft.headline && draft.region)
    case 'targets':
      return Boolean(
        draft.yearsExperience &&
          draft.seniorityTarget &&
          draft.primaryDiscipline &&
          draft.paidWorkExperience,
      )
    case 'education':
      return Boolean(draft.schoolName && draft.highestEducation)
    case 'work-history':
      return countCompleteWorkEntries(draft) >= 1
    case 'experience':
      if (mode === 'transitional') {
        return Boolean(draft.honestCareerNarrative)
      }
      return Boolean(draft.honestCareerNarrative && draft.proudestProfessionalWins)
    case 'resume-upload':
      if (mode === 'experienced') {
        return Boolean(draft.resumePlainText.trim())
      }
      return true
    case 'skills':
      if (mode === 'early') {
        return Boolean(draft.skillsCoreNarrative)
      }
      return Boolean(draft.skillsCoreNarrative && draft.highestEducation)
    case 'projects':
      return countCompleteProjects(draft) >= minProjectsRequired(mode)
    case 'stories':
      if (mode === 'early') {
        return Boolean(draft.storyHardestTechnicalChallenge)
      }
      return Boolean(
        draft.storyHardestTechnicalChallenge && draft.storyDisagreementOrConflict,
      )
    case 'goals':
      return Boolean(draft.selectedMotivationSlugs.length > 0)
    case 'work-style':
      return Boolean(draft.workArrangement && draft.visaStatus)
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

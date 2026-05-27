import type { ApplicantProfileDraft } from './types'

const WIZARD_STEP_IDS = [
  'basics',
  'targets',
  'experience',
  'resume-upload',
  'skills',
  'projects',
  'stories',
  'goals',
  'work-style',
] as const

export function isWizardStepComplete(
  step: string,
  draft: ApplicantProfileDraft,
): boolean {
  switch (step) {
    case 'basics':
      return Boolean(draft.fullName && draft.headline && draft.region)
    case 'targets':
      return Boolean(
        draft.yearsExperience && draft.seniorityTarget && draft.primaryDiscipline,
      )
    case 'experience':
      return Boolean(draft.honestCareerNarrative && draft.proudestProfessionalWins)
    case 'resume-upload':
      return Boolean(draft.resumePlainText.trim())
    case 'skills':
      return Boolean(draft.skillsCoreNarrative && draft.highestEducation)
    case 'projects':
      return draft.projects.some((p) => p.title && p.summary)
    case 'stories':
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
  return WIZARD_STEP_IDS.every((id) => isWizardStepComplete(id, profile))
}

import type { ApplicantProfileDraft, PaidWorkExperience, ProfileMode, ResumeLayout } from './types'

const EXPERIENCED_YEARS = new Set(['3-5', '5-8', '8-12', '12+'])
const SENIOR_SENIORITY = new Set(['mid', 'senior', 'staff', 'principal', 'lead', 'manager', 'director'])

export function deriveProfileMode(draft: ApplicantProfileDraft): ProfileMode {
  const years = draft.yearsExperience
  const seniority = draft.seniorityTarget
  const paid = draft.paidWorkExperience

  if (paid === 'full_time' || EXPERIENCED_YEARS.has(years)) {
    return 'experienced'
  }
  if (SENIOR_SENIORITY.has(seniority) && years !== '0-1' && years !== '') {
    return 'experienced'
  }
  if (years === '1-3') {
    return 'transitional'
  }
  if (years === '0-1' || years === '') {
    return 'early'
  }
  if (paid === 'none' || paid === 'internship_only') {
    return 'early'
  }
  return 'transitional'
}

export function deriveResumeLayout(draft: ApplicantProfileDraft): ResumeLayout {
  switch (draft.paidWorkExperience as PaidWorkExperience) {
    case 'none':
      return 'project_only'
    case 'internship_only':
      return 'hybrid'
    default:
      return 'employment_led'
  }
}

export function countCompleteProjects(draft: ApplicantProfileDraft): number {
  return draft.projects.filter((p) => p.title.trim() && p.summary.trim()).length
}

export function countCompleteWorkEntries(draft: ApplicantProfileDraft): number {
  return draft.workEntries.filter((e) => e.company.trim() && e.role.trim()).length
}

export function getFeaturedProject(draft: ApplicantProfileDraft) {
  if (draft.featuredProjectId) {
    return draft.projects.find((p) => p.id === draft.featuredProjectId)
  }
  return draft.projects.find((p) => p.title.trim() && p.summary.trim())
}

export function isFeaturedProjectComplete(draft: ApplicantProfileDraft): boolean {
  const p = getFeaturedProject(draft)
  return Boolean(p?.title.trim() && p.summary.trim())
}

export function needsStateOrProvince(region: string): boolean {
  return region === 'us' || region === 'ca'
}

export type WizardStepDef = {
  id: string
  title: string
  shortTitle: string
}

/** Fixed lean onboarding: resume → basics → preferences → stack → story. */
export const LEAN_WIZARD_STEPS: WizardStepDef[] = [
  { id: 'resume', title: 'Your resume', shortTitle: 'Resume' },
  { id: 'basics', title: 'Confirm your details', shortTitle: 'Basics' },
  { id: 'preferences', title: 'Job preferences', shortTitle: 'Preferences' },
  { id: 'stack-logistics', title: 'Stack & apply logistics', shortTitle: 'Stack' },
  { id: 'story', title: 'One story', shortTitle: 'Story' },
]

export function getWizardSteps(_draft?: ApplicantProfileDraft): WizardStepDef[] {
  return LEAN_WIZARD_STEPS
}

export function isEarlyBasics(draft: ApplicantProfileDraft): boolean {
  return deriveProfileMode(draft) === 'early'
}

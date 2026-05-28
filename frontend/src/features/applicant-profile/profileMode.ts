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

export function minProjectsRequired(mode: ProfileMode): number {
  return mode === 'early' ? 2 : 1
}

export function countCompleteProjects(draft: ApplicantProfileDraft): number {
  return draft.projects.filter((p) => p.title.trim() && p.summary.trim()).length
}

export function countCompleteWorkEntries(draft: ApplicantProfileDraft): number {
  return draft.workEntries.filter((e) => e.company.trim() && e.role.trim()).length
}

export type WizardStepDef = {
  id: string
  title: string
  shortTitle: string
}

export function getWizardSteps(draft: ApplicantProfileDraft): WizardStepDef[] {
  const mode = deriveProfileMode(draft)
  const basics: WizardStepDef = { id: 'basics', title: 'Basic information', shortTitle: 'Basics' }
  const targets: WizardStepDef = { id: 'targets', title: 'What you are looking for', shortTitle: 'Targets' }
  const skills: WizardStepDef = { id: 'skills', title: 'Skills & tools', shortTitle: 'Skills' }
  const projects: WizardStepDef = {
    id: 'projects',
    title: mode === 'early' ? 'Projects (your main proof)' : 'Personal projects',
    shortTitle: 'Projects',
  }
  const stories: WizardStepDef = {
    id: 'stories',
    title: mode === 'early' ? 'Stories from projects & learning' : 'Behavioral stories',
    shortTitle: 'Stories',
  }
  const goals: WizardStepDef = {
    id: 'goals',
    title: mode === 'experienced' ? 'Motivations & boundaries' : 'What you want next',
    shortTitle: 'Goals',
  }
  const workStyle: WizardStepDef = { id: 'work-style', title: 'Work style & logistics', shortTitle: 'Work' }

  if (mode === 'early') {
    const steps: WizardStepDef[] = [
      basics,
      targets,
      { id: 'education', title: 'Education & learning', shortTitle: 'Education' },
    ]
    if (draft.paidWorkExperience === 'internship_only') {
      steps.push({ id: 'work-history', title: 'Internships & short roles', shortTitle: 'Internships' })
    }
    steps.push(
      { id: 'resume-upload', title: 'Upload resume (optional)', shortTitle: 'Resume' },
      skills,
      projects,
      stories,
      goals,
      workStyle,
    )
    return steps
  }

  if (mode === 'transitional') {
    return [
      basics,
      targets,
      { id: 'experience', title: 'What you have done so far', shortTitle: 'Experience' },
      { id: 'resume-upload', title: 'Upload your current resume (optional)', shortTitle: 'Resume' },
      skills,
      projects,
      stories,
      goals,
      workStyle,
    ]
  }

  return [
    basics,
    targets,
    { id: 'experience', title: 'Career narrative', shortTitle: 'Experience' },
    { id: 'resume-upload', title: 'Upload your current resume', shortTitle: 'Resume' },
    skills,
    projects,
    stories,
    goals,
    workStyle,
  ]
}

export function isEarlyBasics(draft: ApplicantProfileDraft): boolean {
  return deriveProfileMode(draft) === 'early'
}

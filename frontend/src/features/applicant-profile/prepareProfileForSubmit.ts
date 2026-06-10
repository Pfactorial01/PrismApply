import type { ApplicantProfileDraft, ProjectEntry } from './types'
import { deriveProfileMode, deriveResumeLayout, getFeaturedProject } from './profileMode'
import { TOOL_SLUGS } from './fieldOptions'

function toolLabel(slug: string): string {
  const match = TOOL_SLUGS.find(([s]) => s === slug)
  return match?.[1] ?? slug
}

function deriveSkillsNarrative(draft: ApplicantProfileDraft): string {
  if (draft.skillsCoreNarrative.trim()) return draft.skillsCoreNarrative.trim()
  const labels = draft.selectedToolSlugs.map(toolLabel).filter(Boolean)
  if (labels.length === 0 && !draft.toolsOtherNote.trim()) return ''
  const parts = labels.length > 0 ? `Core stack: ${labels.join(', ')}.` : ''
  if (draft.toolsOtherNote.trim()) {
    return [parts, draft.toolsOtherNote.trim()].filter(Boolean).join(' ')
  }
  return parts
}

function deriveCareerNarrative(draft: ApplicantProfileDraft): string {
  if (draft.honestCareerNarrative.trim()) return draft.honestCareerNarrative.trim()
  const roles = draft.workEntries
    .filter((e) => e.company.trim() && e.role.trim())
    .map((e) => `${e.role} at ${e.company}`)
  if (roles.length === 0) return draft.headline.trim()
  return `Experience includes ${roles.join('; ')}.`
}

function reorderFeaturedProject(projects: ProjectEntry[], featuredId: string): ProjectEntry[] {
  if (!featuredId) return projects
  const featured = projects.find((p) => p.id === featuredId)
  if (!featured) return projects
  return [featured, ...projects.filter((p) => p.id !== featuredId)]
}

/** Enrich lean wizard data for backend matching, tailoring, and embed gating. */
export function prepareProfileForSubmit(
  draft: ApplicantProfileDraft,
  accountEmail: string,
): ApplicantProfileDraft {
  const featured = getFeaturedProject(draft)
  const featuredProjectId = featured?.id ?? draft.featuredProjectId

  let paidWorkExperience = draft.paidWorkExperience
  if (!paidWorkExperience) {
    const years = draft.yearsExperience
    if (years === '3-5' || years === '5-8' || years === '8-12' || years === '12+') {
      paidWorkExperience = 'full_time'
    } else if (years === '0-1') {
      paidWorkExperience = 'none'
    } else if (years === '1-3') {
      paidWorkExperience = countWorkRoles(draft) > 0 ? 'full_time' : 'internship_only'
    }
  }

  let visaStatus = draft.visaStatus
  if (!visaStatus) {
    visaStatus = draft.needsVisaSponsorship ? 'need_sponsorship' : 'citizen_pr'
  }

  const motivationSlugs =
    draft.selectedMotivationSlugs.length > 0
      ? draft.selectedMotivationSlugs
      : ['mot_explore']

  const prepared: ApplicantProfileDraft = {
    ...draft,
    email: accountEmail || draft.email,
    featuredProjectId,
    paidWorkExperience,
    visaStatus,
    skillsCoreNarrative: deriveSkillsNarrative(draft),
    honestCareerNarrative: deriveCareerNarrative(draft),
    selectedMotivationSlugs: motivationSlugs,
    projects: reorderFeaturedProject(draft.projects, featuredProjectId),
    profileMode: deriveProfileMode({ ...draft, paidWorkExperience }),
    resumeLayout: deriveResumeLayout({ ...draft, paidWorkExperience }),
    profileSubmittedAt: draft.profileSubmittedAt.trim() || new Date().toISOString(),
  }

  return prepared
}

function countWorkRoles(draft: ApplicantProfileDraft): number {
  return draft.workEntries.filter((e) => e.company.trim() && e.role.trim()).length
}

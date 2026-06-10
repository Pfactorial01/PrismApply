import type { ApplicantProfileDraft } from './types'
import { newProjectEntry } from './types'

function pickParsedString(parsed: ApplicantProfileDraft, key: keyof ApplicantProfileDraft): string {
  const v = parsed[key]
  return typeof v === 'string' && v.trim() ? v : ''
}

/** Merge AI-parsed resume fields into an existing draft without clobbering user edits. */
export function mergeParsedProfile(
  draft: ApplicantProfileDraft,
  parsed: ApplicantProfileDraft,
  { overwriteEmpty = true }: { overwriteEmpty?: boolean } = {},
): ApplicantProfileDraft {
  const next = { ...draft }

  const stringFields: (keyof ApplicantProfileDraft)[] = [
    'fullName',
    'preferredName',
    'headline',
    'phoneNumber',
    'currentCompany',
    'cityOrDetail',
    'region',
    'stateOrProvince',
    'linkedInUrl',
    'githubUrl',
    'portfolioUrl',
    'yearsExperience',
    'seniorityTarget',
    'primaryDiscipline',
    'targetRolesNarrative',
    'honestCareerNarrative',
    'proudestProfessionalWins',
    'skillsCoreNarrative',
    'highestEducation',
    'educationDetails',
    'resumePlainText',
    'resumePdfUrl',
  ]

  for (const key of stringFields) {
    const parsedVal = pickParsedString(parsed, key)
    if (!parsedVal) continue
    const current = next[key]
    if (overwriteEmpty || typeof current !== 'string' || !current.trim()) {
      ;(next as Record<string, unknown>)[key] = parsedVal
    }
  }

  if (parsed.selectedToolSlugs.length > 0 && (overwriteEmpty || next.selectedToolSlugs.length === 0)) {
    next.selectedToolSlugs = parsed.selectedToolSlugs
  }

  const parsedWork = parsed.workEntries.filter((e) => e.company.trim() || e.role.trim())
  if (parsedWork.length > 0 && (overwriteEmpty || !next.workEntries.some((e) => e.company.trim()))) {
    next.workEntries = parsedWork
  }

  const parsedProjects = parsed.projects.filter((p) => p.title.trim() || p.summary.trim())
  if (parsedProjects.length > 0 && (overwriteEmpty || !next.projects.some((p) => p.title.trim()))) {
    next.projects = parsedProjects
    if (!next.featuredProjectId && parsedProjects[0]) {
      next.featuredProjectId = parsedProjects[0].id
    }
  }

  if (parsed.resumeAttachmentName) {
    next.resumeAttachmentName = parsed.resumeAttachmentName
  }

  if (next.projects.length === 0) {
    next.projects = [newProjectEntry()]
  }

  return next
}

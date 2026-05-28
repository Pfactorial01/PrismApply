import type { ApplicantProfileDraft, ProjectEntry, WorkEntry } from './types'
import { createEmptyProfileDraft, newProjectEntry, newWorkEntry } from './types'

const KNOWN_TIMEZONE_SLUGS = new Set([
  '',
  'americas_eastern',
  'americas_central',
  'americas_mountain',
  'americas_pacific',
  'eu_west',
  'eu_central',
  'uk_ire',
  'india',
  'apac_other',
  'utc',
  'other',
])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function normalizeWorkEntries(raw: unknown): WorkEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newWorkEntry()]
  return raw.map((item) => {
    if (!isRecord(item)) return newWorkEntry()
    return {
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      company: str(item.company),
      role: str(item.role),
      startDate: str(item.startDate),
      endDate: str(item.endDate),
      isCurrent: bool(item.isCurrent, false),
      employmentType: str(item.employmentType) || 'internship',
      summaryBullets: str(item.summaryBullets),
    }
  })
}

function normalizeProjects(raw: unknown): ProjectEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newProjectEntry()]
  return raw.map((item) => {
    if (!isRecord(item)) return newProjectEntry()
    const legacyTech = str(item.techStack)
    return {
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      kind: str(item.kind),
      title: str(item.title),
      summary: str(item.summary),
      primaryTechSlug: str(item.primaryTechSlug) || (legacyTech ? 'other' : ''),
      techStackExtra: str(item.techStackExtra) || legacyTech,
      impactMetrics: str(item.impactMetrics),
      link: str(item.link),
      shippedToUsers: bool(item.shippedToUsers, false),
    }
  })
}

/** Map keys from older draft shapes into the current model. */
function migrateLegacyFields(raw: Record<string, unknown>): Partial<ApplicantProfileDraft> {
  const m: Partial<ApplicantProfileDraft> = {}
  if (!str(raw.cityOrDetail) && str(raw.location)) m.cityOrDetail = str(raw.location)
  if (!str(raw.email) && str(raw.accountEmail)) m.email = str(raw.accountEmail)
  if (!str(raw.targetRolesNarrative) && str(raw.targetRoles)) m.targetRolesNarrative = str(raw.targetRoles)
  if (!str(raw.skillsCoreNarrative) && str(raw.skillsCore)) m.skillsCoreNarrative = str(raw.skillsCore)
  if (!str(raw.toolsOtherNote) && str(raw.toolsAndPlatforms)) m.toolsOtherNote = str(raw.toolsAndPlatforms)
  if (!str(raw.educationDetails) && str(raw.educationAndCerts)) m.educationDetails = str(raw.educationAndCerts)
  if (!str(raw.industryOtherNote) && str(raw.industriesOfInterest)) m.industryOtherNote = str(raw.industriesOfInterest)
  if (!str(raw.workArrangement) && str(raw.workStyleRemote)) {
    const w = str(raw.workStyleRemote).toLowerCase()
    if (w.includes('remote')) m.workArrangement = 'remote'
    else if (w.includes('hybrid')) m.workArrangement = 'hybrid'
    else if (w.includes('onsite') || w.includes('on-site')) m.workArrangement = 'onsite'
    else if (w) m.workArrangement = 'flexible'
  }
  if (!str(raw.compensationExtraNote) && str(raw.compensationNotes)) m.compensationExtraNote = str(raw.compensationNotes)
  if (!str(raw.workAuthOtherNote) && str(raw.visaOrWorkAuthNotes)) m.workAuthOtherNote = str(raw.visaOrWorkAuthNotes)
  if (!str(raw.motivationsOtherNote) && str(raw.motivationsWhyMove)) m.motivationsOtherNote = str(raw.motivationsWhyMove)
  if (!str(raw.whatYouWantNextNote) && str(raw.whatYouWantInNextRole)) m.whatYouWantNextNote = str(raw.whatYouWantInNextRole)
  if (!str(raw.dealBreakersOtherNote) && str(raw.dealBreakers)) m.dealBreakersOtherNote = str(raw.dealBreakers)
  return m
}

/** Merge API / stored JSON into a full ApplicantProfileDraft (tolerates legacy keys). */
export function normalizeProfileDraftFromUnknown(raw: unknown): ApplicantProfileDraft {
  const empty = createEmptyProfileDraft()
  if (!isRecord(raw)) return empty

  const legacy = migrateLegacyFields(raw)
  const merged: ApplicantProfileDraft = {
    ...empty,
    ...(raw as Partial<ApplicantProfileDraft>),
    ...legacy,
    selectedIndustrySlugs: strArr(raw.selectedIndustrySlugs).length ? strArr(raw.selectedIndustrySlugs) : empty.selectedIndustrySlugs,
    selectedToolSlugs: strArr(raw.selectedToolSlugs).length ? strArr(raw.selectedToolSlugs) : empty.selectedToolSlugs,
    selectedRampAreaSlugs: strArr(raw.selectedRampAreaSlugs).length ? strArr(raw.selectedRampAreaSlugs) : empty.selectedRampAreaSlugs,
    selectedMotivationSlugs: strArr(raw.selectedMotivationSlugs).length ? strArr(raw.selectedMotivationSlugs) : empty.selectedMotivationSlugs,
    selectedNextRoleDesireSlugs: strArr(raw.selectedNextRoleDesireSlugs).length
      ? strArr(raw.selectedNextRoleDesireSlugs)
      : empty.selectedNextRoleDesireSlugs,
    selectedDealbreakerSlugs: strArr(raw.selectedDealbreakerSlugs).length ? strArr(raw.selectedDealbreakerSlugs) : empty.selectedDealbreakerSlugs,
    openToEquity: bool(raw.openToEquity, empty.openToEquity),
    openToContract: bool(raw.openToContract, empty.openToContract),
    openToRelocate: bool(raw.openToRelocate, empty.openToRelocate),
    needsVisaSponsorship: bool(raw.needsVisaSponsorship, empty.needsVisaSponsorship),
    comfortableSharingFailureStories: bool(raw.comfortableSharingFailureStories, empty.comfortableSharingFailureStories),
    resumePdfUrl: str(raw.resumePdfUrl),
    projects: normalizeProjects(raw.projects),
    workEntries: normalizeWorkEntries(raw.workEntries),
    paidWorkExperience: (str(raw.paidWorkExperience) || '') as ApplicantProfileDraft['paidWorkExperience'],
    currentStatus: str(raw.currentStatus),
    schoolName: str(raw.schoolName),
    expectedGraduation: str(raw.expectedGraduation),
    courseworkNote: str(raw.courseworkNote),
    profileMode: (str(raw.profileMode) || '') as ApplicantProfileDraft['profileMode'],
    resumeLayout: (str(raw.resumeLayout) || '') as ApplicantProfileDraft['resumeLayout'],
  }

  if (merged.timezone && !KNOWN_TIMEZONE_SLUGS.has(merged.timezone)) {
    merged.timezoneOtherNote = merged.timezoneOtherNote || merged.timezone
    merged.timezone = 'other'
  }

  if (!merged.paidWorkExperience) {
    const years = merged.yearsExperience
    if (years === '3-5' || years === '5-8' || years === '8-12' || years === '12+') {
      merged.paidWorkExperience = 'full_time'
    } else if (years === '0-1') {
      merged.paidWorkExperience = 'none'
    } else if (years === '1-3') {
      merged.paidWorkExperience = merged.honestCareerNarrative.trim() ? 'full_time' : 'internship_only'
    }
  }

  if (merged.workEntries.length === 0) {
    merged.workEntries = [newWorkEntry()]
  }
  if (merged.projects.length < 2 && (merged.paidWorkExperience === 'none' || merged.paidWorkExperience === 'internship_only')) {
    while (merged.projects.length < 2) {
      merged.projects.push(newProjectEntry())
    }
  }

  return merged
}

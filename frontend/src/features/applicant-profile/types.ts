export type PaidWorkExperience = 'none' | 'internship_only' | 'full_time' | ''
export type ProfileMode = 'early' | 'transitional' | 'experienced'
export type ResumeLayout = 'project_only' | 'hybrid' | 'employment_led' | ''

export type WorkEntry = {
  id: string
  company: string
  role: string
  startDate: string
  endDate: string
  isCurrent: boolean
  employmentType: string
  summaryBullets: string
}

export type ProjectEntry = {
  id: string
  kind: string
  title: string
  summary: string
  primaryTechSlug: string
  techStackExtra: string
  impactMetrics: string
  link: string
  shippedToUsers: boolean
}

export type ApplicantProfileDraft = {
  fullName: string
  email: string
  phoneNumber: string
  preferredName: string
  headline: string
  currentCompany: string
  currentStatus: string
  region: string
  stateOrProvince: string
  country: string
  cityOrDetail: string
  timezone: string
  timezoneOtherNote: string
  englishProficiency: string
  linkedInUrl: string
  portfolioUrl: string
  githubUrl: string
  otherLinks: string

  yearsExperience: string
  seniorityTarget: string
  paidWorkExperience: PaidWorkExperience
  primaryDiscipline: string
  disciplineOtherNote: string
  targetRolesNarrative: string
  selectedIndustrySlugs: string[]
  industryOtherNote: string
  companiesYouAdmire: string

  honestCareerNarrative: string
  proudestProfessionalWins: string
  gapsOrNonTraditionalPath: string

  resumePlainText: string
  resumeAttachmentName: string | null

  skillsCoreNarrative: string
  selectedRampAreaSlugs: string[]
  selectedToolSlugs: string[]
  toolsOtherNote: string
  /** Years of experience per stack slug for application forms (go, react, node, python, python_data, aws, …) */
  stackYears: Record<string, string>
  highestEducation: string
  educationDetails: string
  schoolName: string
  expectedGraduation: string
  courseworkNote: string

  workEntries: WorkEntry[]

  projects: ProjectEntry[]

  profileMode: ProfileMode | ''
  resumeLayout: ResumeLayout | ''

  storyHardestTechnicalChallenge: string
  storyDisagreementOrConflict: string
  storyBiggestMistake: string
  storyLeadingWithoutAuthority: string
  storyTightDeadline: string
  storyConflictingPriorities: string
  storyProcessImprovement: string
  storyDifficultFeedback: string
  storyMentoringTeaching: string
  storyCrossFunctionalCollaboration: string
  storyAmbiguousProblem: string
  storyEthicalOrRiskTradeoff: string

  selectedMotivationSlugs: string[]
  motivationsOtherNote: string
  selectedNextRoleDesireSlugs: string[]
  whatYouWantNextNote: string
  selectedDealbreakerSlugs: string[]
  dealBreakersOtherNote: string

  workArrangement: string
  teamSizePreference: string
  compensationBand: string
  compensationExtraNote: string
  openToEquity: boolean
  openToContract: boolean
  openToRelocate: boolean
  authorizedCountries: string[]
  startAvailability: string
  featuredProjectId: string
  visaStatus: string
  needsVisaSponsorship: boolean
  workAuthOtherNote: string
  workAuthorizedInUS: boolean
  workAuthorizedInCanada: boolean

  /** Optional behavioral meta */
  comfortableSharingFailureStories: boolean

  /** R2 public URL for uploaded resume PDF */
  resumePdfUrl: string

  /** ISO timestamp set on first Save profile submit */
  profileSubmittedAt: string
}

export function newWorkEntry(): WorkEntry {
  return {
    id: crypto.randomUUID(),
    company: '',
    role: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    employmentType: 'full_time',
    summaryBullets: '',
  }
}

export function newProjectEntry(): ProjectEntry {
  return {
    id: crypto.randomUUID(),
    kind: '',
    title: '',
    summary: '',
    primaryTechSlug: '',
    techStackExtra: '',
    impactMetrics: '',
    link: '',
    shippedToUsers: false,
  }
}

export function createEmptyProfileDraft(): ApplicantProfileDraft {
  return {
    fullName: '',
    email: '',
    phoneNumber: '',
    preferredName: '',
    headline: '',
    currentCompany: '',
    currentStatus: '',
    region: '',
    stateOrProvince: '',
    country: '',
    cityOrDetail: '',
    timezone: '',
    timezoneOtherNote: '',
    englishProficiency: '',
    linkedInUrl: '',
    portfolioUrl: '',
    githubUrl: '',
    otherLinks: '',

    yearsExperience: '',
    seniorityTarget: '',
    paidWorkExperience: '',
    primaryDiscipline: '',
    disciplineOtherNote: '',
    targetRolesNarrative: '',
    selectedIndustrySlugs: [],
    industryOtherNote: '',
    companiesYouAdmire: '',

    honestCareerNarrative: '',
    proudestProfessionalWins: '',
    gapsOrNonTraditionalPath: '',

    resumePlainText: '',
    resumeAttachmentName: null,

    skillsCoreNarrative: '',
    selectedRampAreaSlugs: [],
    selectedToolSlugs: [],
    toolsOtherNote: '',
    stackYears: {},
    highestEducation: '',
    educationDetails: '',
    schoolName: '',
    expectedGraduation: '',
    courseworkNote: '',

    workEntries: [newWorkEntry()],

    projects: [newProjectEntry(), newProjectEntry()],

    profileMode: '',
    resumeLayout: '',

    storyHardestTechnicalChallenge: '',
    storyDisagreementOrConflict: '',
    storyBiggestMistake: '',
    storyLeadingWithoutAuthority: '',
    storyTightDeadline: '',
    storyConflictingPriorities: '',
    storyProcessImprovement: '',
    storyDifficultFeedback: '',
    storyMentoringTeaching: '',
    storyCrossFunctionalCollaboration: '',
    storyAmbiguousProblem: '',
    storyEthicalOrRiskTradeoff: '',

    selectedMotivationSlugs: [],
    motivationsOtherNote: '',
    selectedNextRoleDesireSlugs: [],
    whatYouWantNextNote: '',
    selectedDealbreakerSlugs: [],
    dealBreakersOtherNote: '',

    workArrangement: '',
    teamSizePreference: '',
    compensationBand: '',
    compensationExtraNote: '',
    openToEquity: false,
    openToContract: false,
    openToRelocate: false,
    authorizedCountries: [],
    startAvailability: '',
    featuredProjectId: '',
    visaStatus: '',
    needsVisaSponsorship: false,
    workAuthOtherNote: '',
    workAuthorizedInUS: false,
    workAuthorizedInCanada: false,

    comfortableSharingFailureStories: true,
    resumePdfUrl: '',
    profileSubmittedAt: '',
  }
}

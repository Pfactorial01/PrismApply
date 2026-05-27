import type { ApplicantProfileDraft, ProjectEntry } from './types'
import { createEmptyProfileDraft } from './types'

const projectVibeFlow: ProjectEntry = {
  id: 'a0000001-0000-4000-8000-000000000001',
  kind: 'side',
  title: 'VibeFlow',
  summary:
    'A monorepo short-form video platform featuring an Express backend and a high-performance video playback engine. Architected and deployed with Mux for seamless video delivery.',
  primaryTechSlug: 'typescript',
  techStackExtra: 'Prisma, PostgreSQL, Redis, Mux API.',
  impactMetrics: 'Launched MVP with end-to-end video upload, processing, and playback.',
  link: '',
  shippedToUsers: true,
}

const projectPropertyApi: ProjectEntry = {
  id: 'a0000002-0000-4000-8000-000000000002',
  kind: 'freelance',
  title: 'Property Data API',
  summary:
    'A real estate data extraction and normalization system that ingests and enriches property records across multiple U.S. counties.',
  primaryTechSlug: 'mixed',
  techStackExtra: 'Event-driven architecture, SitemapEnrichment services, address normalization logic (Go and Node.js).',
  impactMetrics: 'High-scale ingestion with strict normalization across counties.',
  link: '',
  shippedToUsers: true,
}

/** Demo profile for local testing — same shape as `GET/PUT /api/profile` JSON. */
export function getSampleApplicantProfile(): ApplicantProfileDraft {
  return {
    ...createEmptyProfileDraft(),

    fullName: 'Adeoye Adebayo',
    email: 'adeoye@example.com',
    preferredName: 'Adeoye',
    headline: 'Senior Software Engineer | AI Orchestration, Scalable Backends & Full-Stack Systems',
    region: 'mea',
    cityOrDetail: 'Lagos, Nigeria',
    timezone: 'other',
    timezoneOtherNote: 'WAT (West Africa Time) / UTC+1',
    linkedInUrl: 'https://www.linkedin.com/in/adeoye-adebayo',
    portfolioUrl: 'https://example.com/portfolio',
    githubUrl: 'https://github.com/adeoyeadebayo',
    otherLinks: '',

    yearsExperience: '5-8',
    seniorityTarget: 'staff',
    primaryDiscipline: 'ml',
    disciplineOtherNote: 'Also delivers strong full-stack systems (TypeScript, Go, Node.js) alongside ML/AI work.',
    targetRolesNarrative:
      'AI Engineer, Senior Backend Engineer (Go/Node.js), or Lead Full-Stack Developer. I specialize in bridging the gap between cutting-edge AI layers and reliable production backbone infrastructure.',
    selectedIndustrySlugs: ['fintech', 'healthtech', 'b2b_saas', 'devtools', 'infra_cloud'],
    industryOtherNote: '',
    companiesYouAdmire:
      'Companies leading in LLM orchestration (e.g., LangChain, OpenAI) or high-performance infrastructure (e.g., Vercel, Supabase).',

    honestCareerNarrative:
      'I am a senior engineer who thrives at the intersection of high-performance backend architecture and agentic AI. My journey has evolved from building robust full-stack applications to specializing in LLM orchestration, RAG patterns, and event-driven systems. I have a track record of taking complex products—from real estate data normalization engines to short-form video platforms—from ideation to scale.',

    proudestProfessionalWins: `VibeFlow launch: Architected and deployed a monorepo short-form video platform using Express, Prisma, and Redis, integrating Mux for seamless video delivery.

Real estate data engine: Engineered a high-scale data extraction and normalization system for property records, managing complex services like SitemapEnrichment and cross-county data ingestion.

Medical association MVP: Designed and delivered a secure, end-to-end conference registration and check-in system for a major medical association.`,

    gapsOrNonTraditionalPath: '',
    comfortableSharingFailureStories: true,

    resumePlainText: `Adeoye Adebayo — Lagos, Nigeria (WAT / UTC+1)
Senior Software Engineer | AI orchestration, scalable backends, full-stack systems

SUMMARY
Senior engineer specializing in LLM orchestration, RAG, event-driven backends, and production-grade TypeScript/Go/Node.js systems.

SELECTED IMPACT
• VibeFlow: monorepo short-form video platform — Express, Prisma, Redis, Mux.
• Property data engine: cross-county ingestion, normalization, enrichment pipelines.
• Medical conference MVP: secure registration and check-in under a tight deadline.

STACK
TypeScript, Go, Node.js, Python, SQL | AWS, GCP, Docker | PostgreSQL, Redis, MongoDB, Pinecone, Prisma | React, Next.js
`,

    resumeAttachmentName: null,
  resumePdfUrl: '',

    skillsCoreNarrative:
      'Building agentic workflows and multi-step reasoning patterns; architecting event-first systems (KingsLanding-style architecture); deep proficiency in TypeScript, Go, and Node.js; implementing vector databases (Pinecone, ChromaDB) for RAG.',

    selectedRampAreaSlugs: ['ramp_rust', 'ramp_k8s', 'ramp_ml'],
    selectedToolSlugs: ['aws', 'gcp', 'docker', 'postgres', 'mongo', 'redis', 'react', 'node'],
    toolsOtherNote:
      'Languages and libs not in checklist: TypeScript, Go, Python, Prisma, Next.js, Pinecone, ChromaDB, Mux API, Ubuntu/Linux.',
    highestEducation: 'bachelors',
    educationDetails: 'Senior-level software engineering with a focus on full-stack systems and AI.',

    projects: [projectVibeFlow, projectPropertyApi],

    storyHardestTechnicalChallenge:
      'Optimizing data ingestion for high-volume real estate records while maintaining strict normalization standards, and researching state-of-the-art mitigations for GPU cold starts in serverless environments.',

    storyDisagreementOrConflict: '',
    storyBiggestMistake: '',
    storyLeadingWithoutAuthority: '',
    storyTightDeadline:
      'Delivered a fully functional MVP for a medical conference registration system within a fixed window, prioritizing secure check-in functionality and data integrity.',
    storyConflictingPriorities: '',
    storyProcessImprovement: '',
    storyDifficultFeedback: '',
    storyMentoringTeaching:
      'Actively engaged in providing career guidance and resume reviews for junior developers and students, helping them transition into professional engineering roles.',
    storyCrossFunctionalCollaboration: '',
    storyAmbiguousProblem: '',
    storyEthicalOrRiskTradeoff: '',

    selectedMotivationSlugs: ['mot_growth', 'mot_mission', 'mot_explore'],
    motivationsOtherNote: '',
    selectedNextRoleDesireSlugs: ['next_ic_depth', 'next_staff', 'next_product'],
    whatYouWantNextNote: '',
    selectedDealbreakerSlugs: [],
    dealBreakersOtherNote: '',

    workArrangement: 'flexible',
    teamSizePreference: 'medium',
    compensationBand: '80_120',
    compensationExtraNote: 'Negotiable based on seniority and equity.',
    openToEquity: true,
    openToContract: true,
    openToRelocate: true,
    visaStatus: 'need_sponsorship',
    needsVisaSponsorship: true,
    workAuthOtherNote:
      'Based in Nigeria. Will need visa sponsorship for roles outside Nigeria unless the role is remote-first and compliant with local hiring constraints.',
  }
}

/** JSON string of the sample profile (for inspection or external tools). */
export function getSampleApplicantProfileJSON(): string {
  return JSON.stringify(getSampleApplicantProfile(), null, 2)
}

/** Single-select option: value stored in draft; empty string = unset. */
export type SelectOption<T extends string = string> = { value: T; label: string }

export const YEARS_EXPERIENCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: '0-1', label: '0–1 years' },
  { value: '1-3', label: '1–3 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '5-8', label: '5–8 years' },
  { value: '8-12', label: '8–12 years' },
  { value: '12+', label: '12+ years' },
]

export const PAID_WORK_EXPERIENCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'none', label: 'No paid software work yet (school / projects only)' },
  { value: 'internship_only', label: 'Internships, co-ops, or short freelance only' },
  { value: 'full_time', label: 'At least one full-time software role' },
]

export const WORK_ENTRY_TYPE_OPTIONS: SelectOption[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'coop', label: 'Co-op' },
  { value: 'freelance', label: 'Freelance / contract' },
  { value: 'part_time', label: 'Part-time' },
]

export const SENIORITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'intern', label: 'Intern' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
  { value: 'lead', label: 'Tech lead' },
  { value: 'manager', label: 'Engineering manager' },
  { value: 'director', label: 'Director+' },
]

export const DISCIPLINE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'backend', label: 'Backend / services' },
  { value: 'frontend', label: 'Frontend / web UI' },
  { value: 'fullstack', label: 'Full-stack' },
  { value: 'devops', label: 'DevOps / SRE / platform' },
  { value: 'data', label: 'Data engineering / analytics' },
  { value: 'ml', label: 'ML / AI engineering' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'security', label: 'Security' },
  { value: 'embedded', label: 'Embedded / firmware' },
  { value: 'qa', label: 'QA / test automation' },
  { value: 'product_eng', label: 'Product-minded IC (mixed)' },
  { value: 'other', label: 'Other (specify below)' },
]

export const REGION_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'eu_uk', label: 'Europe / UK' },
  { value: 'latam', label: 'Latin America' },
  { value: 'apac', label: 'Asia–Pacific' },
  { value: 'mea', label: 'Middle East / Africa' },
  { value: 'remote_first', label: 'Fully distributed (no fixed country)' },
  { value: 'other', label: 'Other' },
]

export const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'americas_eastern', label: 'Americas — Eastern' },
  { value: 'americas_central', label: 'Americas — Central' },
  { value: 'americas_mountain', label: 'Americas — Mountain' },
  { value: 'americas_pacific', label: 'Americas — Pacific' },
  { value: 'eu_west', label: 'Europe — Western' },
  { value: 'eu_central', label: 'Europe — Central' },
  { value: 'uk_ire', label: 'UK & Ireland' },
  { value: 'india', label: 'India' },
  { value: 'apac_other', label: 'Asia–Pacific (other)' },
  { value: 'utc', label: 'UTC / GMT' },
  { value: 'other', label: 'Other (IANA in notes)' },
]

export const WORK_ARRANGEMENT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'remote', label: 'Remote-first' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Mostly onsite' },
  { value: 'flexible', label: 'Flexible / negotiable' },
]

export const TEAM_SIZE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'small', label: 'Small (roughly 2–15 engineers)' },
  { value: 'medium', label: 'Medium (roughly 15–60)' },
  { value: 'large', label: 'Large (60+)' },
  { value: 'any', label: 'No strong preference' },
]

export const COMPENSATION_BAND_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'prefer_not_say', label: 'Prefer not to say' },
  { value: 'under_80', label: 'Under ~$80k USD equivalent' },
  { value: '80_120', label: '~$80k–120k' },
  { value: '120_160', label: '~$120k–160k' },
  { value: '160_200', label: '~$160k–200k' },
  { value: '200_260', label: '~$200k–260k' },
  { value: '260_plus', label: '~$260k+' },
]

export const VISA_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'citizen_pr', label: 'Citizen or permanent resident (work country)' },
  { value: 'visa_independent', label: 'Work visa — no sponsorship needed for new role' },
  { value: 'need_sponsorship', label: 'Will need visa sponsorship' },
  { value: 'student_opt', label: 'Student / OPT / similar' },
  { value: 'other', label: 'Other (use notes)' },
]

export const EDUCATION_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'high_school', label: 'High school' },
  { value: 'associate', label: 'Associate degree' },
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'masters', label: "Master's" },
  { value: 'doctorate', label: 'Doctorate' },
  { value: 'bootcamp', label: 'Bootcamp / intensive program' },
  { value: 'self_taught', label: 'Primarily self-taught' },
  { value: 'other', label: 'Other' },
]

export const PROJECT_KIND_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'side', label: 'Side project' },
  { value: 'open_source', label: 'Open source' },
  { value: 'bootcamp', label: 'Bootcamp / course capstone' },
  { value: 'work_sample', label: 'Work sample (permission to share)' },
  { value: 'freelance', label: 'Freelance / contract' },
  { value: 'other', label: 'Other' },
]

export const PROJECT_PRIMARY_TECH_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'typescript', label: 'TypeScript / JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java / JVM' },
  { value: 'csharp', label: 'C# / .NET' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift_kotlin', label: 'Swift / Kotlin (mobile)' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'data_sql', label: 'SQL / analytics stack' },
  { value: 'mixed', label: 'Mixed / polyglot' },
  { value: 'other', label: 'Other' },
]

/** Multi-select: slug → label */
export const INDUSTRY_SLUGS = [
  ['fintech', 'FinTech'],
  ['healthtech', 'HealthTech / biotech'],
  ['b2b_saas', 'B2B SaaS'],
  ['consumer', 'Consumer tech'],
  ['devtools', 'Developer tools'],
  ['infra_cloud', 'Infra / cloud'],
  ['climate', 'Climate / sustainability'],
  ['gov', 'Gov / defense-adjacent'],
  ['edtech', 'EdTech'],
  ['gaming', 'Gaming'],
  ['crypto', 'Crypto / web3'],
  ['other', 'Other (describe in notes)'],
] as const

export const TOOL_SLUGS = [
  ['aws', 'AWS'],
  ['gcp', 'GCP'],
  ['azure', 'Azure'],
  ['k8s', 'Kubernetes'],
  ['docker', 'Docker'],
  ['terraform', 'Terraform'],
  ['postgres', 'PostgreSQL'],
  ['mysql', 'MySQL'],
  ['mongo', 'MongoDB'],
  ['redis', 'Redis'],
  ['kafka', 'Kafka'],
  ['spark', 'Spark'],
  ['react', 'React'],
  ['node', 'Node.js'],
  ['graphql', 'GraphQL'],
  ['datadog', 'Datadog / observability'],
  ['github_actions', 'GitHub Actions / CI'],
  ['other_tools', 'Other (notes)'],
] as const

export const RAMP_AREA_SLUGS = [
  ['ramp_go', 'Go'],
  ['ramp_rust', 'Rust'],
  ['ramp_k8s', 'Kubernetes'],
  ['ramp_ml', 'ML / LLM apps'],
  ['ramp_mobile', 'Mobile native'],
  ['ramp_security', 'Security'],
  ['ramp_data', 'Data eng / analytics'],
  ['ramp_front', 'Advanced frontend'],
  ['ramp_other', 'Other'],
] as const

export const MOTIVATION_SLUGS = [
  ['mot_growth', 'More scope / growth'],
  ['mot_comp', 'Compensation'],
  ['mot_manager', 'Better leadership / culture'],
  ['mot_layoff', 'Layoff / role eliminated'],
  ['mot_contract', 'Contract ending'],
  ['mot_relocate', 'Relocation'],
  ['mot_mission', 'Mission alignment'],
  ['mot_explore', 'Exploring options'],
  ['mot_other', 'Other'],
] as const

export const EARLY_MOTIVATION_SLUGS = [
  ['mot_first_job', 'First full-time role'],
  ['mot_internship', 'Internship or co-op'],
  ['mot_learn', 'Learn on the job'],
  ['mot_mission', 'Mission alignment'],
  ['mot_growth', 'Growth and mentorship'],
  ['mot_explore', 'Exploring options'],
  ['mot_other', 'Other'],
] as const

export const NEXT_ROLE_SLUGS = [
  ['next_ic_depth', 'Deeper IC technical work'],
  ['next_staff', 'Staff / principal track'],
  ['next_em', 'People management'],
  ['next_startup', 'Startup / early stage'],
  ['next_scale', 'Larger org / scale'],
  ['next_product', 'Closer to product & users'],
  ['next_greenfield', 'Greenfield / 0→1'],
  ['next_other', 'Other'],
] as const

export const DEALBREAKER_SLUGS = [
  ['db_no_defense', 'No defense sector'],
  ['db_no_gambling', 'No gambling'],
  ['db_no_crypto', 'No crypto-first products'],
  ['db_no_oncall', 'No heavy on-call'],
  ['db_no_ads', 'No surveillance / ads-only business'],
  ['db_other', 'Other (notes)'],
] as const

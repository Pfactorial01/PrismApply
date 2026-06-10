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
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'coop', label: 'Co-op' },
  { value: 'freelance', label: 'Freelance / contract' },
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

/** Work authorization — countries where the applicant can legally work. */
export const AUTHORIZED_COUNTRY_OPTIONS: readonly (readonly [string, string])[] = [
  ['us', 'United States'],
  ['ca', 'Canada'],
  ['uk', 'United Kingdom'],
  ['eu', 'European Union / Schengen'],
  ['au', 'Australia'],
  ['nz', 'New Zealand'],
  ['in', 'India'],
  ['sg', 'Singapore'],
  ['jp', 'Japan'],
  ['mx', 'Mexico'],
  ['br', 'Brazil'],
  ['ng', 'Nigeria'],
  ['other', 'Other (see notes)'],
] as const

/** US / Canada — forms ask sponsorship separately from other countries. */
export const MAJOR_MARKET_AUTH_OPTIONS: SelectOption[] = [
  { value: '', label: 'Not seeking roles here' },
  { value: 'yes', label: 'Authorized — no sponsorship needed' },
  { value: 'needs_sponsorship', label: 'Would need visa sponsorship' },
]

export const OTHER_AUTHORIZED_COUNTRY_OPTIONS = AUTHORIZED_COUNTRY_OPTIONS.filter(
  ([slug]) => slug !== 'us' && slug !== 'ca',
)

export const ENGLISH_PROFICIENCY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'native', label: 'Native / bilingual English' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'professional', label: 'Professional working' },
  { value: 'conversational', label: 'Conversational' },
]

/** Stored in profile.stackYears — used to pre-fill job application forms. */
export const STACK_YEARS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'none', label: 'No experience' },
  { value: 'less_than_2', label: 'Less than 2 years' },
  { value: '1_2', label: '1–2 years' },
  { value: '2_4', label: '2–4 years' },
  { value: '3_plus', label: '3+ years' },
]

export const STACK_YEAR_FIELD_DEFS: readonly { key: string; label: string; toolSlugs?: string[] }[] = [
  { key: 'react', label: 'React', toolSlugs: ['react'] },
  { key: 'node', label: 'Node.js', toolSlugs: ['node'] },
  { key: 'python', label: 'Python' },
  { key: 'python_data', label: 'Python (data: NumPy, pandas, etc.)' },
  { key: 'go', label: 'Go' },
  { key: 'aws', label: 'AWS', toolSlugs: ['aws'] },
  { key: 'distributed_systems', label: 'Distributed / enterprise systems' },
]

export const US_STATE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select state' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

export const CA_PROVINCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select province / territory' },
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

export const START_AVAILABILITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select an option' },
  { value: 'immediately', label: 'Immediately' },
  { value: '2_weeks', label: 'Within 2 weeks' },
  { value: '1_month', label: 'Within 1 month' },
  { value: '2_3_months', label: '2–3 months' },
  { value: 'not_sure', label: 'Not sure yet' },
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

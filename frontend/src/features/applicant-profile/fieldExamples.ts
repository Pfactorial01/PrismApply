import { type ExampleTier, seniorityToExampleTier } from './fieldExampleTier'

export type FieldExampleKey =
  | 'fullName'
  | 'phoneNumber'
  | 'preferredName'
  | 'headline'
  | 'currentStatus'
  | 'currentCompany'
  | 'cityOrDetail'
  | 'timezoneOtherNote'
  | 'linkedInUrl'
  | 'portfolioUrl'
  | 'githubUrl'
  | 'otherLinks'
  | 'disciplineOtherNote'
  | 'targetRolesNarrative'
  | 'industryOtherNote'
  | 'companiesYouAdmire'
  | 'honestCareerNarrative'
  | 'proudestProfessionalWins'
  | 'gapsOrNonTraditionalPath'
  | 'schoolName'
  | 'expectedGraduation'
  | 'educationDetails'
  | 'courseworkNote'
  | 'workCompany'
  | 'workRole'
  | 'workStartDate'
  | 'workEndDate'
  | 'workSummaryBullets'
  | 'skillsCoreNarrative'
  | 'toolsOtherNote'
  | 'projectTitle'
  | 'projectSummary'
  | 'projectTechStackExtra'
  | 'projectImpactMetrics'
  | 'projectLink'
  | 'storyHardestTechnicalChallenge'
  | 'storyDisagreementOrConflict'
  | 'storyBiggestMistake'
  | 'storyLeadingWithoutAuthority'
  | 'storyTightDeadline'
  | 'storyConflictingPriorities'
  | 'storyProcessImprovement'
  | 'storyDifficultFeedback'
  | 'storyMentoringTeaching'
  | 'storyCrossFunctionalCollaboration'
  | 'storyAmbiguousProblem'
  | 'storyEthicalOrRiskTradeoff'
  | 'motivationsOtherNote'
  | 'whatYouWantNextNote'
  | 'dealBreakersOtherNote'
  | 'compensationExtraNote'
  | 'workAuthOtherNote'

export type FieldExample = {
  question: string
  answer: string
}

const EXAMPLES: Record<ExampleTier, Partial<Record<FieldExampleKey, FieldExample>>> = {
  junior: {
    headline: {
      question: 'One-line professional headline',
      answer:
        'CS new grad · backend & APIs · Go, PostgreSQL, Docker · built production-style projects for ~200 campus users',
    },
    currentStatus: {
      question: 'Current status',
      answer:
        'Final-year B.S. Computer Science at Portland State University (graduating May 2026). Currently finishing capstone and interviewing for junior backend or full-stack roles. Open to remote US or hybrid in the Pacific Northwest.',
    },
    cityOrDetail: {
      question: 'City or locality',
      answer:
        'Portland, OR metro area. Willing to relocate within the US for the right team; prefer remote-first or hybrid with at most 2 days in office.',
    },
    targetRolesNarrative: {
      question: 'Role titles, scope, and nuance',
      answer:
        'Junior backend or full-stack engineer on a product team with real users — not a pure maintenance role on a legacy monolith. I want to own small features end-to-end (API, tests, basic observability) with regular code review from seniors. Comfortable with on-call shadowing but not primary pager for a large distributed system yet. Titles I am applying to: Junior Software Engineer, Associate Backend Engineer, New Grad Software Engineer.',
    },
    companiesYouAdmire: {
      question: 'Companies or products you admire',
      answer:
        'Stripe — API design, error messages, and docs that teach you how to think about the domain. Linear — small teams shipping polished product with strong engineering culture. Any B2B SaaS with clear mentorship, readable codebases, and a habit of writing design notes before big changes. I am less interested in ad-tech or crypto unless the product problem is genuinely interesting.',
    },
    honestCareerNarrative: {
      question: 'What you have done so far',
      answer:
        'I switched from biology to computer science in my sophomore year after taking an intro programming course and realizing I liked building systems more than lab work. Since then I have focused on backend coursework and hands-on projects rather than stacking unrelated internships.\n\nMy two main projects are a campus events API (used by ~200 students during orientation) and a personal budget tracker with Plaid sandbox integration. I also interned at a local digital agency where I maintained WordPress sites for clients and built a small Node.js service that validated lead-form submissions and posted alerts to Slack.\n\nI am looking for my first full-time role where I can learn production practices — testing, deploy pipelines, incident response — from patient senior engineers on a team that ships regularly.',
    },
    schoolName: {
      question: 'School or program',
      answer: 'Portland State University — B.S. Computer Science (College of Engineering)',
    },
    expectedGraduation: {
      question: 'Graduation (expected or completed)',
      answer: 'May 2026 (expected)',
    },
    educationDetails: {
      question: 'Education details',
      answer:
        'B.S. Computer Science, GPA 3.6/4.0. Dean\'s list three semesters. Relevant coursework: Data Structures, Algorithms, Operating Systems, Databases, Computer Networks, Distributed Systems (in progress). AWS Cloud Practitioner certification (2025). Member of PSU ACM student chapter — helped organize two backend workshops.',
    },
    courseworkNote: {
      question: 'Relevant coursework',
      answer:
        'Databases (CS 410) — Designed a normalized schema for a library system, wrote migrations, and built a query layer in Go with integration tests against PostgreSQL.\n\nOperating Systems (CS 350) — Implemented a Unix-style shell and a simple memory allocator in C; learned about processes, syscalls, and debugging with gdb.\n\nWeb Development (CS 465) — Team capstone planning a student marketplace; I am responsible for auth and listing APIs.\n\nDistributed Systems (in progress) — Reading group on consensus and replication; first assignment was a key-value store with leader election.',
    },
    workCompany: {
      question: 'Company',
      answer: 'Cascade Digital Agency (Portland, OR — ~25 person marketing & web shop)',
    },
    workRole: {
      question: 'Role title',
      answer: 'Software Engineering Intern (reported to lead developer, 1 other intern on team)',
    },
    workStartDate: { question: 'Start (month/year)', answer: 'Jun 2025' },
    workEndDate: { question: 'End (month/year)', answer: 'Aug 2025' },
    workSummaryBullets: {
      question: 'What you did (factual bullets or notes)',
      answer:
        '- Built a Node.js webhook handler for client lead forms: schema validation with Zod, idempotent writes to PostgreSQL, and Slack alerts with retry on failure\n- Fixed WCAG AA accessibility issues on two client WordPress sites (contrast ratios, keyboard navigation, focus states) — passed client QA checklist\n- Wrote SQL reports in Metabase for weekly traffic and conversion summaries used in client standups\n- Paired with senior dev on deploy checklist; learned basic Docker Compose for local staging',
    },
    skillsCoreNarrative: {
      question: 'Core strengths in your own words',
      answer:
        'I am most comfortable building REST APIs in Go or Node, modeling relational data in PostgreSQL, and writing tests before refactors. I read docs and reproduce bugs locally before asking for help, and I take code review feedback seriously — I keep a notes doc of patterns seniors point out.\n\nFrom projects and coursework I have worked with Docker, GitHub Actions, basic AWS (S3, Lambda hello-world), and Fly.io deploys. I am still ramping on Kubernetes and advanced observability but understand logs, metrics, and request tracing at a junior level.',
    },
    projectTitle: { question: 'Project name', answer: 'Campus Events API' },
    projectSummary: {
      question: 'What you built and your role',
      answer:
        'Solo backend for a student club event calendar used during fall orientation. I owned everything on the server side: requirements with two club presidents, PostgreSQL schema (clubs, events, RSVPs, waitlists), Go HTTP API with auth for club admins, and deployment on Fly.io with GitHub Actions CI.\n\nA separate frontend team built a React UI; I documented OpenAPI specs and ran a weekly sync. Features include recurring events, capacity limits, and email reminders via a background worker (asynq + Redis).',
    },
    projectTechStackExtra: {
      question: 'Stack details',
      answer:
        'Go 1.22, chi router, PostgreSQL 15, sqlc for type-safe queries, golang-migrate, Redis + asynq for jobs, OpenAPI 3 spec, GitHub Actions (lint, test, deploy), Fly.io with health checks and staged deploys',
    },
    projectImpactMetrics: {
      question: 'Impact or proof',
      answer:
        '~200 unique students RSVP\'d during orientation week across 40 events. Load test with k6: p95 API latency under 120ms at 50 concurrent users. Zero data-loss incidents during the week; one hotfix for timezone display handled within 2 hours. GitHub repo linked in portfolio with README architecture diagram.',
    },
    projectLink: {
      question: 'Link',
      answer: 'https://github.com/yourname/campus-events-api (README includes API docs and architecture overview)',
    },
    storyHardestTechnicalChallenge: {
      question: 'Hardest technical challenge',
      answer:
        'During orientation week our events API intermittently dropped RSVPs when two students clicked at the same time. Support messages from club admins showed duplicate success toasts but missing rows in the database.\n\nI reproduced the race locally with two browser tabs and concurrent curl scripts, confirmed a read-then-write gap without transaction isolation, and fixed it with a unique constraint on (event_id, user_id) plus INSERT … ON CONFLICT DO UPDATE. I added an integration test that hammers 50 parallel requests and verified exactly one row per user.\n\nLesson learned: assume concurrency from day one on anything user-facing, not just after production traffic.',
    },
    proudestProfessionalWins: {
      question: 'Proudest win',
      answer:
        'Campus Events API during orientation: ~200 students RSVP\'d across 40 events in one week with zero data-loss incidents. I owned the backend solo — schema, Go API, deploy on Fly.io, and on-call during the week.\n\nWhen timezone display broke for two clubs, I shipped a hotfix within 2 hours after reproducing with their test accounts. Club presidents emailed thanks; that was the first time I felt like my code mattered to real users outside a grade.',
    },
    storyDisagreementOrConflict: {
      question: 'Conflict or disagreement',
      answer:
        'On a group database course project, one teammate wanted a single denormalized table to “move faster.” I was worried about update anomalies when we scaled test data.\n\nInstead of arguing in Slack, I proposed we each sketch a schema over one lunch, load 10k sample rows, and compare query plans and row counts for three report types the rubric required. My normalized design was slightly more joins but cleaner updates; we agreed on a hybrid — normalized core with one materialized view for the heaviest report.\n\nWe split migration scripts and I documented the decision in our README so the professor could follow our reasoning.',
    },
    storyBiggestMistake: {
      question: 'Something you would do differently next time',
      answer:
        'For a class project I hard-coded a Stripe test API key in source and pushed to a public GitHub repo. A classmate noticed within a day; nothing was exploited but it was a serious scare.\n\nI rotated the key immediately, force-pushed after moving secrets to .env (and adding .env to .gitignore), installed git-secrets locally, and wrote a one-page setup doc for teammates so no one else repeated it. Our TA used it as a cautionary example — embarrassing, but it changed how I treat config everywhere since.',
    },
    storyTightDeadline: {
      question: 'Shipping or learning under a tight deadline',
      answer:
        'Capstone demo was in five days and our OAuth integration with the university SSO was blocked on IT approval we could not control.\n\nI called a team meeting, proposed scoping auth down to email magic links for the demo only, and wrote a one-page test plan covering happy path, expired links, and rate limiting. I implemented the magic-link flow in two days; another teammate polished UI; we rehearsed the demo twice.\n\nWe shipped on time, clearly labeled OAuth as post-demo work, and got full SSO working two weeks later. The professor cared that we made a deliberate tradeoff and communicated it.',
    },
    motivationsOtherNote: {
      question: 'Motivation notes',
      answer:
        'I am graduating in May and want my first full-time role on a team that treats mentorship seriously — regular code review, not sink-or-swim. I am motivated by products with real users (even B2B) where I can see feedback loops, not by title chasing or grinding LeetCode indefinitely.',
    },
    whatYouWantNextNote: {
      question: 'Goals notes',
      answer:
        'In the next 12–18 months I want to become confident owning a small service in production: deploys, on-call shadowing, and writing runbooks. Longer term I am interested in backend/platform work, not management. Ideal team: writes design docs for non-trivial changes, has sane on-call load, and invests in intern/new-grad onboarding.',
    },
  },
  mid: {
    headline: {
      question: 'One-line professional headline',
      answer:
        'Mid-level backend engineer · billing & integrations · Python, AWS, event-driven systems · 4 yrs post-bootcamp',
    },
    currentCompany: {
      question: 'Current company',
      answer: 'Northwind Health (Series C healthtech, ~400 employees, patient billing & revenue cycle products)',
    },
    cityOrDetail: {
      question: 'City or locality',
      answer:
        'Chicago, IL (Hyde Park). Hybrid 2 days/week in office; open to fully remote for the right platform or payments team. Not interested in relocation that requires visa sponsorship changes.',
    },
    targetRolesNarrative: {
      question: 'Role titles, scope, and nuance',
      answer:
        'Mid-level backend or platform engineer with clear ownership of a service or domain — billing webhooks, integrations, internal developer tools, or async processing pipelines. I want IC track with technical design responsibility for my area, not people management.\n\nGood fit: team with on-call rotation but reasonable page load, product managers who accept written tradeoff docs, and a path toward senior IC in 2–3 years. Titles: Software Engineer II, Backend Engineer, Platform Engineer. Less interested in pure frontend or EM-track “tech lead” roles that are mostly meetings.',
    },
    companiesYouAdmire: {
      question: 'Companies or products you admire',
      answer:
        'Shopify — platform thinking and making hard commerce problems feel simple for app developers. Datadog — observability as a product and eng culture that talks openly about incidents. Companies that invest in internal developer experience (good staging envs, service templates, blameless postmortems) rather than heroics every release.\n\nI also respect teams that publish engineering blogs explaining real tradeoffs, not just recruiting fluff.',
    },
    honestCareerNarrative: {
      question: 'Your career story, as you would tell a peer',
      answer:
        'I started in customer support at a logistics SaaS company, which taught me how broken integrations feel to end users. I completed a full-time bootcamp in 2019, joined a small startup building inventory APIs for two years, then moved to Northwind Health as a junior backend engineer.\n\nOver four years at Northwind I grew into the primary owner of our patient billing integration service — webhooks from payment providers, idempotent processing, reconciliation with finance, and the on-call runbooks. I led the migration from a monolith endpoint to SQS + Lambda workers, cut failed payment retries by ~30%, and mentored one intern who returned full-time.\n\nBefore Northwind I learned fast iteration at a 15-person startup; at Northwind I learned compliance-adjacent rigor, staged rollouts, and how to push back on scope with data. I am now looking for either deeper platform ownership or a smaller company where I can have broader impact without losing production discipline.',
    },
    proudestProfessionalWins: {
      question: 'Proudest win',
      answer:
        '- Led migration of billing webhooks from synchronous monolith handlers to SQS + Lambda with dead-letter queues and replay tooling; duplicate charges reported to support dropped from ~12/month to zero over six months\n- Designed idempotency keys and a nightly reconciliation job processing ~40k provider events/day; finance sign-off on audit trail for SOC2 prep\n- Drove team postmortem culture after a config outage — added staged rollouts and feature flags; similar incidents did not recur in the following year\n- Mentored bootcamp intern through first production PR to solo feature in seven weeks; they converted to FTE',
    },
    skillsCoreNarrative: {
      question: 'Core strengths in your own words',
      answer:
        'My strengths are API design for integrations, async/event-driven processing, and production debugging with metrics and traces before grep-ing logs blindly. I write runbooks when I fix something twice, and I collaborate closely with product on scope — I would rather ship a narrow MVP with clear follow-ups than miss a compliance deadline.\n\nTechnically: Python (FastAPI, Celery), AWS (SQS, Lambda, RDS, S3), PostgreSQL, Datadog, Terraform for my team\'s infra. Comfortable reading Go services we depend on but not yet fluent writing production Go.',
    },
    projectTitle: { question: 'Project name', answer: 'retryable — open-source Python retry library' },
    projectSummary: {
      question: 'What you built and your role',
      answer:
        'Maintainer of a small open-source Python library for exponential backoff with jitter, used first internally at Northwind then published on GitHub. I handle issues, semver releases, changelog discipline, and documentation with runnable examples.\n\nStarted as an internal module duplicated across two teams; I extracted it, added type hints and pytest coverage, and wrote a short RFC for adoption. Now used in three services and ~400 GitHub stars with occasional external contributors.',
    },
    projectImpactMetrics: {
      question: 'Impact or proof',
      answer:
        'Adopted by two other teams at Northwind (billing + notifications). ~400 GitHub stars, featured in internal eng newsletter Q3 2024. Reduced duplicate retry implementations — estimated ~200 lines removed across repos. External users have opened issues that improved our edge-case handling for async contexts.',
    },
    storyHardestTechnicalChallenge: {
      question: 'Hardest technical challenge',
      answer:
        'During a payment provider outage we received duplicate and out-of-order webhook events for three days. Our monolith handler assumed at-most-once delivery; finance reported mismatched ledger totals and support saw duplicate charges.\n\nI designed a dedupe store keyed by provider event ID with TTL, moved processing to idempotent workers, and built lag dashboards plus a manual replay tool with finance approval workflow. We backfilled three days of events without double-charging customers — verified by reconciliation scripts run with finance in a shared war room.\n\nAfterward I wrote the runbook we still use for provider incidents and added integration tests that simulate duplicate delivery.',
    },
    storyDisagreementOrConflict: {
      question: 'Conflict or disagreement',
      answer:
        'Product wanted a hard cutover date for migrating billing webhooks before holiday freeze. I believed the new pipeline needed a shadow mode week comparing outputs side-by-side.\n\nI put together a short doc with risk scenarios (duplicate charges, missed events, rollback steps) and proposed shadow mode with automated diff alerts. PM initially pushed back on timeline; I offered to staff on-call myself during shadow week if we slipped.\n\nWe ran shadow mode, caught two edge cases in reconciliation, shipped on the original date with zero customer-visible regressions. PM thanked the team in retro for pushing back with data — that built trust for later negotiations.',
    },
    storyBiggestMistake: {
      question: 'A meaningful mistake or failure',
      answer:
        'I merged a feature-flag config change directly to production without a staged rollout during a quiet Friday. It pointed 100% of traffic at a new handler with an untested timeout — we had a 20-minute outage affecting webhook processing.\n\nI owned the rollback, stayed on the bridge until queues drained, and wrote the postmortem without deflecting. Follow-ups: canary deploy step in CI, mandatory staged rollout checklist for config changes, and I volunteered to run the next two releases to rebuild trust.\n\nPainful lesson: “small config change” is still a production change.',
    },
    storyLeadingWithoutAuthority: {
      question: 'Leading or influencing without formal authority',
      answer:
        'Two teams had copy-pasted retry logic with subtle differences — one used fixed backoff, one exponential — causing inconsistent behavior during provider incidents.\n\nI was not a tech lead, but I drafted a two-page RFC, built a shared library in a hack week, and paired with each team for one PR to adopt it. I ran a 30-minute lunch demo showing failure injection tests.\n\nBoth teams merged within a month; on-call noise from retry storms dropped. My manager cited this in my review as informal leadership — no title change, but clearer path to senior IC.',
    },
    storyTightDeadline: {
      question: 'Shipping under a tight deadline',
      answer:
        'Legal gave us six weeks to ship audit logging for billing admin actions before a customer contract renewal — specs were vague (“capture who did what”).\n\nI cut scope to append-only JSON logs in S3 with Athena queries for day-one compliance, documented known gaps (search UX, retention policies), and shipped in week five. Richer search UI and automated retention rules landed the next sprint after the contract was signed.\n\nKey was weekly legal/engineering sync so “compliant enough” was explicit, not assumed.',
    },
    storyConflictingPriorities: {
      question: 'Conflicting priorities from stakeholders',
      answer:
        'Support wanted emergency hotfixes during a platform team migration freeze; platform wanted zero schema changes until cutover weekend.\n\nI mapped open incidents to migration risk (data plane vs control plane), proposed a two-hour daily merge window with mandatory rollback tests, and staffed myself plus one senior for support escalations only.\n\nWe cleared the support backlog without rolling back the migration — four hotfixes merged in the window, zero Sev-2s. Documented the process for the next freeze.',
    },
    storyProcessImprovement: {
      question: 'A process or system you improved measurably',
      answer:
        'Our on-call rotation was burning people out — ~8 pages per engineer per week, many non-actionable threshold alerts.\n\nI worked with our SRE liaison to replace static thresholds with SLO-based alerts, added runbook links directly in PagerDuty, and started a 15-minute weekly triage to delete noisy alerts. I tracked pages per engineer in a simple spreadsheet for two quarters.\n\nPages dropped to ~3/week average; two teammates said they would stay on the team partly because on-call improved. Not glamorous, but high impact on retention.',
    },
    storyDifficultFeedback: {
      question: 'Receiving difficult or surprising feedback',
      answer:
        'My manager said my design docs were thorough but too long — senior reviewers were skimming and missing key decisions.\n\nInitially defensive, I asked for examples and switched to one-page decision records (context, options, decision, consequences) with links to appendices. I piloted on my next two projects and asked reviewers for explicit feedback.\n\nReview turnaround improved from ~5 days to ~2; senior engineers started citing my docs in their own RFCs. Feedback felt harsh at first but was accurate.',
    },
    storyMentoringTeaching: {
      question: 'Mentoring, teaching, or onboarding others',
      answer:
        'Northwind hired its first bootcamp grad onto our team; I was asked to onboard them without formal mentor training.\n\nI set up weekly pairing on billing domain concepts, a curated reading list (our runbooks, provider API docs, two internal postmortems), and shadowing on two incidents with debrief notes afterward. I delegated a small webhook handler with clear acceptance tests.\n\nThey shipped first solo feature in week seven and converted to FTE — they told me the incident shadowing mattered most because it demystified production.',
    },
    storyCrossFunctionalCollaboration: {
      question: 'Cross-functional work (PM, design, data…)',
      answer:
        'Data science built a churn model but engineering kept missing deadlines because event schemas did not match what analytics needed.\n\nI sat in three working sessions with DS and PM, defined the event schema and SLAs for backfill jobs, built the backfill pipeline in staging, and co-wrote the product spec section on “what eng will deliver by when.”\n\nModel shipped six weeks later with usable features in production — eng estimates matched reality because I translated DS requirements into concrete API contracts early.',
    },
    storyAmbiguousProblem: {
      question: 'A highly ambiguous problem',
      answer:
        'Leadership said “payments feel slow” with no metric, dashboard, or repro steps — support tickets were anecdotal.\n\nI instrumented end-to-end traces from checkout through webhook settlement, segmented by provider and payment method, and found a third-party SDK retrying aggressively on 429 responses. I proposed bounded timeouts plus async reconciliation for the long tail.\n\nLatency complaints in support dropped ~60% over a month; we published a dashboard leadership still uses in QBRs. Ambiguity broke once we measured.',
    },
    storyEthicalOrRiskTradeoff: {
      question: 'An ethical dilemma or risk tradeoff',
      answer:
        'Marketing asked to store full email bodies in our product analytics for funnel analysis — easier for campaigns, but full of PHI-adjacent content in a healthtech context.\n\nI pushed for hashed user IDs, event names only, and 30-day retention with legal review. I documented risk if we stored content (breach blast radius, compliance) vs what we would lose analytically (less copy-level A/B detail).\n\nLegal agreed; we still got funnel conversion data without storing email bodies we did not need. Marketing was annoyed initially but adapted creatives using subject-line tests instead.',
    },
    motivationsOtherNote: {
      question: 'Motivation notes',
      answer:
        'I have been at Northwind four years and want either deeper ownership of a platform area (integrations, event bus, developer tooling) or a smaller company where I can wear more hats without losing production discipline. Not running from my team — running toward scope and a clearer senior IC path.',
    },
    whatYouWantNextNote: {
      question: 'Goals notes',
      answer:
        'Next role: own a service or domain with meaningful on-call (but not heroic), lead technical design for my area, and mentor one junior engineer. In 3–5 years: senior IC who writes RFCs others adopt cross-team — not EM track. Care about sane deploy practices and written decision-making.',
    },
    compensationExtraNote: {
      question: 'Compensation context',
      answer:
        'Current base ~$128k + 15% bonus + RSUs (Chicago, mid-level band). Targeting ~$140–160k base for comparable scope, open to equity-heavy packages at growth-stage companies if liquid preference is clear. Not optimizing purely for cash — role scope and team matter.',
    },
  },
  senior: {
    headline: {
      question: 'One-line professional headline',
      answer:
        'Senior software engineer · distributed systems & billing platform · led ledger ingestion at ~2M events/day · 8 yrs fintech/healthtech',
    },
    currentCompany: {
      question: 'Current company',
      answer: 'Acme Payments (Series D fintech, global B2B payments, ~1,200 employees)',
    },
    targetRolesNarrative: {
      question: 'Role titles, scope, and nuance',
      answer:
        'Senior or staff IC on platform, infrastructure, or high-scale product backend — ledger ingestion, money movement, compliance-adjacent systems, or core developer platforms. I want architectural influence across teams, ownership of hard reliability problems, and mentorship of mid-level engineers — explicitly not EM track.\n\nGood fit: org that values written RFCs, blameless incident culture, and sustainable on-call. Staff-scope problems (multi-team dependencies, multi-quarter roadmaps) without becoming a people manager. Titles: Senior Software Engineer, Staff Engineer, Principal Engineer (IC).',
    },
    honestCareerNarrative: {
      question: 'Your career story, as you would tell a peer',
      answer:
        'Eight years across fintech and healthtech after a CS degree. I joined a Series B startup as engineer #8, built inventory and billing APIs, and learned to ship under uncertainty. After three years I moved to a larger healthtech company where I grew into tech lead for a platform-adjacent group and shipped their first SOC2-ready audit trail.\n\nAt Acme Payments for the last three years I tech-lead ledger ingestion — provider webhooks, normalization, idempotent writes, reconciliation with finance — processing ~2M events/day across US and EU. I re-architected from batch jobs to streaming, cut p99 lag from 45 minutes to under 3 minutes, and reduced incident MTTR ~40% through SLOs, runbooks, and blameless postmortems.\n\nI care about reliability, clear service boundaries, and developing mid-level engineers into owners. Looking for staff-scope IC problems with strong peers and a culture that rewards technical leadership without forcing management.',
    },
    proudestProfessionalWins: {
      question: 'Proudest win',
      answer:
        '- Re-architected ledger ingestion from nightly batch jobs to Kafka-based streaming with deterministic replay; p99 lag dropped from 45m to under 3m and finance close cycle shortened by two business days\n- Reduced incident MTTR ~40% org-wide on my domain through SLOs, runbook library, and blameless postmortems with tracked action items\n- Convinced three product squads to adopt shared idempotency standards — cut duplicate-processing incidents from ~6/quarter to 0 over 18 months\n- Hired and ramped three engineers; two promoted to mid-level under my mentorship and now lead their own services',
    },
    skillsCoreNarrative: {
      question: 'Core strengths in your own words',
      answer:
        'System design under business constraints, operational excellence at scale, and translating ambiguous executive asks into measurable technical roadmaps. Effective in 0→1 platform builds and in hardening systems that already have paying customers.\n\nTechnically deep in event-driven architectures, idempotency and reconciliation patterns, PostgreSQL at scale, Kafka, AWS, and observability (Datadog, custom SLO tooling). I write RFCs others actually read, run design reviews that surface risks early, and mentor by delegating real ownership — not ticket triage.',
    },
    storyLeadingWithoutAuthority: {
      question: 'Leading or influencing without formal authority',
      answer:
        'Three product squads each built incompatible idempotency handling — duplicate charges and support pain during provider incidents.\n\nI had no org chart authority over two of the teams. I built a reference library, wrote migration guides with effort estimates, ran office hours for six weeks, and paired with each team for one sprint to land their first PR.\n\nAdoption took two quarters but duplicate-processing incidents went to zero over the following 18 months. VP Eng cited this as a model for “horizontal leadership” in staff promo discussions.',
    },
    storyHardestTechnicalChallenge: {
      question: 'Hardest technical challenge',
      answer:
        'Acme\'s ledger ingestion could not handle provider reordering and at-least-once delivery at ~2M events/day — batch jobs created 45-minute lag and finance could not close books reliably.\n\nI led a multi-quarter re-architecture to streaming ingestion with event versioning, deterministic replay tooling, lag SLOs with error budgets, and finance-approved reconciliation windows. We migrated market-by-market with shadow comparison and rollback triggers.\n\np99 lag dropped under 3 minutes; finance close shortened by two business days. Hardest part was organizational — aligning legal, finance, and three eng teams on cutover criteria, not just the Kafka topology.',
    },
    storyDisagreementOrConflict: {
      question: 'Conflict or disagreement',
      answer:
        'VP Product wanted big-bang EU region expansion to hit a board milestone. I argued for Ireland-first with feature flags, synthetic load tests, and quota discovery before multi-country rollout.\n\nI wrote a risk doc with Sev-1 scenarios (provider limits, data residency gaps, on-call staffing) and proposed a phased plan with explicit go/no-go metrics. VP initially called it “too slow”; I offered to staff a tiger team if we could sequence markets.\n\nWe launched Ireland, hit quota limits early in staging (would have been production Sev-1), fixed them, then rolled EU over six weeks with zero Sev-1s. VP retroactively thanked me for “saving the launch.”',
    },
    storyBiggestMistake: {
      question: 'A meaningful mistake or failure',
      answer:
        'I shipped a feature flag default-on that routed 100% of read traffic through a new query path without load testing at production scale — database CPU doubled and we throttled API responses for ~35 minutes.\n\nI owned the rollback on the bridge, communicated timelines to support and leadership, and wrote a postmortem the org still references. Follow-ups: mandatory load tests in CI for flag paths above 10% traffic, default-off for new paths, and I personally reviewed flag rollouts for a quarter.\n\nCredibility recovered because I did not hide behind “the flag system” — I owned the decision to default on.',
    },
    storyTightDeadline: {
      question: 'Shipping under a tight deadline',
      answer:
        'Regulatory reporting deadline in eight weeks with evolving specs from legal — engineering could not wait for perfect requirements.\n\nI ran weekly legal/engineering/legal-ops triad reviews, shipped a minimal compliant CSV export to S3 with immutable audit logs in week six, and iterated on formatting and field coverage after the statutory deadline passed safely.\n\nWe never missed the filing date; extra fields landed in week ten without penalty because legal signed off on phased delivery upfront. Key was written acceptance criteria per week, not a big-bang spec.',
    },
    storyConflictingPriorities: {
      question: 'Conflicting priorities from stakeholders',
      answer:
        'Sales committed custom integrations to three enterprise prospects while infra leadership mandated 30% capacity for debt paydown after a rough quarter.\n\nI negotiated a visible quarterly capacity split (70% commitments / 30% debt), published a roadmap with named engineers per track, and created a single intake form so sales could not bypass prioritization.\n\nWe delivered two of three integrations on time, paid down the worst Kafka operational toil, and surprise escalations to my team dropped — sales learned the intake process because VP Eng backed it publicly.',
    },
    storyProcessImprovement: {
      question: 'A process or system you improved measurably',
      answer:
        'Design-related production incidents averaged ~4/quarter — teams shipped cross-service changes without lightweight review.\n\nI introduced one-page RFCs for changes touching >1 service, a weekly 45-minute design office hour staffed by senior ICs, and tracked incidents tagged “design gap” in postmortems.\n\nOver four quarters, design-related incidents fell to ~1/quarter; RFC template adopted org-wide by platform team. Process light enough that teams actually used it.',
    },
    storyDifficultFeedback: {
      question: 'Receiving difficult or surprising feedback',
      answer:
        'Staff peer review said I optimized for my squad’s velocity over org-wide standards — shipping shortcuts that other teams had to absorb.\n\nStung, but I asked for specific examples and saw the pattern: local feature flags, bespoke retry logic, undocumented API breaks.\n\nI started cross-team office hours, contributed to shared libraries instead of local forks, and measured adoption — cross-team PRs to our platform libs doubled in two quarters. Feedback was a turning point for staff-scope thinking.',
    },
    storyMentoringTeaching: {
      question: 'Mentoring, teaching, or onboarding others',
      answer:
        'Mentored two mid-level engineers toward promotion over ~18 months each: structured growth plans tied to business outcomes, delegated design reviews with written feedback, protected focus time by shielding them from random escalations.\n\nBoth now lead services independently — one owns EU ingestion expansion, one leads reconciliation tooling. I consider this a higher-leverage win than any single system I built because they multiply team capacity.',
    },
    storyCrossFunctionalCollaboration: {
      question: 'Cross-functional work (PM, design, data…)',
      answer:
        'Finance and legal needed a new billing disclosure flow for EU regulations; product wanted rapid iteration; eng had three services involved.\n\nI facilitated working sessions to translate compliance requirements into API contracts, error copy review with legal, and a phased rollout plan with feature flags per market. I wrote the integration test matrix legal signed off on.\n\nShipped once instead of three rework cycles — previous similar project took nine months of back-and-forth; this one took four with clearer cross-functional ownership.',
    },
    storyAmbiguousProblem: {
      question: 'A highly ambiguous problem',
      answer:
        'CTO asked to “reduce cloud spend” with no target, baseline, or timeline — just board pressure.\n\nI built a unit-cost dashboard per service (compute, Kafka, RDS per million events), identified idle staging environments and over-provisioned Kafka clusters, and presented options with tradeoffs (risk to latency vs savings).\n\nWe saved ~18% over two quarters with no customer-facing regressions because changes were tied to SLO error budgets. Ambiguity became a prioritized backlog with finance visibility.',
    },
    storyEthicalOrRiskTradeoff: {
      question: 'An ethical dilemma or risk tradeoff',
      answer:
        'Product proposed dark patterns on renewal flows — pre-checked upsell boxes and confusing cancel paths — projecting short-term retention lift.\n\nI documented churn vs trust tradeoffs with cohort data, proposed transparent renewal emails and a one-click cancel path, and escalated to leadership with legal in the room.\n\nLeadership chose the longer-term retention path after seeing EU regulatory risk and NPS impact models. Uncomfortable conversation, but the right outcome for customers and brand.',
    },
    motivationsOtherNote: {
      question: 'Motivation notes',
      answer:
        'I have been at Acme three years and want staff-scope IC problems — multi-team platform work, reliability at scale, compliance-adjacent systems — with peers who push me technically. Not interested in EM track; I get energy from architecture, incidents that teach the org, and mentoring engineers who will surpass me.',
    },
    whatYouWantNextNote: {
      question: 'Goals notes',
      answer:
        'Next 2–3 years: staff/principal IC with org-wide technical influence, sustainable on-call culture, and product with real scale or compliance constraints (fintech, health, infra). Want to write standards others adopt, not manage headcount. Open to smaller company if scope is genuinely staff-level.',
    },
    compensationExtraNote: {
      question: 'Compensation context',
      answer:
        'Currently ~$210k base + 20% bonus + RSUs (senior band, Bay Area remote). Targeting $230k+ base or equivalent total comp for staff-scope roles; willing to discuss equity refresh and signing bonus for the right platform mandate. Comp is negotiable if scope and team are strong.',
    },
  },
}

/** Shared examples (same across tiers) for simple factual fields. */
const SHARED: Partial<Record<FieldExampleKey, FieldExample>> = {
  fullName: {
    question: 'Full legal name',
    answer: 'Alex Jordan Chen',
  },
  phoneNumber: {
    question: 'Phone number',
    answer: '+1 (503) 555-0142 (mobile — OK for recruiter and scheduling texts)',
  },
  preferredName: {
    question: 'Preferred name',
    answer: 'Alex (please use in email salutations and calendar invites)',
  },
  linkedInUrl: {
    question: 'LinkedIn URL',
    answer: 'https://www.linkedin.com/in/alexjordan',
  },
  portfolioUrl: {
    question: 'Portfolio / personal site',
    answer: 'https://alexjordan.dev — project write-ups, architecture diagrams, and contact form',
  },
  githubUrl: {
    question: 'GitHub (or main code host)',
    answer: 'https://github.com/alexjordan — pinned repos include campus-events-api and retryable library',
  },
  otherLinks: {
    question: 'Other links worth citing',
    answer:
      'https://dev.to/alexjordan — occasional write-ups on API design and idempotency patterns\nhttps://speakerdeck.com/alexjordan — slides from a local meetup talk on webhook reliability (2024)',
  },
  disciplineOtherNote: {
    question: 'Describe discipline',
    answer:
      'Developer relations engineering — I build sample apps, maintain SDK quickstarts, and run feedback loops between external developers and product teams. Not pure marketing; I ship code daily and measure docs quality by time-to-first-successful-API-call.',
  },
  industryOtherNote: {
    question: 'Industry notes',
    answer:
      'Most interested in climate data infrastructure, public-sector digital services, and B2B tools with clear user impact. Prefer not defense-adjacent or gambling. Open to healthtech and fintech if compliance culture is serious, not checkbox-driven.',
  },
  gapsOrNonTraditionalPath: {
    question: 'Non-traditional path, gaps, or context',
    answer:
      'Career break Jan–Aug 2023 for family caregiving (parent illness). During that time I kept skills current: maintained an open-source retry library, completed one 10-week contract project for a nonprofit (Stripe billing integration), and did not hide the gap in interviews — I explain it plainly and point to continuous learning.',
  },
  timezoneOtherNote: {
    question: 'Timezone detail',
    answer:
      'America/Denver (Mountain Time — UTC−7 standard / UTC−6 DST). Core collaboration hours 9am–3pm MT; flexible for occasional early calls with EU teams.',
  },
  toolsOtherNote: {
    question: 'Tools / stack notes',
    answer:
      'Daily driver: Datadog (APM + SLOs), PagerDuty, Terraform, Confluent Kafka, GitHub Actions, PostgreSQL. Comfortable ramping on GCP if the team is AWS-leaning — I have done one GCP migration project. Not deeply experienced in Kubernetes operators but have run services on EKS with platform team support.',
  },
  dealBreakersOtherNote: {
    question: 'Deal-breaker notes',
    answer:
      'No mandatory weekend on-call rotations longer than one week per quarter. No “always available” Slack culture without comp or time-off tradeoffs. Need written engineering values that match behavior in incidents and perf reviews — not just wall posters.',
  },
  workAuthOtherNote: {
    question: 'Work authorization notes',
    answer:
      'US citizen — no sponsorship needed. Standard 2-week notice period with current employer; could negotiate 3–4 weeks for the right role if needed for handoff. No non-compete that blocks employment (verified with counsel).',
  },
}

export function getFieldExample(
  key: FieldExampleKey,
  seniorityTarget: string,
): FieldExample | null {
  const tier = seniorityToExampleTier(seniorityTarget)
  return EXAMPLES[tier][key] ?? EXAMPLES.junior[key] ?? SHARED[key] ?? null
}

export function getFieldExamplesForAllTiers(
  key: FieldExampleKey,
): Array<{ tier: ExampleTier; example: FieldExample }> {
  const tiers: ExampleTier[] = ['junior', 'mid', 'senior']
  const out: Array<{ tier: ExampleTier; example: FieldExample }> = []
  for (const tier of tiers) {
    const example = EXAMPLES[tier][key] ?? (tier === 'junior' ? SHARED[key] : undefined)
    if (example) out.push({ tier, example })
  }
  return out
}

export function hasFieldExample(key: FieldExampleKey): boolean {
  return getFieldExamplesForAllTiers(key).length > 0
}

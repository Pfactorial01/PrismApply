import { useEffect, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApplicantProfileDraft, ProjectEntry } from './types'
import { newProjectEntry } from './types'
import {
  COMPENSATION_BAND_OPTIONS,
  DEALBREAKER_SLUGS,
  DISCIPLINE_OPTIONS,
  EDUCATION_OPTIONS,
  INDUSTRY_SLUGS,
  MOTIVATION_SLUGS,
  NEXT_ROLE_SLUGS,
  PROJECT_KIND_OPTIONS,
  PROJECT_PRIMARY_TECH_OPTIONS,
  RAMP_AREA_SLUGS,
  REGION_OPTIONS,
  SENIORITY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TIMEZONE_OPTIONS,
  TOOL_SLUGS,
  type SelectOption,
  VISA_STATUS_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
} from './fieldOptions'
import {
  applicantProfileQueryKeyFor,
  setApplicantProfileCache,
  fetchApplicantProfile,
  saveApplicantProfile,
  submitApplicantProfile,
} from '../../lib/profileApi'
import { authMeQueryKey, fetchAuthMe } from '../../lib/auth'

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-150 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20'
const textareaClass =
  'min-h-[100px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-150 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20'
const selectClass = `${inputClass} bg-[var(--color-surface-elevated)]`

function toggleSlug(list: string[], slug: string, on: boolean): string[] {
  if (on) return list.includes(slug) ? list : [...list, slug]
  return list.filter((s) => s !== slug)
}

function SectionNav() {
  const links = [
    ['#profile-basics', 'Basics & links'],
    ['#profile-targets', 'Targets'],
    ['#profile-experience', 'Experience'],
    ['#profile-skills', 'Skills & education'],
    ['#profile-projects', 'Projects'],
    ['#profile-behavioral', 'Behavioral stories'],
    ['#profile-career', 'Career goals'],
    ['#profile-workstyle', 'Work style & logistics'],
  ] as const
  return (
    <nav className="sticky top-16 z-10 -mx-6 mb-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-6 py-3 backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Jump to section
      </p>
      <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto text-sm">
        {links.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="text-[var(--color-text-secondary)] underline decoration-[var(--color-border)] underline-offset-2 transition-colors duration-150 hover:text-[var(--color-text-primary)]"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-b border-[var(--color-border)] pb-10 pt-2 last:border-b-0"
    >
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}
      <div className="mt-5 flex max-w-3xl flex-col gap-5">{children}</div>
    </section>
  )
}

function TextField({
  label,
  hint,
  optional,
  ...props
}: {
  label: string
  hint?: string
  optional?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {optional ? (
          <span className="font-normal text-[var(--color-text-tertiary)]">
            {' '}
            (optional)
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>
      ) : null}
      <input className={inputClass} {...props} />
    </label>
  )
}

function LongField({
  label,
  hint,
  optional,
  minHeightClass = 'min-h-[120px]',
  ...props
}: {
  label: string
  hint?: string
  optional?: boolean
  minHeightClass?: string
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {optional ? (
          <span className="font-normal text-[var(--color-text-tertiary)]">
            {' '}
            (optional)
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>
      ) : null}
      <textarea className={`${textareaClass} ${minHeightClass}`} {...props} />
    </label>
  )
}

function SelectField({
  label,
  hint,
  optional,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  optional?: boolean
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {optional ? (
          <span className="font-normal text-[var(--color-text-tertiary)]">
            {' '}
            (optional)
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>
      ) : null}
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value || '__empty'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function BooleanField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 transition-colors duration-150 hover:bg-[var(--color-border-light)]">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] transition-colors focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:ring-offset-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function CheckboxGrid({
  title,
  hint,
  entries,
  selected,
  onToggle,
}: {
  title: string
  hint?: string
  entries: readonly (readonly [string, string])[]
  selected: string[]
  onToggle: (slug: string, on: boolean) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-[var(--color-text-primary)]">
        {title}
      </legend>
      {hint ? (
        <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([slug, lab]) => (
          <label
            key={slug}
            className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-border-light)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-light)]"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] transition-colors focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:ring-offset-0"
              checked={selected.includes(slug)}
              onChange={(e) => onToggle(slug, e.target.checked)}
            />
            {lab}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ApplicantProfileForm() {
  const queryClient = useQueryClient()

  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })

  const {
    data: serverDraft,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: applicantProfileQueryKeyFor(user?.id ?? ''),
    queryFn: fetchApplicantProfile,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: Boolean(user?.id),
    placeholderData: keepPreviousData,
  })

  const [draft, setDraft] = useState<ApplicantProfileDraft | null>(null)
  const baselineJson = useRef<string | null>(null)
  const hydrated = useRef(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const prevUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const id = user?.id
    if (!id) return
    if (prevUserId.current !== undefined && prevUserId.current !== id) {
      hydrated.current = false
      setDraft(null)
      baselineJson.current = null
    }
    prevUserId.current = id
  }, [user?.id])

  useEffect(() => {
    if (!serverDraft || hydrated.current) return
    const next = { ...serverDraft }
    if (!next.email.trim() && user?.email) {
      next.email = user.email
    }
    setDraft(next)
    baselineJson.current = JSON.stringify(next)
    hydrated.current = true
  }, [serverDraft, user?.email])

  useEffect(() => {
    if (!draft || baselineJson.current === null) return
    if (JSON.stringify(draft) === baselineJson.current) return

    let cancelled = false
    let innerId: ReturnType<typeof setTimeout> | undefined
    const outerId = window.setTimeout(() => {
      void (async () => {
        try {
          setSaveError(null)
          await saveApplicantProfile(draft)
          if (cancelled) return
          baselineJson.current = JSON.stringify(draft)
          if (user?.id) setApplicantProfileCache(queryClient, user.id, draft)
          setSavedFlash(true)
          innerId = window.setTimeout(() => {
            if (!cancelled) setSavedFlash(false)
          }, 2000)
        } catch (e) {
          if (!cancelled)
            setSaveError(e instanceof Error ? e.message : 'Save failed')
        }
      })()
    }, 750)
    return () => {
      cancelled = true
      clearTimeout(outerId)
      if (innerId !== undefined) clearTimeout(innerId)
    }
  }, [draft, queryClient, user?.id])

  function patch<K extends keyof ApplicantProfileDraft>(
    key: K,
    value: ApplicantProfileDraft[K],
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  function updateProject(id: string, partial: Partial<ProjectEntry>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            projects: d.projects.map((p) =>
              p.id === id ? { ...p, ...partial } : p,
            ),
          }
        : d,
    )
  }

  function addProject() {
    setDraft((d) =>
      d ? { ...d, projects: [...d.projects, newProjectEntry()] } : d,
    )
  }

  function removeProject(id: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            projects:
              d.projects.length <= 1
                ? d.projects
                : d.projects.filter((p) => p.id !== id),
          }
        : d,
    )
  }

  function exportJson() {
    if (!draft) return
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'prismapply-profile-draft.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onSubmitProfile() {
    if (!draft || !user?.id) return
    setSaveError(null)
    setSubmitting(true)
    try {
      await submitApplicantProfile(draft)
      baselineJson.current = JSON.stringify(draft)
      setApplicantProfileCache(queryClient, user.id, draft)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 2000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.id) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Sign in to load your profile.
      </p>
    )
  }

  if (isPending && !draft) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Loading profile from your account\u2026
      </p>
    )
  }

  if (isError) {
    return (
      <div className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-5">
        <p className="font-medium text-[var(--color-danger)]">
          Could not load profile
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border border-[var(--color-danger-border)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--color-danger)] transition-colors duration-150 hover:bg-[var(--color-danger-bg)]"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!draft) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No profile data yet.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Mix of structured choices and narrative fields. Changes also save automatically
            (debounced). Use <strong>Submit profile</strong> to persist immediately via{' '}
            <code className="rounded bg-[var(--color-border-light)] px-1 font-mono text-xs">
              POST /api/profile
            </code>
            . Behavioral sections stay as written stories for the model to adapt.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {savedFlash ? (
              <span className="text-xs text-[var(--color-success)]">Saved to your account</span>
            ) : null}
            <button
              type="button"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              onClick={() => void onSubmitProfile()}
            >
              {submitting ? 'Submitting\u2026' : 'Submit profile'}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-all duration-150 hover:bg-[var(--color-border-light)] active:scale-[0.98]"
              onClick={exportJson}
            >
              Export JSON
            </button>
          </div>
          {saveError ? (
            <span className="max-w-xs text-right text-xs text-[var(--color-danger)]">
              {saveError}
            </span>
          ) : null}
        </div>
      </div>

      <SectionNav />

      <Section
        id="profile-basics"
        title="Basics & public presence"
        description="Structured identity plus links; long-form only where a list does not fit."
      >
        <TextField
          label="Full legal name"
          value={draft.fullName}
          onChange={(e) => patch('fullName', e.target.value)}
          autoComplete="name"
        />
        <TextField
          label="Email address"
          type="email"
          value={draft.email}
          onChange={(e) => patch('email', e.target.value)}
          autoComplete="email"
          hint="Used on job applications; defaults to your account email if left blank."
        />
        <TextField
          label="Phone number"
          type="tel"
          value={draft.phoneNumber}
          onChange={(e) => patch('phoneNumber', e.target.value)}
          autoComplete="tel"
        />
        <TextField
          label="Preferred name / how you sign emails"
          optional
          value={draft.preferredName}
          onChange={(e) => patch('preferredName', e.target.value)}
        />
        <TextField
          label="One-line professional headline"
          value={draft.headline}
          onChange={(e) => patch('headline', e.target.value)}
        />
        <TextField
          label="Current company"
          optional
          hint="Shown when an application form asks for your current employer."
          value={draft.currentCompany}
          onChange={(e) => patch('currentCompany', e.target.value)}
        />
        <SelectField
          label="Country / region"
          options={REGION_OPTIONS}
          value={draft.region}
          onChange={(v) => patch('region', v)}
        />
        <TextField
          label="City or locality"
          hint="Shown when a posting asks for location; keep honest to relocation limits."
          value={draft.cityOrDetail}
          onChange={(e) => patch('cityOrDetail', e.target.value)}
        />
        <SelectField
          label="Primary timezone band"
          options={TIMEZONE_OPTIONS}
          value={draft.timezone}
          onChange={(v) => patch('timezone', v)}
        />
        {draft.timezone === 'other' ? (
          <TextField
            label="Timezone detail"
            hint="IANA zone or offset, e.g. America/Chicago."
            value={draft.timezoneOtherNote}
            onChange={(e) => patch('timezoneOtherNote', e.target.value)}
          />
        ) : null}
        <TextField
          label="LinkedIn URL"
          type="url"
          optional
          value={draft.linkedInUrl}
          onChange={(e) => patch('linkedInUrl', e.target.value)}
        />
        <TextField
          label="Portfolio or personal site"
          type="url"
          optional
          value={draft.portfolioUrl}
          onChange={(e) => patch('portfolioUrl', e.target.value)}
        />
        <TextField
          label="GitHub (or main code host)"
          type="url"
          optional
          value={draft.githubUrl}
          onChange={(e) => patch('githubUrl', e.target.value)}
        />
        <LongField
          label="Other links worth citing"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.otherLinks}
          onChange={(e) => patch('otherLinks', e.target.value)}
        />
      </Section>

      <Section
        id="profile-targets"
        title="What you are looking for"
        description="Enumerated bands and disciplines reduce ambiguity; free text captures nuance."
      >
        <SelectField
          label="Years of experience (approximate)"
          options={YEARS_EXPERIENCE_OPTIONS}
          value={draft.yearsExperience}
          onChange={(v) => patch('yearsExperience', v)}
        />
        <SelectField
          label="Seniority you are targeting"
          options={SENIORITY_OPTIONS}
          value={draft.seniorityTarget}
          onChange={(v) => patch('seniorityTarget', v)}
        />
        <SelectField
          label="Primary discipline"
          options={DISCIPLINE_OPTIONS}
          value={draft.primaryDiscipline}
          onChange={(v) => patch('primaryDiscipline', v)}
        />
        {draft.primaryDiscipline === 'other' ? (
          <TextField
            label="Describe discipline"
            value={draft.disciplineOtherNote}
            onChange={(e) => patch('disciplineOtherNote', e.target.value)}
          />
        ) : null}
        <LongField
          label="Role titles, scope, and nuance not covered above"
          hint="Variations recruiters use, IC vs manager, domain (e.g. billing, growth)."
          minHeightClass="min-h-[100px]"
          value={draft.targetRolesNarrative}
          onChange={(e) => patch('targetRolesNarrative', e.target.value)}
        />
        <CheckboxGrid
          title="Industries or problem domains of interest"
          hint="Select all that apply."
          entries={INDUSTRY_SLUGS}
          selected={draft.selectedIndustrySlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedIndustrySlugs: toggleSlug(
                      d.selectedIndustrySlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <LongField
          label="Industry notes"
          optional
          hint='Elaborate on "other", sub-niches, or companies you avoid within a sector.'
          minHeightClass="min-h-[80px]"
          value={draft.industryOtherNote}
          onChange={(e) => patch('industryOtherNote', e.target.value)}
        />
        <LongField
          label="Companies or products you admire"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.companiesYouAdmire}
          onChange={(e) => patch('companiesYouAdmire', e.target.value)}
        />
      </Section>

      <Section
        id="profile-experience"
        title="Honest career narrative"
        description="Long-form only — these cannot be reduced to dropdowns without losing signal."
      >
        <LongField
          label="Your career story, as you would tell a peer"
          minHeightClass="min-h-[180px]"
          value={draft.honestCareerNarrative}
          onChange={(e) => patch('honestCareerNarrative', e.target.value)}
        />
        <LongField
          label="Proudest wins (with metrics if you have them)"
          minHeightClass="min-h-[160px]"
          value={draft.proudestProfessionalWins}
          onChange={(e) => patch('proudestProfessionalWins', e.target.value)}
        />
        <BooleanField
          label="Comfortable discussing failures or setbacks in applications if relevant"
          hint="If unchecked, the AI should steer away from failure-focused prompts unless you opt in per application."
          checked={draft.comfortableSharingFailureStories}
          onChange={(v) => patch('comfortableSharingFailureStories', v)}
        />
        <LongField
          label="Non-traditional path, gaps, or context to explain proactively"
          optional
          minHeightClass="min-h-[120px]"
          value={draft.gapsOrNonTraditionalPath}
          onChange={(e) => patch('gapsOrNonTraditionalPath', e.target.value)}
        />
      </Section>

      <Section
        id="profile-skills"
        title="Skills, tools, and education"
        description="Checklists for inventory; narrative for how strong you are and how you work."
      >
        <LongField
          label="Core strengths in your own words"
          hint="What you would defend in a senior interview — depth, ownership, domains."
          minHeightClass="min-h-[140px]"
          value={draft.skillsCoreNarrative}
          onChange={(e) => patch('skillsCoreNarrative', e.target.value)}
        />
        <CheckboxGrid
          title="Areas you are ramping or want more exposure to"
          entries={RAMP_AREA_SLUGS}
          selected={draft.selectedRampAreaSlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedRampAreaSlugs: toggleSlug(
                      d.selectedRampAreaSlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <CheckboxGrid
          title="Tools & platforms you have used meaningfully"
          entries={TOOL_SLUGS}
          selected={draft.selectedToolSlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedToolSlugs: toggleSlug(
                      d.selectedToolSlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <LongField
          label="Tools / stack notes"
          optional
          hint="Vendor-specific services, niche tools, or anything missing from the list."
          minHeightClass="min-h-[80px]"
          value={draft.toolsOtherNote}
          onChange={(e) => patch('toolsOtherNote', e.target.value)}
        />
        <SelectField
          label="Highest formal education"
          options={EDUCATION_OPTIONS}
          value={draft.highestEducation}
          onChange={(v) => patch('highestEducation', v)}
        />
        <LongField
          label="Education & certifications (details)"
          optional
          minHeightClass="min-h-[100px]"
          value={draft.educationDetails}
          onChange={(e) => patch('educationDetails', e.target.value)}
        />
      </Section>

      <Section
        id="profile-projects"
        title="Personal & side projects"
        description="Kind and primary stack are structured; story stays narrative."
      >
        {draft.projects.map((project, index) => (
          <fieldset
            key={project.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">
              Project {index + 1}
            </legend>
            <div className="mt-3 flex flex-col gap-4">
              <SelectField
                label="Project type"
                options={PROJECT_KIND_OPTIONS}
                value={project.kind}
                onChange={(v) => updateProject(project.id, { kind: v })}
              />
              <TextField
                label="Name"
                value={project.title}
                onChange={(e) => updateProject(project.id, { title: e.target.value })}
              />
              <LongField
                label="What you built and your role"
                minHeightClass="min-h-[120px]"
                value={project.summary}
                onChange={(e) =>
                  updateProject(project.id, { summary: e.target.value })
                }
              />
              <SelectField
                label="Primary technology / language"
                options={PROJECT_PRIMARY_TECH_OPTIONS}
                value={project.primaryTechSlug}
                onChange={(v) => updateProject(project.id, { primaryTechSlug: v })}
              />
              <LongField
                label="Stack details"
                optional
                hint="Libraries, infra, anything beyond the primary pick."
                minHeightClass="min-h-[80px]"
                value={project.techStackExtra}
                onChange={(e) =>
                  updateProject(project.id, { techStackExtra: e.target.value })
                }
              />
              <LongField
                label="Impact or proof"
                optional
                value={project.impactMetrics}
                onChange={(e) =>
                  updateProject(project.id, { impactMetrics: e.target.value })
                }
              />
              <TextField
                label="Link"
                type="url"
                optional
                value={project.link}
                onChange={(e) => updateProject(project.id, { link: e.target.value })}
              />
              <BooleanField
                label="Shipped to real users (not only local / tutorial)"
                checked={project.shippedToUsers}
                onChange={(v) => updateProject(project.id, { shippedToUsers: v })}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-[var(--color-danger)] underline underline-offset-2 transition-colors duration-150 hover:text-[var(--color-danger)]/80 disabled:opacity-40"
                  disabled={draft.projects.length <= 1}
                  onClick={() => removeProject(project.id)}
                >
                  Remove project
                </button>
              </div>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="self-start rounded-md border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          onClick={addProject}
        >
          + Add another project
        </button>
      </Section>

      <Section
        id="profile-behavioral"
        title="Behavioral & situational stories (STAR-ready)"
        description="Kept as narrative text so the model can adapt tone per posting without losing your facts."
      >
        <LongField
          label="Hardest technical problem you have solved"
          minHeightClass="min-h-[140px]"
          value={draft.storyHardestTechnicalChallenge}
          onChange={(e) =>
            patch('storyHardestTechnicalChallenge', e.target.value)
          }
        />
        <LongField
          label="A disagreement with a teammate or manager — how you handled it"
          minHeightClass="min-h-[140px]"
          value={draft.storyDisagreementOrConflict}
          onChange={(e) =>
            patch('storyDisagreementOrConflict', e.target.value)
          }
        />
        <LongField
          label="A meaningful mistake or failure — what happened and what changed afterward"
          minHeightClass="min-h-[140px]"
          value={draft.storyBiggestMistake}
          onChange={(e) => patch('storyBiggestMistake', e.target.value)}
        />
        <LongField
          label="Leading or influencing without formal authority"
          minHeightClass="min-h-[140px]"
          value={draft.storyLeadingWithoutAuthority}
          onChange={(e) =>
            patch('storyLeadingWithoutAuthority', e.target.value)
          }
        />
        <LongField
          label="Shipping under a tight deadline (tradeoffs you made)"
          minHeightClass="min-h-[140px]"
          value={draft.storyTightDeadline}
          onChange={(e) => patch('storyTightDeadline', e.target.value)}
        />
        <LongField
          label="Conflicting priorities from stakeholders — how you resolved or escalated"
          minHeightClass="min-h-[140px]"
          value={draft.storyConflictingPriorities}
          onChange={(e) =>
            patch('storyConflictingPriorities', e.target.value)
          }
        />
        <LongField
          label="A process or system you improved measurably"
          minHeightClass="min-h-[140px]"
          value={draft.storyProcessImprovement}
          onChange={(e) => patch('storyProcessImprovement', e.target.value)}
        />
        <LongField
          label="Receiving difficult or surprising feedback — your response"
          minHeightClass="min-h-[140px]"
          value={draft.storyDifficultFeedback}
          onChange={(e) => patch('storyDifficultFeedback', e.target.value)}
        />
        <LongField
          label="Mentoring, teaching, or onboarding others"
          optional
          minHeightClass="min-h-[120px]"
          value={draft.storyMentoringTeaching}
          onChange={(e) => patch('storyMentoringTeaching', e.target.value)}
        />
        <LongField
          label="Cross-functional work (PM, design, data, support, sales\u2026)"
          minHeightClass="min-h-[140px]"
          value={draft.storyCrossFunctionalCollaboration}
          onChange={(e) =>
            patch('storyCrossFunctionalCollaboration', e.target.value)
          }
        />
        <LongField
          label="A highly ambiguous problem — how you scoped it and made progress"
          minHeightClass="min-h-[140px]"
          value={draft.storyAmbiguousProblem}
          onChange={(e) => patch('storyAmbiguousProblem', e.target.value)}
        />
        <LongField
          label='An ethical dilemma, risk tradeoff, or "unpopular right call"'
          optional
          minHeightClass="min-h-[140px]"
          value={draft.storyEthicalOrRiskTradeoff}
          onChange={(e) => patch('storyEthicalOrRiskTradeoff', e.target.value)}
        />
      </Section>

      <Section
        id="profile-career"
        title="Motivations & boundaries"
        description="Motivations and deal-breakers as structured tags plus short notes."
      >
        <CheckboxGrid
          title="Why you are open to a move"
          entries={MOTIVATION_SLUGS}
          selected={draft.selectedMotivationSlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedMotivationSlugs: toggleSlug(
                      d.selectedMotivationSlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <LongField
          label="Motivation notes"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.motivationsOtherNote}
          onChange={(e) => patch('motivationsOtherNote', e.target.value)}
        />
        <CheckboxGrid
          title="What you want more of in the next role"
          entries={NEXT_ROLE_SLUGS}
          selected={draft.selectedNextRoleDesireSlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedNextRoleDesireSlugs: toggleSlug(
                      d.selectedNextRoleDesireSlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <LongField
          label="Goals notes"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.whatYouWantNextNote}
          onChange={(e) => patch('whatYouWantNextNote', e.target.value)}
        />
        <CheckboxGrid
          title="Hard boundaries (select any that apply)"
          entries={DEALBREAKER_SLUGS}
          selected={draft.selectedDealbreakerSlugs}
          onToggle={(slug, on) => {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    selectedDealbreakerSlugs: toggleSlug(
                      d.selectedDealbreakerSlugs,
                      slug,
                      on,
                    ),
                  }
                : d,
            )
          }}
        />
        <LongField
          label="Deal-breaker notes"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.dealBreakersOtherNote}
          onChange={(e) => patch('dealBreakersOtherNote', e.target.value)}
        />
      </Section>

      <Section
        id="profile-workstyle"
        title="Work style & logistics"
        description="Arrangement, team shape, comp band, and visa posture as structured fields."
      >
        <SelectField
          label="Preferred work arrangement"
          options={WORK_ARRANGEMENT_OPTIONS}
          value={draft.workArrangement}
          onChange={(v) => patch('workArrangement', v)}
        />
        <SelectField
          label="Team size you thrive in"
          options={TEAM_SIZE_OPTIONS}
          value={draft.teamSizePreference}
          onChange={(v) => patch('teamSizePreference', v)}
        />
        <SelectField
          label="Compensation expectation (rough band, USD-ish equivalent)"
          options={COMPENSATION_BAND_OPTIONS}
          value={draft.compensationBand}
          onChange={(v) => patch('compensationBand', v)}
        />
        <LongField
          label="Compensation context"
          optional
          hint="Equity vs cash, geo, seniority negotiation — only if useful."
          minHeightClass="min-h-[80px]"
          value={draft.compensationExtraNote}
          onChange={(e) => patch('compensationExtraNote', e.target.value)}
        />
        <BooleanField
          label="Open to meaningful equity instead of max cash"
          checked={draft.openToEquity}
          onChange={(v) => patch('openToEquity', v)}
        />
        <BooleanField
          label="Open to contract / corp-to-corp roles"
          checked={draft.openToContract}
          onChange={(v) => patch('openToContract', v)}
        />
        <BooleanField
          label="Willing to relocate for the right role"
          checked={draft.openToRelocate}
          onChange={(v) => patch('openToRelocate', v)}
        />
        <SelectField
          label="Work authorization (self-reported)"
          options={VISA_STATUS_OPTIONS}
          value={draft.visaStatus}
          onChange={(v) => patch('visaStatus', v)}
        />
        <BooleanField
          label="I will need visa sponsorship for a new employer"
          checked={draft.needsVisaSponsorship}
          onChange={(v) => patch('needsVisaSponsorship', v)}
        />
        <LongField
          label="Work authorization notes"
          optional
          minHeightClass="min-h-[80px]"
          value={draft.workAuthOtherNote}
          onChange={(e) => patch('workAuthOtherNote', e.target.value)}
        />
      </Section>
    </div>
  )
}

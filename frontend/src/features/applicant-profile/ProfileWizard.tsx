import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { trackEvent, trackOnce } from '@/lib/analytics'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  ArrowUpFromLine,
  Loader2,
} from 'lucide-react'
import type { ApplicantProfileDraft, ProjectEntry, WorkEntry } from './types'
import { newProjectEntry, newWorkEntry } from './types'
import { isApplicantProfileComplete, isWizardStepComplete } from './profileCompletion'
import {
  deriveProfileMode,
  getWizardSteps,
  isEarlyBasics,
  minProjectsRequired,
  type WizardStepDef,
} from './profileMode'
import {
  COMPENSATION_BAND_OPTIONS,
  DEALBREAKER_SLUGS,
  DISCIPLINE_OPTIONS,
  EARLY_MOTIVATION_SLUGS,
  EDUCATION_OPTIONS,
  INDUSTRY_SLUGS,
  MOTIVATION_SLUGS,
  NEXT_ROLE_SLUGS,
  PAID_WORK_EXPERIENCE_OPTIONS,
  PROJECT_KIND_OPTIONS,
  PROJECT_PRIMARY_TECH_OPTIONS,
  RAMP_AREA_SLUGS,
  REGION_OPTIONS,
  SENIORITY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TIMEZONE_OPTIONS,
  TOOL_SLUGS,
  WORK_ENTRY_TYPE_OPTIONS,
  type SelectOption,
  VISA_STATUS_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
} from './fieldOptions'
import {
  applicantProfileQueryKeyFor,
  fetchApplicantProfile,
  saveApplicantProfile,
  setApplicantProfileCache,
  submitApplicantProfile,
} from '@/lib/profileApi'
import { authMeQueryKey, fetchAuthMe } from '@/lib/auth'
import { describeOnceLine, truthPledge } from '@/lib/copy'
import { FieldExampleButton } from './FieldExampleModal'
import type { FieldExampleKey } from './fieldExamples'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type StepDef = WizardStepDef

function toggleSlug(list: string[], slug: string, on: boolean): string[] {
  if (on) return list.includes(slug) ? list : [...list, slug]
  return list.filter((s) => s !== slug)
}

const SELECT_EMPTY_LABEL = 'Select an option'

function SelectField({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
}) {
  const selectable = options.filter((o) => o.value !== '')

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground -mt-1">{hint}</p> : null}
      <Select
        value={value === '' ? null : value}
        onValueChange={(v) => onChange(v ?? '')}
        items={selectable}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={SELECT_EMPTY_LABEL}>
            {(current) => {
              if (current == null || current === '') {
                return (
                  <span className="text-muted-foreground">{SELECT_EMPTY_LABEL}</span>
                )
              }
              const match = options.find((o) => o.value === current)
              return match?.label ?? String(current)
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {selectable.map((o) => (
            <SelectItem key={o.value} value={o.value} label={o.label}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TextField({
  label,
  hint,
  optional,
  exampleKey,
  questionOverride,
  seniorityTarget = '',
  ...props
}: {
  label: string
  hint?: string
  optional?: boolean
  exampleKey?: FieldExampleKey
  questionOverride?: string
  seniorityTarget?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <Label>
          {label}
          {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
        </Label>
        {exampleKey ? (
          <FieldExampleButton
            exampleKey={exampleKey}
            seniorityTarget={seniorityTarget}
            questionOverride={questionOverride ?? label}
          />
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground -mt-1">{hint}</p> : null}
      <Input {...props} />
    </div>
  )
}

function LongField({
  label,
  hint,
  optional,
  exampleKey,
  questionOverride,
  seniorityTarget = '',
  ...props
}: {
  label: string
  hint?: string
  optional?: boolean
  exampleKey?: FieldExampleKey
  questionOverride?: string
  seniorityTarget?: string
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <Label>
          {label}
          {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
        </Label>
        {exampleKey ? (
          <FieldExampleButton
            exampleKey={exampleKey}
            seniorityTarget={seniorityTarget}
            questionOverride={questionOverride ?? label}
          />
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground -mt-1">{hint}</p> : null}
      <Textarea className="min-h-[120px]" {...props} />
    </div>
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
    <label className="flex cursor-pointer select-text items-start gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-accent/50 has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span className="select-text">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
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
    <fieldset className="grid gap-2">
      <legend className="select-text text-sm font-medium">{title}</legend>
      {hint ? <p className="text-xs text-muted-foreground -mt-1">{hint}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([slug, lab]) => {
          const isSelected = selected.includes(slug)
          return (
            <label
              key={slug}
              className="flex cursor-pointer select-text items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5 hover:bg-accent/50"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(v) => onToggle(slug, v === true)}
              />
              {lab}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function ProgressBar({
  steps,
  current,
  draft,
  onStepClick,
}: {
  steps: StepDef[]
  current: number
  draft: ApplicantProfileDraft
  onStepClick?: (i: number) => void
}) {
  const completed = steps.map((s) => isWizardStepComplete(s.id, draft))
  const completedCount = completed.filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Desktop horizontal stepper */}
      <div className="hidden gap-0 sm:flex">
        {steps.map((step, i) => {
          const isComplete = completed[i]
          const isCurrent = i === current
          const clickable = (isComplete || isCurrent) && onStepClick
          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onStepClick?.(i) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onStepClick?.(i)
                        }
                      }
                    : undefined
                }
                className={`flex items-center gap-2 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isComplete
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={`hidden select-text text-xs font-medium md:inline ${
                    isCurrent
                      ? 'text-foreground'
                      : isComplete
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                  }`}
                >
                  {step.shortTitle}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-px flex-1 transition-colors ${
                    isComplete ? 'bg-primary/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile progress */}
      <div className="flex items-center gap-3 sm:hidden">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">Step {current + 1}</span>
          <span className="text-muted-foreground">of {steps.length}</span>
        </div>
        <div className="flex flex-1 gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= current ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {completedCount}/{steps.length}
        </span>
      </div>
    </div>
  )
}

function StepBasics({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const early = isEarlyBasics(draft)
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full legal name" exampleKey="fullName" seniorityTarget={st} value={draft.fullName} onChange={(e) => patch('fullName', e.target.value)} autoComplete="name" />
        <TextField label="Email address" type="email" value={draft.email} onChange={(e) => patch('email', e.target.value)} autoComplete="email" hint="" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Phone number" type="tel" exampleKey="phoneNumber" seniorityTarget={st} value={draft.phoneNumber} onChange={(e) => patch('phoneNumber', e.target.value)} autoComplete="tel" />
      </div>
      <TextField label="Preferred name" optional exampleKey="preferredName" seniorityTarget={st} value={draft.preferredName} onChange={(e) => patch('preferredName', e.target.value)} hint="How you sign emails" />
      <TextField
        label="One-line professional headline"
        exampleKey="headline"
        seniorityTarget={st}
        value={draft.headline}
        onChange={(e) => patch('headline', e.target.value)}
        hint={early ? 'e.g. CS student · React + Python' : undefined}
      />
      {early ? (
        <TextField
          label="Current status"
          optional
          exampleKey="currentStatus"
          seniorityTarget={st}
          hint="e.g. Student at State U, bootcamp graduate, job searching"
          value={draft.currentStatus}
          onChange={(e) => patch('currentStatus', e.target.value)}
        />
      ) : (
        <TextField label="Current company" optional exampleKey="currentCompany" seniorityTarget={st} hint="For application forms that ask for your current employer." value={draft.currentCompany} onChange={(e) => patch('currentCompany', e.target.value)} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Country / region" options={REGION_OPTIONS} value={draft.region} onChange={(v) => patch('region', v)} />
        <TextField label="City or locality" exampleKey="cityOrDetail" seniorityTarget={st} value={draft.cityOrDetail} onChange={(e) => patch('cityOrDetail', e.target.value)} hint="Keep honest to relocation limits" />
      </div>
      <SelectField label="Primary timezone band" options={TIMEZONE_OPTIONS} value={draft.timezone} onChange={(v) => patch('timezone', v)} />
      {draft.timezone === 'other' ? (
        <TextField label="Timezone detail" exampleKey="timezoneOtherNote" seniorityTarget={st} value={draft.timezoneOtherNote} onChange={(e) => patch('timezoneOtherNote', e.target.value)} hint="IANA zone or offset, e.g. America/Chicago" />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="LinkedIn URL" type="url" optional exampleKey="linkedInUrl" seniorityTarget={st} value={draft.linkedInUrl} onChange={(e) => patch('linkedInUrl', e.target.value)} />
        <TextField label="Portfolio / personal site" type="url" optional exampleKey="portfolioUrl" seniorityTarget={st} value={draft.portfolioUrl} onChange={(e) => patch('portfolioUrl', e.target.value)} />
        <TextField label="GitHub (or main code host)" type="url" optional exampleKey="githubUrl" seniorityTarget={st} value={draft.githubUrl} onChange={(e) => patch('githubUrl', e.target.value)} />
      </div>
      <LongField label="Other links worth citing" optional exampleKey="otherLinks" seniorityTarget={st} className="min-h-[80px]" value={draft.otherLinks} onChange={(e) => patch('otherLinks', e.target.value)} />
    </div>
  )
}

function StepTargets({
  draft,
  patch,
  setDraft,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
}) {
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Years of experience" options={YEARS_EXPERIENCE_OPTIONS} value={draft.yearsExperience} onChange={(v) => patch('yearsExperience', v)} />
        <SelectField label="Seniority target" options={SENIORITY_OPTIONS} value={draft.seniorityTarget} onChange={(v) => patch('seniorityTarget', v)} hint="Junior is fine — we match at or above your target." />
        <SelectField label="Primary discipline" options={DISCIPLINE_OPTIONS} value={draft.primaryDiscipline} onChange={(v) => patch('primaryDiscipline', v)} />
      </div>
      <SelectField
        label="Paid software work experience"
        options={PAID_WORK_EXPERIENCE_OPTIONS}
        value={draft.paidWorkExperience}
        onChange={(v) => patch('paidWorkExperience', v as ApplicantProfileDraft['paidWorkExperience'])}
        hint="This shapes the rest of the wizard and how we format your resume."
      />
      {draft.primaryDiscipline === 'other' ? (
        <TextField label="Describe discipline" exampleKey="disciplineOtherNote" seniorityTarget={st} value={draft.disciplineOtherNote} onChange={(e) => patch('disciplineOtherNote', e.target.value)} />
      ) : null}
      <LongField label="Role titles, scope, and nuance" exampleKey="targetRolesNarrative" seniorityTarget={st} value={draft.targetRolesNarrative} onChange={(e) => patch('targetRolesNarrative', e.target.value)} hint="IC vs manager, domain (e.g. billing, growth)" />
      <CheckboxGrid
        title="Industries or problem domains of interest"
        hint="Select all that apply"
        entries={INDUSTRY_SLUGS}
        selected={draft.selectedIndustrySlugs}
        onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedIndustrySlugs: toggleSlug(d.selectedIndustrySlugs, slug, on) } : d))}
      />
      <LongField label="Industry notes" optional exampleKey="industryOtherNote" seniorityTarget={st} value={draft.industryOtherNote} onChange={(e) => patch('industryOtherNote', e.target.value)} hint='Elaborate on "other" or sub-niches' />
      <LongField label="Companies or products you admire" optional exampleKey="companiesYouAdmire" seniorityTarget={st} value={draft.companiesYouAdmire} onChange={(e) => patch('companiesYouAdmire', e.target.value)} />
    </div>
  )
}

function StepExperience({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const transitional = deriveProfileMode(draft) === 'transitional'
  const st = draft.seniorityTarget
  const narrativeLabel = transitional ? 'What you have done so far' : 'Your career story, as you would tell a peer'
  return (
    <div className="space-y-5">
      <LongField
        label={narrativeLabel}
        exampleKey="honestCareerNarrative"
        questionOverride={narrativeLabel}
        seniorityTarget={st}
        className="min-h-[180px]"
        value={draft.honestCareerNarrative}
        onChange={(e) => patch('honestCareerNarrative', e.target.value)}
      />
      {!transitional ? (
        <LongField label="Proudest wins (with metrics if you have them)" exampleKey="proudestProfessionalWins" seniorityTarget={st} className="min-h-[160px]" value={draft.proudestProfessionalWins} onChange={(e) => patch('proudestProfessionalWins', e.target.value)} />
      ) : null}
      <BooleanField label="Comfortable discussing failures or setbacks" hint="If unchecked, the AI steers away from failure-focused prompts" checked={draft.comfortableSharingFailureStories} onChange={(v) => patch('comfortableSharingFailureStories', v)} />
      <LongField label="Non-traditional path, gaps, or context" optional exampleKey="gapsOrNonTraditionalPath" seniorityTarget={st} className="min-h-[120px]" value={draft.gapsOrNonTraditionalPath} onChange={(e) => patch('gapsOrNonTraditionalPath', e.target.value)} />
    </div>
  )
}

function StepEducation({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <TextField label="School or program" exampleKey="schoolName" seniorityTarget={st} value={draft.schoolName} onChange={(e) => patch('schoolName', e.target.value)} />
      <TextField label="Graduation (expected or completed)" optional exampleKey="expectedGraduation" seniorityTarget={st} value={draft.expectedGraduation} onChange={(e) => patch('expectedGraduation', e.target.value)} hint="e.g. May 2026 or 2024" />
      <SelectField label="Highest formal education" options={EDUCATION_OPTIONS} value={draft.highestEducation} onChange={(v) => patch('highestEducation', v)} />
      <LongField label="Education details" optional exampleKey="educationDetails" seniorityTarget={st} className="min-h-[100px]" value={draft.educationDetails} onChange={(e) => patch('educationDetails', e.target.value)} hint="Degree, major, honors, bootcamp, certifications" />
      <LongField label="Relevant coursework" optional exampleKey="courseworkNote" seniorityTarget={st} className="min-h-[100px]" value={draft.courseworkNote} onChange={(e) => patch('courseworkNote', e.target.value)} hint="Courses where you built something substantial" />
    </div>
  )
}

function StepWorkHistory({
  draft,
  updateWorkEntry,
  addWorkEntry,
  removeWorkEntry,
}: {
  draft: ApplicantProfileDraft
  updateWorkEntry: (id: string, partial: Partial<WorkEntry>) => void
  addWorkEntry: () => void
  removeWorkEntry: (id: string) => void
}) {
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add internships, co-ops, or short freelance roles. These may appear as a small experience block on tailored resumes.
      </p>
      {draft.workEntries.map((entry, index) => (
        <fieldset key={entry.id} className="rounded-md border p-5">
          <legend className="select-text px-1 text-sm font-medium">Role {index + 1}</legend>
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Company" exampleKey="workCompany" seniorityTarget={st} value={entry.company} onChange={(e) => updateWorkEntry(entry.id, { company: e.target.value })} />
              <TextField label="Role title" exampleKey="workRole" seniorityTarget={st} value={entry.role} onChange={(e) => updateWorkEntry(entry.id, { role: e.target.value })} />
            </div>
            <SelectField label="Type" options={WORK_ENTRY_TYPE_OPTIONS} value={entry.employmentType} onChange={(v) => updateWorkEntry(entry.id, { employmentType: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Start (month/year)" exampleKey="workStartDate" seniorityTarget={st} value={entry.startDate} onChange={(e) => updateWorkEntry(entry.id, { startDate: e.target.value })} />
              <TextField label="End (month/year)" optional exampleKey="workEndDate" seniorityTarget={st} value={entry.endDate} onChange={(e) => updateWorkEntry(entry.id, { endDate: e.target.value })} />
            </div>
            <BooleanField label="Currently here" checked={entry.isCurrent} onChange={(v) => updateWorkEntry(entry.id, { isCurrent: v })} />
            <LongField label="What you did (factual bullets or notes)" exampleKey="workSummaryBullets" seniorityTarget={st} className="min-h-[120px]" value={entry.summaryBullets} onChange={(e) => updateWorkEntry(entry.id, { summaryBullets: e.target.value })} />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={draft.workEntries.length <= 1} onClick={() => removeWorkEntry(entry.id)}>
                Remove role
              </Button>
            </div>
          </div>
        </fieldset>
      ))}
      <Button variant="outline" onClick={addWorkEntry} className="w-full border-dashed">
        + Add another role
      </Button>
    </div>
  )
}

function StepResumeUpload({
  draft,
  onResumeSaved,
  onComplete,
}: {
  draft: ApplicantProfileDraft
  onResumeSaved: (updates: Pick<ApplicantProfileDraft, 'resumePlainText' | 'resumePdfUrl'>) => void
  onComplete: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function uploadResumePdf(f: File, text: string) {
    const { uploadResume } = await import('@/lib/resumeApi')
    const result = await uploadResume(f, text)
    onResumeSaved({
      resumePlainText: result.profile.resumePlainText || draft.resumePlainText,
      resumePdfUrl: result.profile.resumePdfUrl || draft.resumePdfUrl,
    })
  }

  async function handleFile(f: File) {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file')
      return
    }
    setError(null)
    setFile(f)
    setParsing(true)
    try {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      const buf = await f.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buf }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const text = (content.items as Array<{ str?: string }>).map((item) => item.str ?? '').join(' ')
        pages.push(text)
      }
      const extractedText = pages.join('\n\n')
      if (!extractedText.trim()) {
        setError('Could not extract text from this PDF. It may be scanned or image-based.')
        setParsing(false)
        return
      }
      setParsing(false)
      setUploading(true)
      await uploadResumePdf(f, extractedText)
      setUploading(false)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process resume')
      setParsing(false)
      setUploading(false)
    }
  }

  const busy = parsing || uploading
  const optional = deriveProfileMode(draft) !== 'experienced'
  const hasPdf = Boolean(draft.resumePdfUrl?.trim())

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {optional
          ? 'Optional — we build a resume from your projects and education if you skip this.'
          : 'Upload your current resume.'}
      </p>

      {hasPdf ? (
        <div className="overflow-hidden rounded-md border bg-muted/20">
          <iframe
            src={draft.resumePdfUrl}
            title="Your uploaded resume"
            className="h-[min(560px,70vh)] w-full bg-white"
          />
        </div>
      ) : null}

      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-10 transition-all ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }}
        onClick={() => document.getElementById('wizard-resume-input')?.click()}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {parsing ? 'Reading PDF\u2026' : 'Uploading and analyzing\u2026'}
            </span>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <ArrowUpFromLine className="size-8 text-primary" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
            <Button variant="ghost" size="xs" className="text-destructive" onClick={(e) => { e.stopPropagation(); setFile(null); setError(null) }}>
              Remove
            </Button>
          </div>
        ) : (
          <>
            <Upload className="mb-3 size-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {hasPdf ? 'Upload a new resume' : 'Upload your current resume'}
            </span>
            <span className="mt-1 text-xs text-muted-foreground/60">PDF only</span>
          </>
        )}
        <input id="wizard-resume-input" type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}
    </div>
  )
}

function StepSkills({
  draft,
  patch,
  setDraft,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
}) {
  const early = deriveProfileMode(draft) === 'early'
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <LongField
        label="Core strengths in your own words"
        exampleKey="skillsCoreNarrative"
        seniorityTarget={st}
        className="min-h-[140px]"
        value={draft.skillsCoreNarrative}
        onChange={(e) => patch('skillsCoreNarrative', e.target.value)}
        hint={early ? 'What you have actually built with — from projects and coursework' : 'What you would defend in a senior interview'}
      />
      <CheckboxGrid title="Areas you are ramping or want more exposure to" entries={RAMP_AREA_SLUGS} selected={draft.selectedRampAreaSlugs} onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedRampAreaSlugs: toggleSlug(d.selectedRampAreaSlugs, slug, on) } : d))} />
      <CheckboxGrid title="Tools & platforms you have used meaningfully" entries={TOOL_SLUGS} selected={draft.selectedToolSlugs} onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedToolSlugs: toggleSlug(d.selectedToolSlugs, slug, on) } : d))} />
      <LongField label="Tools / stack notes" optional exampleKey="toolsOtherNote" seniorityTarget={st} className="min-h-[80px]" value={draft.toolsOtherNote} onChange={(e) => patch('toolsOtherNote', e.target.value)} hint="Vendor-specific services or niche tools" />
      {!early ? (
        <>
          <SelectField label="Highest formal education" options={EDUCATION_OPTIONS} value={draft.highestEducation} onChange={(v) => patch('highestEducation', v)} />
          <LongField label="Education & certifications details" optional exampleKey="educationDetails" seniorityTarget={st} className="min-h-[100px]" value={draft.educationDetails} onChange={(e) => patch('educationDetails', e.target.value)} />
        </>
      ) : null}
    </div>
  )
}

function StepProjects({
  draft,
  updateProject,
  addProject,
  removeProject,
}: {
  draft: ApplicantProfileDraft
  updateProject: (id: string, partial: Partial<ProjectEntry>) => void
  addProject: () => void
  removeProject: (id: string) => void
}) {
  const minProjects = minProjectsRequired(deriveProfileMode(draft))
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add at least {minProjects} project{minProjects > 1 ? 's' : ''} with a name and summary. These power matching and tailored resumes.
      </p>
      {draft.projects.map((project, index) => (
        <fieldset
          key={project.id}
          className="rounded-md border p-5"
        >
          <legend className="select-text px-1 text-sm font-medium">Project {index + 1}</legend>
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Project type" options={PROJECT_KIND_OPTIONS} value={project.kind} onChange={(v) => updateProject(project.id, { kind: v })} />
              <TextField label="Name" exampleKey="projectTitle" seniorityTarget={st} value={project.title} onChange={(e) => updateProject(project.id, { title: e.target.value })} />
            </div>
            <LongField label="What you built and your role" exampleKey="projectSummary" seniorityTarget={st} className="min-h-[120px]" value={project.summary} onChange={(e) => updateProject(project.id, { summary: e.target.value })} />
            <SelectField label="Primary technology / language" options={PROJECT_PRIMARY_TECH_OPTIONS} value={project.primaryTechSlug} onChange={(v) => updateProject(project.id, { primaryTechSlug: v })} />
            <LongField label="Stack details" optional exampleKey="projectTechStackExtra" seniorityTarget={st} className="min-h-[80px]" value={project.techStackExtra} onChange={(e) => updateProject(project.id, { techStackExtra: e.target.value })} hint="Libraries, infra, beyond the primary pick" />
            <div className="grid gap-4 sm:grid-cols-2">
              <LongField label="Impact or proof" optional exampleKey="projectImpactMetrics" seniorityTarget={st} value={project.impactMetrics} onChange={(e) => updateProject(project.id, { impactMetrics: e.target.value })} />
              <TextField label="Link" type="url" optional exampleKey="projectLink" seniorityTarget={st} value={project.link} onChange={(e) => updateProject(project.id, { link: e.target.value })} />
            </div>
            <BooleanField label="Shipped to real users" checked={project.shippedToUsers} onChange={(v) => updateProject(project.id, { shippedToUsers: v })} />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={draft.projects.length <= minProjects} onClick={() => removeProject(project.id)}>
                Remove project
              </Button>
            </div>
          </div>
        </fieldset>
      ))}
      <Button variant="outline" onClick={addProject} className="w-full border-dashed">
        + Add another project
      </Button>
    </div>
  )
}

function StepStories({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const early = deriveProfileMode(draft) === 'early'
  const stories: Array<{ key: keyof ApplicantProfileDraft; label: string; optional?: boolean }> = early
    ? [
        { key: 'storyHardestTechnicalChallenge', label: 'Hardest technical problem (project, class, or internship ok)' },
        { key: 'storyDisagreementOrConflict', label: 'Working with others — team project, pair programming, or feedback', optional: true },
        { key: 'storyBiggestMistake', label: 'Something you would do differently next time', optional: true },
        { key: 'storyTightDeadline', label: 'Shipping or learning under a tight deadline', optional: true },
      ]
    : [
        { key: 'storyHardestTechnicalChallenge', label: 'Hardest technical problem you have solved' },
        { key: 'storyDisagreementOrConflict', label: 'A disagreement with a teammate or manager' },
        { key: 'storyBiggestMistake', label: 'A meaningful mistake or failure' },
        { key: 'storyLeadingWithoutAuthority', label: 'Leading or influencing without formal authority', optional: true },
        { key: 'storyTightDeadline', label: 'Shipping under a tight deadline', optional: true },
        { key: 'storyConflictingPriorities', label: 'Conflicting priorities from stakeholders', optional: true },
        { key: 'storyProcessImprovement', label: 'A process or system you improved measurably', optional: true },
        { key: 'storyDifficultFeedback', label: 'Receiving difficult or surprising feedback', optional: true },
        { key: 'storyMentoringTeaching', label: 'Mentoring, teaching, or onboarding others', optional: true },
        { key: 'storyCrossFunctionalCollaboration', label: 'Cross-functional work (PM, design, data\u2026)', optional: true },
        { key: 'storyAmbiguousProblem', label: 'A highly ambiguous problem', optional: true },
        { key: 'storyEthicalOrRiskTradeoff', label: 'An ethical dilemma or risk tradeoff', optional: true },
      ]
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {early
          ? 'Project and learning stories are enough — we adapt tone per role without changing your facts.'
          : 'These stay as narrative text so the model can adapt tone per posting without losing your facts.'}
      </p>
      {stories.map((s) => (
        <LongField
          key={s.key}
          label={s.label}
          optional={s.optional}
          exampleKey={s.key as FieldExampleKey}
          questionOverride={s.label}
          seniorityTarget={draft.seniorityTarget}
          className="min-h-[120px]"
          value={draft[s.key] as string}
          onChange={(e) => patch(s.key, e.target.value)}
        />
      ))}
    </div>
  )
}

function StepGoals({
  draft,
  patch,
  setDraft,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
}) {
  const early = deriveProfileMode(draft) !== 'experienced'
  const motivationEntries = early ? EARLY_MOTIVATION_SLUGS : MOTIVATION_SLUGS
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <CheckboxGrid
        title={early ? 'What you are looking for' : 'Why you are open to a move'}
        entries={motivationEntries}
        selected={draft.selectedMotivationSlugs}
        onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedMotivationSlugs: toggleSlug(d.selectedMotivationSlugs, slug, on) } : d))}
      />
      <LongField label="Motivation notes" optional exampleKey="motivationsOtherNote" seniorityTarget={st} className="min-h-[80px]" value={draft.motivationsOtherNote} onChange={(e) => patch('motivationsOtherNote', e.target.value)} />
      <CheckboxGrid title="What you want more of in the next role" entries={NEXT_ROLE_SLUGS} selected={draft.selectedNextRoleDesireSlugs} onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedNextRoleDesireSlugs: toggleSlug(d.selectedNextRoleDesireSlugs, slug, on) } : d))} />
      <LongField label="Goals notes" optional exampleKey="whatYouWantNextNote" seniorityTarget={st} className="min-h-[80px]" value={draft.whatYouWantNextNote} onChange={(e) => patch('whatYouWantNextNote', e.target.value)} />
      <CheckboxGrid title="Hard boundaries" hint="Select any that apply" entries={DEALBREAKER_SLUGS} selected={draft.selectedDealbreakerSlugs} onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedDealbreakerSlugs: toggleSlug(d.selectedDealbreakerSlugs, slug, on) } : d))} />
      <LongField label="Deal-breaker notes" optional exampleKey="dealBreakersOtherNote" seniorityTarget={st} className="min-h-[80px]" value={draft.dealBreakersOtherNote} onChange={(e) => patch('dealBreakersOtherNote', e.target.value)} />
    </div>
  )
}

function StepWorkStyle({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const st = draft.seniorityTarget
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Preferred work arrangement" options={WORK_ARRANGEMENT_OPTIONS} value={draft.workArrangement} onChange={(v) => patch('workArrangement', v)} />
        <SelectField label="Team size you thrive in" options={TEAM_SIZE_OPTIONS} value={draft.teamSizePreference} onChange={(v) => patch('teamSizePreference', v)} />
        <SelectField label="Compensation band (USD equiv)" options={COMPENSATION_BAND_OPTIONS} value={draft.compensationBand} onChange={(v) => patch('compensationBand', v)} />
      </div>
      <LongField label="Compensation context" optional exampleKey="compensationExtraNote" seniorityTarget={st} className="min-h-[80px]" value={draft.compensationExtraNote} onChange={(e) => patch('compensationExtraNote', e.target.value)} hint="Equity vs cash, geo, seniority negotiation" />
      <div className="grid gap-3 sm:grid-cols-3">
        <BooleanField label="Open to meaningful equity" checked={draft.openToEquity} onChange={(v) => patch('openToEquity', v)} />
        <BooleanField label="Open to contract / C2C" checked={draft.openToContract} onChange={(v) => patch('openToContract', v)} />
        <BooleanField label="Willing to relocate" checked={draft.openToRelocate} onChange={(v) => patch('openToRelocate', v)} />
      </div>
      <SelectField label="Work authorization" options={VISA_STATUS_OPTIONS} value={draft.visaStatus} onChange={(v) => patch('visaStatus', v)} />
      <BooleanField label="I will need visa sponsorship" checked={draft.needsVisaSponsorship} onChange={(v) => patch('needsVisaSponsorship', v)} />
      <LongField label="Work authorization notes" optional exampleKey="workAuthOtherNote" seniorityTarget={st} className="min-h-[80px]" value={draft.workAuthOtherNote} onChange={(e) => patch('workAuthOtherNote', e.target.value)} />
    </div>
  )
}

export function ProfileWizard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ApplicantProfileDraft | null>(null)
  const baselineJson = useRef<string | null>(null)
  const hydrated = useRef(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const prevUserId = useRef<string | undefined>(undefined)

  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })

  const { data: serverDraft, isPending, isError, error, refetch } = useQuery({
    queryKey: applicantProfileQueryKeyFor(user?.id ?? ''),
    queryFn: fetchApplicantProfile,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: Boolean(user?.id),
  })

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
    trackOnce('profile-step-1', 'Profile Step 1')
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
          innerId = window.setTimeout(() => { if (!cancelled) setSavedFlash(false) }, 2000)
        } catch (e) {
          if (!cancelled) setSaveError(e instanceof Error ? e.message : 'Save failed')
        }
      })()
    }, 750)
    return () => {
      cancelled = true
      clearTimeout(outerId)
      if (innerId !== undefined) clearTimeout(innerId)
    }
  }, [draft, queryClient, user?.id])

  function patch<K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  function updateProject(id: string, partial: Partial<ProjectEntry>) {
    setDraft((d) => (d ? { ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...partial } : p)) } : d))
  }

  function addProject() {
    setDraft((d) => (d ? { ...d, projects: [...d.projects, newProjectEntry()] } : d))
  }

  function removeProject(id: string) {
    const min = minProjectsRequired(deriveProfileMode(draft!))
    setDraft((d) => (d ? { ...d, projects: d.projects.length <= min ? d.projects : d.projects.filter((p) => p.id !== id) } : d))
  }

  function updateWorkEntry(id: string, partial: Partial<WorkEntry>) {
    setDraft((d) => (d ? { ...d, workEntries: d.workEntries.map((e) => (e.id === id ? { ...e, ...partial } : e)) } : d))
  }

  function addWorkEntry() {
    setDraft((d) => (d ? { ...d, workEntries: [...d.workEntries, newWorkEntry()] } : d))
  }

  function removeWorkEntry(id: string) {
    setDraft((d) => (d ? { ...d, workEntries: d.workEntries.length <= 1 ? d.workEntries : d.workEntries.filter((e) => e.id !== id) } : d))
  }

  async function handleSubmit() {
    if (!draft || !user?.id) return
    if (!isApplicantProfileComplete(draft)) {
      setSaveError('Complete every step before saving your profile.')
      return
    }
    setSaveError(null)
    setSubmitting(true)
    try {
      await submitApplicantProfile(draft)
      baselineJson.current = JSON.stringify(draft)
      setApplicantProfileCache(queryClient, user.id, draft)
      trackEvent('Profile Submit')
      await router.invalidate()
      await navigate({ to: '/' })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to load your profile.</p>
  }

  if (isPending && !draft) {
    return <p className="text-sm text-muted-foreground">Loading profile\u2026</p>
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-5">
        <p className="font-medium text-destructive">Could not load profile</p>
        <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>
      </div>
    )
  }

  if (!draft) {
    return <p className="text-sm text-muted-foreground">No profile data yet.</p>
  }

  const steps = getWizardSteps(draft)
  const safeStep = Math.min(step, steps.length - 1)
  const currentStep = steps[safeStep]
  const profile = draft
  const isFirst = safeStep === 0
  const isLast = safeStep === steps.length - 1
  const allComplete = isApplicantProfileComplete(draft)

  function goNext() {
    if (safeStep < steps.length - 1) setStep(safeStep + 1)
  }

  function goPrev() {
    if (safeStep > 0) setStep(safeStep - 1)
  }

  function renderStepContent() {
    switch (currentStep.id) {
      case 'basics':
        return <StepBasics draft={profile} patch={patch} />
      case 'targets':
        return <StepTargets draft={profile} patch={patch} setDraft={setDraft} />
      case 'education':
        return <StepEducation draft={profile} patch={patch} />
      case 'work-history':
        return (
          <StepWorkHistory
            draft={profile}
            updateWorkEntry={updateWorkEntry}
            addWorkEntry={addWorkEntry}
            removeWorkEntry={removeWorkEntry}
          />
        )
      case 'experience':
        return <StepExperience draft={profile} patch={patch} />
      case 'resume-upload':
        return (
          <StepResumeUpload
            draft={profile}
            onResumeSaved={(updates) => {
              setDraft((d) => (d ? { ...d, ...updates } : d))
            }}
            onComplete={() => { setStep(safeStep + 1) }}
          />
        )
      case 'skills':
        return <StepSkills draft={profile} patch={patch} setDraft={setDraft} />
      case 'projects':
        return (
          <StepProjects
            draft={profile}
            updateProject={updateProject}
            addProject={addProject}
            removeProject={removeProject}
          />
        )
      case 'stories':
        return <StepStories draft={profile} patch={patch} />
      case 'goals':
        return <StepGoals draft={profile} patch={patch} setDraft={setDraft} />
      case 'work-style':
        return <StepWorkStyle draft={profile} patch={patch} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {!allComplete ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-sm font-medium text-foreground">
            Take your time — the more detail you share, the better we can match roles and tailor
            applications that sound like you.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{describeOnceLine}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{truthPledge}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {currentStep.title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Step {safeStep + 1} of {steps.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash ? (
            <span className="text-xs text-primary">Saved</span>
          ) : null}
          {saveError ? (
            <span className="max-w-40 truncate text-right text-xs text-destructive">{saveError}</span>
          ) : null}
        </div>
      </div>

      <ProgressBar steps={steps} current={safeStep} draft={draft} onStepClick={(i) => setStep(i)} />

      <div className="rounded-md border bg-card p-4 sm:p-6">
        {renderStepContent()}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={goPrev}
          disabled={isFirst}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {!isLast ? (
            <Button onClick={goNext} className="gap-1.5">
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {!allComplete ? (
                <span className="text-xs text-muted-foreground">Complete every step to save</span>
              ) : null}
              <Button onClick={() => void handleSubmit()} disabled={submitting || !allComplete} className="gap-1.5">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Saving\u2026' : 'Save profile'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

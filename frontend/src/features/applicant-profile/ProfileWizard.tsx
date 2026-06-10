import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { trackEvent, trackOnce } from '@/lib/analytics'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Upload,
} from 'lucide-react'
import type { ApplicantProfileDraft, ProjectEntry, WorkEntry } from './types'
import { newProjectEntry, newWorkEntry } from './types'
import {
  getInitialWizardStep,
  isApplicantProfileComplete,
  isWizardStepComplete,
  isWizardStepReachable,
  workHistorySummary,
} from './profileCompletion'
import { getWizardSteps, needsStateOrProvince, type WizardStepDef } from './profileMode'
import { mergeParsedProfile } from './mergeParsedProfile'
import { prepareProfileForSubmit } from './prepareProfileForSubmit'
import {
  CA_PROVINCE_OPTIONS,
  COMPENSATION_BAND_OPTIONS,
  DISCIPLINE_OPTIONS,
  ENGLISH_PROFICIENCY_OPTIONS,
  MAJOR_MARKET_AUTH_OPTIONS,
  OTHER_AUTHORIZED_COUNTRY_OPTIONS,
  PROJECT_KIND_OPTIONS,
  PROJECT_PRIMARY_TECH_OPTIONS,
  REGION_OPTIONS,
  SENIORITY_OPTIONS,
  STACK_YEAR_FIELD_DEFS,
  STACK_YEARS_OPTIONS,
  START_AVAILABILITY_OPTIONS,
  TIMEZONE_OPTIONS,
  TOOL_SLUGS,
  US_STATE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  WORK_ENTRY_TYPE_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  type SelectOption,
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

const SELECT_EMPTY = 'Select an option'

function toggleSlug(list: string[], slug: string, on: boolean): string[] {
  if (on) return list.includes(slug) ? list : [...list, slug]
  return list.filter((s) => s !== slug)
}

function visibleStackYearFields(draft: ApplicantProfileDraft) {
  return STACK_YEAR_FIELD_DEFS.filter((def) => {
    if (!def.toolSlugs?.length) return true
    return def.toolSlugs.some((t) => draft.selectedToolSlugs.includes(t))
  })
}

type MajorMarketAuth = '' | 'yes' | 'needs_sponsorship'

function readMajorMarketAuth(
  market: 'us' | 'ca',
  draft: ApplicantProfileDraft,
): MajorMarketAuth {
  const authorized = market === 'us' ? draft.workAuthorizedInUS : draft.workAuthorizedInCanada
  if (authorized) return 'yes'
  if (draft.authorizedCountries.includes(market)) return 'yes'
  if (draft.needsVisaSponsorship) return 'needs_sponsorship'
  return ''
}

function applyMajorMarketAuth(
  draft: ApplicantProfileDraft,
  market: 'us' | 'ca',
  value: MajorMarketAuth,
): ApplicantProfileDraft {
  const us = market === 'us' ? value : readMajorMarketAuth('us', draft)
  const ca = market === 'ca' ? value : readMajorMarketAuth('ca', draft)
  let authorizedCountries = draft.authorizedCountries.filter((c) => c !== 'us' && c !== 'ca')

  const workAuthorizedInUS = us === 'yes'
  const workAuthorizedInCanada = ca === 'yes'
  if (workAuthorizedInUS) authorizedCountries = [...authorizedCountries, 'us']
  if (workAuthorizedInCanada) authorizedCountries = [...authorizedCountries, 'ca']

  const needsVisaSponsorship = us === 'needs_sponsorship' || ca === 'needs_sponsorship'

  return {
    ...draft,
    workAuthorizedInUS,
    workAuthorizedInCanada,
    authorizedCountries,
    needsVisaSponsorship,
  }
}

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
      <Select value={value === '' ? null : value} onValueChange={(v) => onChange(v ?? '')} items={selectable}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={SELECT_EMPTY}>
            {(current) => {
              if (current == null || current === '') {
                return <span className="text-muted-foreground">{SELECT_EMPTY}</span>
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

function ChipGrid({
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
      <div className="flex flex-wrap gap-2">
        {entries.map(([slug, lab]) => {
          const isSelected = selected.includes(slug)
          return (
            <button
              key={slug}
              type="button"
              onClick={() => onToggle(slug, !isSelected)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-accent/50'
              }`}
            >
              {lab}
            </button>
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
  steps: WizardStepDef[]
  current: number
  draft: ApplicantProfileDraft
  onStepClick?: (i: number) => void
}) {
  const completed = steps.map((s) => isWizardStepComplete(s.id, draft))
  return (
    <div className="space-y-3">
      <div className="hidden gap-0 sm:flex">
        {steps.map((step, i) => {
          const isComplete = completed[i]
          const isCurrent = i === current
          const reachable = isWizardStepReachable(i, steps, draft, current)
          const clickable = reachable && onStepClick
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
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isComplete
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span className={`hidden text-xs font-medium md:inline ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.shortTitle}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${isComplete ? 'bg-primary/40' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 sm:hidden">
        <span className="text-sm font-medium">Step {current + 1} of {steps.length}</span>
        <div className="flex flex-1 gap-1">
          {steps.map((_, i) => {
            const reachable = isWizardStepReachable(i, steps, draft, current)
            return (
              <button
                key={i}
                type="button"
                disabled={!reachable || !onStepClick}
                onClick={() => onStepClick?.(i)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= current ? 'bg-primary' : 'bg-muted'
                } ${reachable && onStepClick ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={`Go to step ${i + 1}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepResume({
  draft,
  onParsed,
}: {
  draft: ApplicantProfileDraft
  onParsed: (parsed: ApplicantProfileDraft) => void
}) {
  const [mode, setMode] = useState<'upload' | 'paste'>(draft.resumePlainText.trim() ? 'upload' : 'upload')
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (localPdfUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(localPdfUrl)
      }
    }
  }, [localPdfUrl])

  function setLocalPdfPreview(file: File) {
    setLocalPdfUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setUploadedFileName(file.name)
  }

  async function handlePdf(f: File) {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file')
      return
    }
    setError(null)
    setBusy(true)
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
        pages.push((content.items as Array<{ str?: string }>).map((item) => item.str ?? '').join(' '))
      }
      const extractedText = pages.join('\n\n')
      if (!extractedText.trim()) {
        setError('Could not extract text from this PDF. Try pasting the text instead.')
        return
      }
      setLocalPdfPreview(f)
      const { uploadResume } = await import('@/lib/resumeApi')
      const result = await uploadResume(f, extractedText)
      onParsed(mergeParsedProfile(draft, result.profile))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process resume')
    } finally {
      setBusy(false)
    }
  }

  async function handlePasteParse() {
    const text = pasteText.trim()
    if (!text) {
      setError('Paste your resume text first')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const { parseResumeText } = await import('@/lib/resumeApi')
      const parsed = await parseResumeText(text)
      setUploadedFileName(null)
      setLocalPdfUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      onParsed(mergeParsedProfile(draft, parsed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse resume')
    } finally {
      setBusy(false)
    }
  }

  const hasResume = Boolean(draft.resumePlainText.trim())
  const pdfPreviewUrl = draft.resumePdfUrl.trim() || localPdfUrl

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Upload a PDF or paste your resume text. We parse it in the background to pre-fill the next steps.
      </p>

      {hasResume && !busy ? (
        <div className="overflow-hidden rounded-md border bg-muted/20">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Your resume</p>
              <p className="text-xs text-muted-foreground">
                {uploadedFileName ?? (pdfPreviewUrl ? 'Uploaded PDF' : 'Parsed from text')}
              </p>
            </div>
            <span className="text-xs font-medium text-primary">Parsed</span>
          </div>
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              title="Your uploaded resume"
              className="h-[min(560px,70vh)] w-full bg-white"
            />
          ) : (
            <div className="max-h-[min(560px,70vh)] overflow-y-auto bg-background p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {draft.resumePlainText}
              </pre>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setMode('upload')}>
          Upload PDF
        </Button>
        <Button type="button" variant={mode === 'paste' ? 'default' : 'outline'} size="sm" onClick={() => setMode('paste')}>
          Paste text
        </Button>
      </div>

      {mode === 'upload' ? (
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-10 transition-all ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          } ${hasResume && !busy ? 'p-6' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handlePdf(f) }}
          onClick={() => document.getElementById('lean-resume-input')?.click()}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Parsing resume…</span>
            </div>
          ) : (
            <>
              <Upload className={`text-muted-foreground ${hasResume ? 'mb-2 size-6' : 'mb-3 size-8'}`} />
              <span className="text-sm font-medium text-muted-foreground">
                {hasResume ? 'Upload a different PDF' : 'Drop PDF here or click to browse'}
              </span>
              <span className="mt-1 text-xs text-muted-foreground/60">PDF only</span>
            </>
          )}
          <input id="lean-resume-input" type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePdf(f) }} />
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            className="min-h-[240px] font-mono text-sm"
            placeholder="Paste your full resume text here…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={busy}
          />
          <Button type="button" onClick={() => void handlePasteParse()} disabled={busy || !pasteText.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? 'Parsing…' : hasResume ? 'Re-parse resume' : 'Parse resume'}
          </Button>
        </div>
      )}

      {hasResume && !busy ? (
        <p className="text-sm text-primary">Resume uploaded — continue to confirm your details.</p>
      ) : null}

      {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
    </div>
  )
}

function WorkHistoryPanel({
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
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-accent/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{workHistorySummary(draft)}</span>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open ? (
        <div className="space-y-4 border-t px-4 py-4">
          {draft.workEntries.map((entry, index) => (
            <fieldset key={entry.id} className="rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">Role {index + 1}</legend>
              <div className="mt-2 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Company</Label>
                    <Input value={entry.company} onChange={(e) => updateWorkEntry(entry.id, { company: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Role title</Label>
                    <Input value={entry.role} onChange={(e) => updateWorkEntry(entry.id, { role: e.target.value })} />
                  </div>
                </div>
                <SelectField label="Type" options={WORK_ENTRY_TYPE_OPTIONS} value={entry.employmentType} onChange={(v) => updateWorkEntry(entry.id, { employmentType: v })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Start</Label>
                    <Input placeholder="Jan 2022" value={entry.startDate} onChange={(e) => updateWorkEntry(entry.id, { startDate: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End</Label>
                    <Input placeholder="Present" value={entry.endDate} onChange={(e) => updateWorkEntry(entry.id, { endDate: e.target.value })} />
                  </div>
                </div>
                <BooleanField label="Currently here" checked={entry.isCurrent} onChange={(v) => updateWorkEntry(entry.id, { isCurrent: v })} />
                <div className="grid gap-1.5">
                  <Label>Summary bullets</Label>
                  <Textarea className="min-h-[80px]" value={entry.summaryBullets} onChange={(e) => updateWorkEntry(entry.id, { summaryBullets: e.target.value })} />
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive" disabled={draft.workEntries.length <= 1} onClick={() => removeWorkEntry(entry.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            </fieldset>
          ))}
          <Button variant="outline" className="w-full border-dashed" onClick={addWorkEntry}>
            + Add role
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function StepBasics({
  draft,
  patch,
  updateWorkEntry,
  addWorkEntry,
  removeWorkEntry,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  updateWorkEntry: (id: string, partial: Partial<WorkEntry>) => void
  addWorkEntry: () => void
  removeWorkEntry: (id: string) => void
}) {
  const stateOptions = draft.region === 'ca' ? CA_PROVINCE_OPTIONS : US_STATE_OPTIONS
  const stateLabel = draft.region === 'ca' ? 'Province / territory' : 'State'

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Confirm what we parsed from your resume. Your sign-in email is used for applications.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Full name</Label>
          <Input value={draft.fullName} onChange={(e) => patch('fullName', e.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-1.5">
          <Label>Phone</Label>
          <Input type="tel" value={draft.phoneNumber} onChange={(e) => patch('phoneNumber', e.target.value)} autoComplete="tel" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>City</Label>
          <Input value={draft.cityOrDetail} onChange={(e) => patch('cityOrDetail', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Country</Label>
          <Input
            value={draft.country}
            onChange={(e) => patch('country', e.target.value)}
            placeholder="e.g. Nigeria, United States"
            autoComplete="country-name"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Region" hint="" options={REGION_OPTIONS} value={draft.region} onChange={(v) => patch('region', v)} />
        <SelectField label="Timezone" options={TIMEZONE_OPTIONS} value={draft.timezone} onChange={(v) => patch('timezone', v)} />
      </div>
      {draft.timezone === 'other' ? (
        <div className="grid gap-1.5">
          <Label>Timezone detail</Label>
          <Input
            value={draft.timezoneOtherNote}
            onChange={(e) => patch('timezoneOtherNote', e.target.value)}
            placeholder="IANA zone or offset, e.g. Africa/Lagos"
          />
        </div>
      ) : null}
      {needsStateOrProvince(draft.region) ? (
        <SelectField label={stateLabel} options={stateOptions} value={draft.stateOrProvince} onChange={(v) => patch('stateOrProvince', v)} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Current company</Label>
          <Input value={draft.currentCompany} onChange={(e) => patch('currentCompany', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Headline</Label>
          <Input value={draft.headline} onChange={(e) => patch('headline', e.target.value)} placeholder="e.g. Senior Backend Engineer" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>LinkedIn <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="url" value={draft.linkedInUrl} onChange={(e) => patch('linkedInUrl', e.target.value)} placeholder="https://linkedin.com/in/…" />
        </div>
        <div className="grid gap-1.5">
          <Label>GitHub <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="url" value={draft.githubUrl} onChange={(e) => patch('githubUrl', e.target.value)} placeholder="https://github.com/…" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Portfolio or personal site <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input
          type="url"
          value={draft.portfolioUrl}
          onChange={(e) => patch('portfolioUrl', e.target.value)}
          placeholder="https://… — GitHub is fine if you have no separate site"
        />
      </div>
      <WorkHistoryPanel draft={draft} updateWorkEntry={updateWorkEntry} addWorkEntry={addWorkEntry} removeWorkEntry={removeWorkEntry} />
    </div>
  )
}

function StepPreferences({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Years of experience" options={YEARS_EXPERIENCE_OPTIONS} value={draft.yearsExperience} onChange={(v) => patch('yearsExperience', v)} />
        <SelectField label="Seniority target" options={SENIORITY_OPTIONS} value={draft.seniorityTarget} onChange={(v) => patch('seniorityTarget', v)} hint="We match at or above your target." />
        <SelectField label="Primary discipline" options={DISCIPLINE_OPTIONS} value={draft.primaryDiscipline} onChange={(v) => patch('primaryDiscipline', v)} />
      </div>
      {draft.primaryDiscipline === 'other' ? (
        <div className="grid gap-1.5">
          <Label>Describe discipline</Label>
          <Input value={draft.disciplineOtherNote} onChange={(e) => patch('disciplineOtherNote', e.target.value)} />
        </div>
      ) : null}
      <SelectField label="Remote / hybrid / onsite preference" options={WORK_ARRANGEMENT_OPTIONS} value={draft.workArrangement} onChange={(v) => patch('workArrangement', v)} />
      <SelectField
        label="English proficiency"
        hint="Many application forms ask for this — be honest"
        options={ENGLISH_PROFICIENCY_OPTIONS}
        value={draft.englishProficiency}
        onChange={(v) => patch('englishProficiency', v)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <BooleanField label="Open to contract roles" checked={draft.openToContract} onChange={(v) => patch('openToContract', v)} />
        <BooleanField label="Open to relocate" checked={draft.openToRelocate} onChange={(v) => patch('openToRelocate', v)} />
      </div>
    </div>
  )
}

function WorkAuthorizationPanel({
  draft,
  setDraft,
  patch,
}: {
  draft: ApplicantProfileDraft
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const usAuth = readMajorMarketAuth('us', draft)
  const caAuth = readMajorMarketAuth('ca', draft)
  const otherSelected = draft.authorizedCountries.filter((c) => c !== 'us' && c !== 'ca')
  const showNotes =
    usAuth === 'needs_sponsorship' ||
    caAuth === 'needs_sponsorship' ||
    otherSelected.includes('other') ||
    Boolean(draft.workAuthOtherNote.trim())

  return (
    <fieldset className="grid gap-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Work authorization</legend>
      <p className="text-xs text-muted-foreground -mt-2">
        US and Canada job forms ask about sponsorship separately. For other countries, select everywhere you can work without needing a visa.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="United States"
          options={MAJOR_MARKET_AUTH_OPTIONS}
          value={usAuth}
          onChange={(v) =>
            setDraft((d) => (d ? applyMajorMarketAuth(d, 'us', v as MajorMarketAuth) : d))
          }
        />
        <SelectField
          label="Canada"
          options={MAJOR_MARKET_AUTH_OPTIONS}
          value={caAuth}
          onChange={(v) =>
            setDraft((d) => (d ? applyMajorMarketAuth(d, 'ca', v as MajorMarketAuth) : d))
          }
        />
      </div>
      <ChipGrid
        title="Other countries"
        hint="Where you can legally work without visa sponsorship — select all that apply"
        entries={OTHER_AUTHORIZED_COUNTRY_OPTIONS}
        selected={otherSelected}
        onToggle={(slug, on) =>
          setDraft((d) => {
            if (!d) return d
            const withoutMajor = d.authorizedCountries.filter((c) => c !== 'us' && c !== 'ca')
            const nextOther = toggleSlug(withoutMajor, slug, on)
            const major: string[] = []
            if (d.workAuthorizedInUS) major.push('us')
            if (d.workAuthorizedInCanada) major.push('ca')
            return { ...d, authorizedCountries: [...major, ...nextOther] }
          })
        }
      />
      {showNotes ? (
        <div className="grid gap-1.5">
          <Label>Work authorization notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea
            className="min-h-[72px]"
            value={draft.workAuthOtherNote}
            onChange={(e) => patch('workAuthOtherNote', e.target.value)}
            placeholder="e.g. Nigeria citizen; open to US roles with H-1B sponsorship"
          />
        </div>
      ) : null}
    </fieldset>
  )
}

function FeaturedProjectPanel({
  draft,
  patch,
  updateProject,
  setDraft,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  updateProject: (id: string, partial: Partial<ProjectEntry>) => void
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
}) {
  const parsed = draft.projects.filter((p) => p.title.trim() || p.summary.trim())
  const featuredId = draft.featuredProjectId || parsed[0]?.id || ''
  const featured = draft.projects.find((p) => p.id === featuredId) ?? draft.projects[0]

  function selectFeatured(id: string) {
    patch('featuredProjectId', id)
  }

  function ensureManualProject() {
    const manual = newProjectEntry()
    setDraft((d) => {
      if (!d) return d
      return { ...d, projects: [...d.projects, manual], featuredProjectId: manual.id }
    })
  }

  return (
    <div className="space-y-4">
      <Label>Featured project</Label>
      <p className="text-xs text-muted-foreground -mt-2">Pick one project for matching and form answers, or enter your own.</p>
      {parsed.length > 0 ? (
        <div className="grid gap-2">
          {parsed.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input type="radio" name="featured" className="mt-1" checked={featuredId === p.id} onChange={() => selectFeatured(p.id)} />
              <span>
                <span className="text-sm font-medium">{p.title || 'Untitled project'}</span>
                {p.summary ? <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{p.summary}</span> : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={ensureManualProject}>
        Enter a project manually
      </Button>
      {featured ? (
        <fieldset className="rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Project details</legend>
          <div className="mt-2 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Type" options={PROJECT_KIND_OPTIONS} value={featured.kind} onChange={(v) => updateProject(featured.id, { kind: v })} />
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={featured.title} onChange={(e) => updateProject(featured.id, { title: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>What you built</Label>
              <Textarea className="min-h-[100px]" value={featured.summary} onChange={(e) => updateProject(featured.id, { summary: e.target.value })} />
            </div>
            <SelectField label="Primary tech" options={PROJECT_PRIMARY_TECH_OPTIONS} value={featured.primaryTechSlug} onChange={(v) => updateProject(featured.id, { primaryTechSlug: v })} />
            <div className="grid gap-1.5">
              <Label>Link <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input type="url" value={featured.link} onChange={(e) => updateProject(featured.id, { link: e.target.value })} />
            </div>
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}

function StepStackLogistics({
  draft,
  patch,
  setDraft,
  updateProject,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
  setDraft: React.Dispatch<React.SetStateAction<ApplicantProfileDraft | null>>
  updateProject: (id: string, partial: Partial<ProjectEntry>) => void
}) {
  const stackYearFields = visibleStackYearFields(draft)

  function patchStackYear(key: string, value: string) {
    setDraft((d) => (d ? { ...d, stackYears: { ...d.stackYears, [key]: value } } : d))
  }

  return (
    <div className="space-y-5">
      <ChipGrid
        title="Tech stack"
        hint="Confirm tools from your resume — tap to toggle"
        entries={TOOL_SLUGS}
        selected={draft.selectedToolSlugs}
        onToggle={(slug, on) => setDraft((d) => (d ? { ...d, selectedToolSlugs: toggleSlug(d.selectedToolSlugs, slug, on) } : d))}
      />
      {stackYearFields.length > 0 ? (
        <fieldset className="grid gap-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Years per technology</legend>
          <p className="text-xs text-muted-foreground -mt-1">Optional — helps pre-fill job application forms</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {stackYearFields.map((def) => (
              <SelectField
                key={def.key}
                label={def.label}
                options={STACK_YEARS_OPTIONS}
                value={draft.stackYears[def.key] ?? ''}
                onChange={(v) => patchStackYear(def.key, v)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="grid gap-1.5">
        <Label>Other tools <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={draft.toolsOtherNote} onChange={(e) => patch('toolsOtherNote', e.target.value)} placeholder="Anything not in the list above" />
      </div>
      <SelectField label="Salary expectation (USD equivalent)" options={COMPENSATION_BAND_OPTIONS} value={draft.compensationBand} onChange={(v) => patch('compensationBand', v)} />
      <WorkAuthorizationPanel draft={draft} setDraft={setDraft} patch={patch} />
      <SelectField label="Start availability" options={START_AVAILABILITY_OPTIONS} value={draft.startAvailability} onChange={(v) => patch('startAvailability', v)} />
      <FeaturedProjectPanel draft={draft} patch={patch} updateProject={updateProject} setDraft={setDraft} />
    </div>
  )
}

function StepStory({
  draft,
  patch,
}: {
  draft: ApplicantProfileDraft
  patch: <K extends keyof ApplicantProfileDraft>(key: K, value: ApplicantProfileDraft[K]) => void
}) {
  const [showExtra, setShowExtra] = useState(
    Boolean(draft.proudestProfessionalWins.trim() || draft.storyDisagreementOrConflict.trim()),
  )
  const st = draft.seniorityTarget

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        One strong story powers behavioral form answers. Use real situations — we adapt tone per role without changing your facts.
      </p>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <Label>Hardest technical challenge</Label>
          <FieldExampleButton
            exampleKey="storyHardestTechnicalChallenge"
            seniorityTarget={st}
            questionOverride="Hardest technical challenge"
            showAllTiers
          />
        </div>
        <Textarea
          className="min-h-[140px]"
          value={draft.storyHardestTechnicalChallenge}
          onChange={(e) => patch('storyHardestTechnicalChallenge', e.target.value)}
          placeholder="Describe a hard technical problem you solved — context, what you did, outcome."
        />
      </div>
      {!showExtra ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowExtra(true)}>
          Add another story
        </Button>
      ) : (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">Optional second story</p>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <Label>Proudest win</Label>
              <FieldExampleButton
                exampleKey="proudestProfessionalWins"
                seniorityTarget={st}
                questionOverride="Proudest win"
                showAllTiers
              />
            </div>
            <Textarea
              className="min-h-[100px]"
              value={draft.proudestProfessionalWins}
              onChange={(e) => patch('proudestProfessionalWins', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <Label>Conflict or disagreement</Label>
              <FieldExampleButton
                exampleKey="storyDisagreementOrConflict"
                seniorityTarget={st}
                questionOverride="Conflict or disagreement"
                showAllTiers
              />
            </div>
            <Textarea
              className="min-h-[100px]"
              value={draft.storyDisagreementOrConflict}
              onChange={(e) => patch('storyDisagreementOrConflict', e.target.value)}
            />
          </div>
        </div>
      )}
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
  const stepInitialized = useRef(false)
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
      stepInitialized.current = false
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
    if (!draft || stepInitialized.current) return
    setStep(getInitialWizardStep(draft))
    stepInitialized.current = true
  }, [draft])

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
      const prepared = prepareProfileForSubmit(draft, user.email)
      await submitApplicantProfile(prepared)
      baselineJson.current = JSON.stringify(prepared)
      setApplicantProfileCache(queryClient, user.id, prepared)
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
    return <p className="text-sm text-muted-foreground">Loading profile…</p>
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
  const stepComplete = isWizardStepComplete(currentStep.id, draft)

  function goNext() {
    if (safeStep < steps.length - 1) setStep(safeStep + 1)
  }

  function goPrev() {
    if (safeStep > 0) setStep(safeStep - 1)
  }

  function renderStep() {
    switch (currentStep.id) {
      case 'resume':
        return (
          <StepResume
            draft={profile}
            onParsed={(parsed) => {
              setDraft((d) => (d ? mergeParsedProfile(d, parsed) : d))
            }}
          />
        )
      case 'basics':
        return (
          <StepBasics
            draft={profile}
            patch={patch}
            updateWorkEntry={updateWorkEntry}
            addWorkEntry={addWorkEntry}
            removeWorkEntry={removeWorkEntry}
          />
        )
      case 'preferences':
        return <StepPreferences draft={profile} patch={patch} />
      case 'stack-logistics':
        return <StepStackLogistics draft={profile} patch={patch} setDraft={setDraft} updateProject={updateProject} />
      case 'story':
        return <StepStory draft={profile} patch={patch} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {!allComplete ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-sm font-medium text-foreground">
            Four short steps after your resume — then we match roles and tailor applications from your profile.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{describeOnceLine}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{truthPledge}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{currentStep.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Step {safeStep + 1} of {steps.length}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash ? <span className="text-xs text-primary">Saved</span> : null}
          {saveError ? <span className="max-w-40 truncate text-right text-xs text-destructive">{saveError}</span> : null}
        </div>
      </div>

      <ProgressBar steps={steps} current={safeStep} draft={draft} onStepClick={(i) => setStep(i)} />

      <div className="rounded-md border bg-card p-4 sm:p-6">{renderStep()}</div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={goPrev} disabled={isFirst} className="gap-1.5">
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <div className="flex flex-col items-end gap-1">
          {!isLast ? (
            <>
              {!stepComplete && currentStep.id !== 'resume' ? (
                <span className="text-xs text-muted-foreground">Fill required fields to continue</span>
              ) : null}
              <Button onClick={goNext} disabled={currentStep.id !== 'resume' && !stepComplete} className="gap-1.5">
                Next
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              {!allComplete ? <span className="text-xs text-muted-foreground">Complete every step to save</span> : null}
              <Button onClick={() => void handleSubmit()} disabled={submitting || !allComplete} className="gap-1.5">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitting ? 'Saving…' : 'Save profile'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

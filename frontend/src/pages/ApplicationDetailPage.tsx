import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  ExternalLink,
  Download,
  Copy,
  Check,
  FileText,
  Send,
  Undo2,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react'
import {
  applicationsQueryKey,
  fetchApplications,
  markApplicationSent,
  resumePdfDownloadUrl,
  coverLetterPdfDownloadUrl,
  type TailoredApplication,
} from '@/lib/applicationsApi'
import { MatchInsightsPanel, MatchTierBadge } from '@/features/applications/MatchInsights'
import {
  buildApplicationPackageFields,
  showCollapsedCoverLetter,
  isCoverLetterPdfField,
  type ApplicationPackageField,
} from '@/features/applications/applicationPackage'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      disabled={!text.trim()}
      className="gap-1.5 text-xs"
    >
      {copied ? <Check className="size-3.5 text-chart-3" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="text-sm font-medium text-foreground">
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
  )
}

function TextFieldRow({ field }: { field: ApplicationPackageField }) {
  const display = field.value.trim() || '—'
  return (
    <div className="space-y-1.5">
      <FieldLabel label={field.label} required={field.required} />
      <div className="flex items-start justify-between gap-3 rounded-md border bg-surface-tertiary/30 px-3.5 py-2.5 text-sm">
        <span className={`min-w-0 flex-1 ${field.value.trim() ? 'text-content-secondary' : 'text-content-tertiary italic'}`}>
          {display}
        </span>
        {field.value.trim() ? <CopyButton text={field.value} /> : null}
      </div>
    </div>
  )
}

function CoverLetterFieldRow({ field }: { field: ApplicationPackageField }) {
  if (isCoverLetterPdfField(field)) {
    return (
      <div className="space-y-1.5">
        <FieldLabel label={field.label} required={field.required} />
        <iframe
          src={field.value}
          className="w-full rounded-md border bg-surface-tertiary/30"
          style={{ height: '60vh' }}
          title={field.label}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel label={field.label} required={field.required} />
        {field.value.trim() ? <CopyButton text={field.value} /> : null}
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border bg-surface-tertiary/30 p-4 font-sans text-sm leading-relaxed text-content-secondary">
        {field.value.trim() || '—'}
      </pre>
    </div>
  )
}

function ResumeFieldBlock({
  field,
  resumePdfUrl,
}: {
  field: ApplicationPackageField
  resumePdfUrl: string
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label={field.label} required={field.required} />
      <iframe
        src={resumePdfUrl}
        className="w-full rounded-md border bg-surface-tertiary/30"
        style={{ height: '70vh' }}
        title={field.label}
      />
    </div>
  )
}

function ApplicationPackageSection({ app }: { app: TailoredApplication }) {
  const fields = buildApplicationPackageFields(app)
  const hasCoverLetterExtra = showCollapsedCoverLetter(app)

  if (fields.length === 0 && !hasCoverLetterExtra) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Application package</h2>
      <p className="text-sm text-content-secondary">
        Fields are listed in the same order as the employer&apos;s application form.
        Every answer is grounded in your profile — we never invent experience or credentials.
      </p>

      <div className="space-y-4">
        {fields.map((field) => {
          if (field.kind === 'resume' && app.resumePdfUrl) {
            return (
              <ResumeFieldBlock
                key={`${field.label}-${field.fieldType}`}
                field={field}
                resumePdfUrl={app.resumePdfUrl}
              />
            )
          }
          if (field.kind === 'cover_letter') {
            return (
              <CoverLetterFieldRow key={`${field.label}-${field.fieldType}`} field={field} />
            )
          }
          return <TextFieldRow key={`${field.label}-${field.fieldType}`} field={field} />
        })}
      </div>

      {hasCoverLetterExtra ? (
        <details className="group rounded-md border bg-surface-tertiary/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span>View cover letter</span>
            <ChevronDown className="size-4 text-content-secondary transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            <div className="flex justify-end">
              <CopyButton text={app.tailoredCoverLetter} />
            </div>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-content-secondary">
              {app.tailoredCoverLetter}
            </pre>
          </div>
        </details>
      ) : null}
    </div>
  )
}

export function ApplicationDetailPage() {
  const { id } = useParams({ from: '/_authenticated/applications/$id' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: apps } = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
  })

  const app = apps?.find((a) => a.id === id) ?? null

  const mutation = useMutation({
    mutationFn: (sent: boolean) => markApplicationSent(app!.id, sent),
    onMutate: async (sent) => {
      await queryClient.cancelQueries({ queryKey: applicationsQueryKey })
      const prev = queryClient.getQueryData<TailoredApplication[]>(applicationsQueryKey)
      queryClient.setQueryData<TailoredApplication[]>(applicationsQueryKey, (old) =>
        old?.map((a) =>
          a.id === id
            ? { ...a, markedSent: sent, sentAt: sent ? new Date().toISOString() : null }
            : a,
        ),
      )
      return { prev }
    },
    onError: (_err, _sent, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(applicationsQueryKey, ctx.prev)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: applicationsQueryKey })
    },
  })

  if (!app) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/applications' })} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back to applications
        </Button>
        <Card className="shadow-whisper">
          <CardContent className="px-4 py-12 text-center">
            <FileText className="mx-auto mb-3 size-10 text-content-tertiary" />
            <p className="text-sm text-content-secondary">Application not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/applications' })} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
            app.markedSent ? 'bg-chart-3/15' : 'bg-primary/10'
          }`}>
            {app.markedSent ? (
              <Send className="size-5 text-chart-3" />
            ) : (
              <FileText className="size-5 text-primary" />
            )}
          </div>
          <div>
            <h1 className={`text-xl font-semibold tracking-tight sm:text-2xl ${
              app.markedSent ? 'text-content-secondary line-through' : ''
            }`}>
              {app.title}
            </h1>
            <p className="text-sm text-content-secondary">@{app.company}{app.location ? ` \u00b7 ${app.location}` : ''}</p>
            <div className="mt-2">
              <MatchTierBadge app={app} showScore />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {app.resumePdfUrl && (
          <a
            href={resumePdfDownloadUrl(app.id)}
            download={app.resumeFilename ?? undefined}
            className={buttonVariants({ variant: 'default', size: 'sm', className: 'gap-1.5' })}
          >
            <Download className="size-4" />
            Download Resume PDF
          </a>
        )}
        {app.coverLetterPdfUrl && (
          <a
            href={coverLetterPdfDownloadUrl(app.id)}
            download={app.coverLetterFilename ?? undefined}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
          >
            <Download className="size-4" />
            Download Cover Letter PDF
          </a>
        )}
        {app.applyUrl && (
          <a
            href={app.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
          >
            <ExternalLink className="size-4" />
            Open Apply Page
          </a>
        )}

        <div className="ml-auto">
          {app.markedSent ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-content-secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              <Undo2 className="size-3.5" />
              Mark as unsent
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-chart-3/30 text-chart-3 hover:bg-chart-3/10"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              <Send className="size-3.5" />
              Mark as sent
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <MatchInsightsPanel app={app} />

      <Separator />

      <ApplicationPackageSection app={app} />
    </div>
  )
}

import type { JobFormField, TailoredApplication } from '@/lib/applicationsApi'
import { dedupeJobFormFields } from './dedupeFormFields'

export function isResumeField(field: JobFormField): boolean {
  const label = field.label.toLowerCase()
  return (
    field.fieldType === 'file' &&
    (label.includes('resume') || label.includes('cv') || label.includes('résumé'))
  )
}

export function isCoverLetterField(field: JobFormField): boolean {
  const label = field.label.toLowerCase()
  return label.includes('cover letter') || (field.fieldType === 'file' && label.includes('cover'))
}

export function formHasCoverLetterField(fields: JobFormField[]): boolean {
  return fields.some(isCoverLetterField)
}

function looksLikePdfUrl(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v.startsWith('http') && v.includes('.pdf')
}

export interface ApplicationPackageField {
  label: string
  fieldType: string
  required: boolean
  value: string
  kind: 'resume' | 'cover_letter' | 'text'
}

function answerForField(
  field: JobFormField,
  index: number,
  answers: { label: string; value: string }[],
): string {
  const byIndex = answers[index]
  if (byIndex && byIndex.label === field.label) {
    return byIndex.value
  }
  return answers.find((a) => a.label === field.label)?.value ?? ''
}

/** Builds form-ordered fields for display, matching the job application form. */
export function buildApplicationPackageFields(
  app: TailoredApplication,
): ApplicationPackageField[] {
  const formFields = dedupeJobFormFields(
    app.jobFormFields.length > 0
      ? [...app.jobFormFields].sort((a, b) => a.position - b.position)
      : app.formAnswers.map((answer, index) => ({
          label: answer.label,
          fieldType: 'text',
          required: false,
          position: index,
        })),
  )

  return formFields.map((field, index) => {
    let kind: ApplicationPackageField['kind'] = 'text'
    if (isResumeField(field)) kind = 'resume'
    else if (isCoverLetterField(field)) kind = 'cover_letter'

    let value = answerForField(field, index, app.formAnswers)
    if (kind === 'cover_letter') {
      if (field.fieldType === 'file' && app.coverLetterPdfUrl?.trim()) {
        value = app.coverLetterPdfUrl
      } else if (!value.trim() || looksLikePdfUrl(value)) {
        value = app.tailoredCoverLetter
      }
    }

    return {
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      value,
      kind,
    }
  })
}

export function showCollapsedCoverLetter(app: TailoredApplication): boolean {
  return Boolean(
    app.tailoredCoverLetter.trim() &&
      !formHasCoverLetterField(app.jobFormFields),
  )
}

export function isCoverLetterPdfField(field: ApplicationPackageField): boolean {
  return field.kind === 'cover_letter' && field.fieldType === 'file' && looksLikePdfUrl(field.value)
}

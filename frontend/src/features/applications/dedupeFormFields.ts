import type { JobFormField } from '@/lib/applicationsApi'

function isResumeOrCoverUploadLabel(label: string): boolean {
  const l = label.toLowerCase()
  return (
    l.includes('resume') ||
    l.includes('cv') ||
    l.includes('cover letter') ||
    l.includes('curriculum vitae')
  )
}

/** Collapse duplicate ATS labels (file + textarea siblings). Prefer file uploads. */
export function dedupeJobFormFields(fields: JobFormField[]): JobFormField[] {
  if (fields.length <= 1) return fields

  const order: string[] = []
  const groups = new Map<string, JobFormField[]>()

  for (const field of fields) {
    const key = field.label.trim().toLowerCase()
    if (!groups.has(key)) {
      order.push(key)
      groups.set(key, [])
    }
    groups.get(key)!.push(field)
  }

  const out: JobFormField[] = []
  for (const key of order) {
    const candidates = groups.get(key)!
    let chosen = candidates[0]!
    if (candidates.length > 1) {
      if (isResumeOrCoverUploadLabel(chosen.label)) {
        chosen = candidates.find((f) => f.fieldType === 'file') ?? chosen
      } else {
        chosen = candidates.find((f) => f.fieldType !== 'textarea') ?? chosen
      }
    }
    out.push({ ...chosen, position: out.length })
  }
  return out
}

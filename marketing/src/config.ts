const appUrl = import.meta.env.PUBLIC_APP_URL ?? 'https://app.prismapply.com'
const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? 'https://prismapply.com'

export const site = {
  name: 'PrismApply',
  tagline: 'Put your best foot forward',
  description:
    'Tell your story once. PrismApply discovers matching roles and prepares tailored, truthful application packages for each one.',
  truthPledge:
    'Every resume, cover letter, and form answer is grounded in your profile. We never invent employers, dates, metrics, or experience.',
  describeOnce:
    'Describe yourself once — apply to many roles with packages tailored from the same story.',
  interviewPrep:
    'You focus on interview prep. We keep searching jobs and tailoring applications in the background.',
  problem:
    'Generic applications get ignored. Manually tailoring each one is exhausting — and it still does not scale.',
  url: siteUrl.replace(/\/$/, ''),
  appUrl: appUrl.replace(/\/$/, ''),
} as const

export function appPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${site.appUrl}${p}`
}

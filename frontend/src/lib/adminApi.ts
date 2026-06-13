import { apiFetch } from './api'
import type { TailoredApplication } from './applicationsApi'

export const adminStatsQueryKey = ['admin', 'stats'] as const
export const adminUsersQueryKey = (params: AdminListParams) => ['admin', 'users', params] as const
export const adminUserQueryKey = (id: string) => ['admin', 'users', id] as const
export const adminMatchesQueryKey = (params: AdminMatchListParams) => ['admin', 'matches', params] as const
export const adminMatchQueryKey = (id: string) => ['admin', 'matches', id] as const
export const adminApplicationsQueryKey = (params: AdminApplicationListParams) => ['admin', 'applications', params] as const
export const adminApplicationQueryKey = (id: string) => ['admin', 'applications', id] as const
export const adminJobRunsQueryKey = (params: AdminListParams) => ['admin', 'job-runs', params] as const

export type AdminListParams = {
  limit?: number
  offset?: number
  search?: string
  status?: string
}

export type AdminMatchListParams = AdminListParams & {
  userId?: string
  hasApplication?: boolean
}

export type AdminApplicationListParams = AdminListParams & {
  userId?: string
  markedSent?: boolean
}

export type AdminListResult<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type AdminStats = {
  totalUsers: number
  usersWithProfile: number
  usersWithSubmittedProfile: number
  totalMatches: number
  matchesWithApplications: number
  pendingMatches: number
  totalApplications: number
  completedApplications: number
  markedSentApplications: number
  totalJobs: number
  jobsLast7Days: number
  failedJobRuns: number
  pendingJobRuns: number
}

export type AdminUserListItem = {
  id: string
  email: string
  isAdmin: boolean
  createdAt: string
  hasProfile: boolean
  profileSubmittedAt?: string
  profileUpdatedAt?: string
  matchCount: number
  applicationCount: number
  sentCount: number
}

export type AdminUserDetail = AdminUserListItem & {
  profile?: Record<string, unknown>
}

export type AdminMatchListItem = {
  id: number
  userId: string
  userEmail: string
  jobId: string
  jobTitle: string
  jobCompany: string
  jobLocation?: string | null
  matchScore?: number
  matchedChunks?: number
  gatePassed?: boolean
  status: string
  hasApplication: boolean
  applicationId?: string
  scoreBreakdown?: TailoredApplication['scoreBreakdown']
  matchReason?: TailoredApplication['matchReason']
  adjudication?: TailoredApplication['adjudication']
  matchTier?: TailoredApplication['matchTier']
  matchTierLabel?: string
  createdAt: string
}

export type AdminApplicationListItem = TailoredApplication & {
  userId: string
  userEmail: string
}

export type AdminJobRunItem = {
  id: number
  jobType: string
  status: string
  attempts: number
  lastError?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  idempotencyKey: string
  payload?: Record<string, unknown>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    q.set(key, String(value))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await apiFetch('/api/admin/stats')
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminStats
}

export async function fetchAdminUsers(params: AdminListParams = {}): Promise<AdminListResult<AdminUserListItem>> {
  const res = await apiFetch(`/api/admin/users${buildQuery(params)}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminListResult<AdminUserListItem>
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await apiFetch(`/api/admin/users/${id}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminUserDetail
}

export async function fetchAdminMatches(params: AdminMatchListParams = {}): Promise<AdminListResult<AdminMatchListItem>> {
  const res = await apiFetch(`/api/admin/matches${buildQuery({
    ...params,
    hasApplication: params.hasApplication === undefined ? undefined : params.hasApplication ? 'true' : 'false',
  })}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminListResult<AdminMatchListItem>
}

export async function fetchAdminMatch(id: string): Promise<AdminMatchListItem> {
  const res = await apiFetch(`/api/admin/matches/${id}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminMatchListItem
}

export async function fetchAdminApplications(params: AdminApplicationListParams = {}): Promise<AdminListResult<AdminApplicationListItem>> {
  const res = await apiFetch(`/api/admin/applications${buildQuery({
    ...params,
    markedSent: params.markedSent === undefined ? undefined : params.markedSent ? 'true' : 'false',
  })}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminListResult<AdminApplicationListItem>
}

export async function fetchAdminApplication(id: string): Promise<AdminApplicationListItem> {
  const res = await apiFetch(`/api/admin/applications/${id}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminApplicationListItem
}

export async function fetchAdminJobRuns(params: AdminListParams = {}): Promise<AdminListResult<AdminJobRunItem>> {
  const res = await apiFetch(`/api/admin/job-runs${buildQuery(params)}`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AdminListResult<AdminJobRunItem>
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { adminUsersQueryKey, fetchAdminUsers } from '@/lib/adminApi'
import { AdminPagination, AdminSearchBar, formatDate } from '@/features/admin/AdminUi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 50

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: adminUsersQueryKey({ limit: PAGE_SIZE, offset, search }),
    queryFn: () => fetchAdminUsers({ limit: PAGE_SIZE, offset, search }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Users</h1>
        <p className="mt-1 text-sm text-content-secondary">All registered users and profile activity.</p>
      </div>

      <AdminSearchBar
        value={search}
        onChange={(v) => {
          setSearch(v)
          setOffset(0)
        }}
        placeholder="Search by email…"
      />

      {isLoading ? <div className="h-40 animate-pulse rounded-md bg-surface-tertiary" /> : null}
      {error ? <Card><CardContent className="py-5 text-sm text-destructive">{(error as Error).message}</CardContent></Card> : null}

      {data ? (
        <div className="overflow-x-auto rounded-md border bg-card shadow-whisper">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-surface-tertiary/40 text-left text-xs uppercase tracking-wide text-content-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Profile</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 font-medium">Apps</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0 hover:bg-surface-tertiary/30">
                  <td className="px-4 py-3">
                    <Link to="/admin/users/$id" params={{ id: user.id }} className="font-medium text-primary hover:underline">
                      {user.email}
                    </Link>
                    {user.isAdmin ? <Badge className="ml-2" variant="secondary">Admin</Badge> : null}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {user.profileSubmittedAt ? 'Submitted' : user.hasProfile ? 'Draft' : 'None'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{user.matchCount}</td>
                  <td className="px-4 py-3 tabular-nums">{user.applicationCount}</td>
                  <td className="px-4 py-3 tabular-nums">{user.sentCount}</td>
                  <td className="px-4 py-3 text-content-secondary">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={setOffset} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

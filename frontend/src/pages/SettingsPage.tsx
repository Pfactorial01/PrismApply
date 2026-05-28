import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, User } from 'lucide-react'
import { authMeQueryKey, fetchAuthMe } from '@/lib/auth'
import {
  defaultUserSettings,
  fetchUserSettings,
  saveUserSettings,
  userSettingsQueryKey,
  type MatchTierMode,
  type UserSettings,
} from '@/lib/settingsApi'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MATCH_TIER_ITEMS = [
  {
    value: 'strong_and_promising' as const,
    label: 'Strong and promising matches',
    description: 'Include roles that are a good fit and roles that are close but worth exploring.',
  },
  {
    value: 'strong_only' as const,
    label: 'Strong matches only',
    description: 'Only create applications for roles with the highest fit score.',
  },
]

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-whisper">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<UserSettings | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: userSettingsQueryKey,
    queryFn: fetchUserSettings,
    staleTime: 30_000,
  })

  const current = draft ?? settings ?? defaultUserSettings
  const isDirty =
    draft != null &&
    settings != null &&
    (draft.matchTierMode !== settings.matchTierMode ||
      draft.allowStretchMatches !== settings.allowStretchMatches)

  const saveMutation = useMutation({
    mutationFn: saveUserSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userSettingsQueryKey })
      setDraft(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    },
  })

  function patchMatchTierMode(value: MatchTierMode) {
    setDraft((prev) => ({
      ...(prev ?? settings ?? defaultUserSettings),
      matchTierMode: value,
    }))
    setSaved(false)
  }

  function patchAllowStretchMatches(checked: boolean) {
    setDraft((prev) => ({
      ...(prev ?? settings ?? defaultUserSettings),
      allowStretchMatches: checked,
    }))
    setSaved(false)
  }

  function onSave() {
    saveMutation.mutate(current)
  }

  function onReset() {
    const defaults = { ...defaultUserSettings }
    setDraft(defaults)
    saveMutation.mutate(defaults)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="mt-0.5 text-sm text-content-secondary">
          Account details and matching preferences.
        </p>
      </div>

      <SectionCard
        icon={User}
        title="Account"
        description="Sign-in details and profile data used to tailor applications."
      >
        <SettingRow label="Email" description="Used to sign in.">
          <Input
            className="w-56"
            value={user?.email ?? ''}
            readOnly
            disabled
            aria-label="Account email"
          />
        </SettingRow>
        <SettingRow
          label="Applicant profile"
          description="Resume, targets, and projects that power tailored packages."
        >
          <Button variant="outline" size="sm" render={<Link to="/profile" />}>
            Edit profile
          </Button>
        </SettingRow>
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        title="Matching"
        description="Control which discovered roles become tailored applications."
      >
        <SettingRow
          label="Match quality"
          description={
            MATCH_TIER_ITEMS.find((item) => item.value === current.matchTierMode)?.description
          }
        >
          <Select
            value={current.matchTierMode}
            onValueChange={(v) => v && patchMatchTierMode(v as MatchTierMode)}
            items={MATCH_TIER_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
            disabled={isLoading || saveMutation.isPending}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCH_TIER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value} label={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Stretch roles above your seniority target"
          description="When off, we only match and tailor roles at your target level (e.g. junior). Mid-level stretch matches require this opt-in."
        >
          <Checkbox
            checked={current.allowStretchMatches}
            onCheckedChange={(v) => patchAllowStretchMatches(v === true)}
            disabled={isLoading || saveMutation.isPending}
            aria-label="Allow stretch matches above seniority target"
          />
        </SettingRow>
      </SectionCard>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onSave}
          disabled={!isDirty || saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save preferences'}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={saveMutation.isPending || isLoading}>
          Reset to defaults
        </Button>
        {saved ? (
          <span className="text-sm text-success">Preferences saved.</span>
        ) : null}
        {saveMutation.isError ? (
          <span className="text-sm text-destructive">{saveMutation.error.message}</span>
        ) : null}
      </div>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TailoredApplication } from '@/lib/applicationsApi'
import {
  buildMatchSummary,
  classifyMatchTier,
  displayFitScore,
  hasMatchInsights,
  matchTierLabel,
  topMatchStrengths,
} from '@/features/applications/matchInsights'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Primary match classification badge for list and detail headers. */
export function MatchTierBadge({
  app,
  showScore = false,
  className,
}: {
  app: TailoredApplication
  showScore?: boolean
  className?: string
}) {
  const tier = classifyMatchTier(app)
  const label = matchTierLabel(app)
  if (!tier || !label) return null

  const score = displayFitScore(app)
  const isStrong = tier === 'strong'

  return (
    <Badge
      variant={isStrong ? 'default' : 'secondary'}
      className={cn(
        'shrink-0 text-xs font-medium',
        isStrong && 'bg-primary/90',
        !isStrong && 'bg-surface-tertiary text-content-secondary',
        className,
      )}
    >
      {label}
      {showScore && score != null ? (
        <span className="ml-1 font-normal tabular-nums opacity-80">· {score}%</span>
      ) : null}
    </Badge>
  )
}

/** @deprecated Use MatchTierBadge */
export function MatchFitBadge({ app }: { app: TailoredApplication }) {
  return <MatchTierBadge app={app} showScore />
}

/** Compact match summary for detail view. */
export function MatchInsightsPanel({
  app,
  compact = false,
}: {
  app: TailoredApplication
  compact?: boolean
}) {
  if (!hasMatchInsights(app)) return null

  if (compact) {
    return <MatchTierBadge app={app} showScore />
  }

  const summary = buildMatchSummary(app)
  const strengths = topMatchStrengths(app)

  if (!summary && strengths.length === 0) return null

  return (
    <Card className="shadow-whisper">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          Why this match
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {summary ? (
          <p className="text-sm leading-relaxed text-content-secondary">{summary}</p>
        ) : null}
        {strengths.length > 0 ? (
          <ul className="space-y-1 text-sm text-content-secondary">
            {strengths.map((item) => (
              <li key={item} className="leading-snug before:mr-2 before:text-content-tertiary before:content-['•']">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

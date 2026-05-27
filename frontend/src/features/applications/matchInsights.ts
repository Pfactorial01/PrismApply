import type { TailoredApplication } from '@/lib/applicationsApi'

/** Minimum 0–100 fit score for "Strong Match". Settings will reuse this later. */
export const STRONG_MATCH_MIN_FIT_SCORE = 75

export type MatchTier = 'strong' | 'promising'

export const MATCH_TIER_LABELS: Record<MatchTier, string> = {
  strong: 'Strong Match',
  promising: 'Promising Match',
}

/** Display match strength as a 0–100 percentage from vector scoring (not LLM adjudication). */
export function displayFitScore(app: TailoredApplication): number | null {
  if (app.scoreBreakdown?.finalScore != null) {
    return Math.round(app.scoreBreakdown.finalScore * 100)
  }
  if (app.matchScore != null) return Math.round(app.matchScore * 100)
  if (app.adjudication?.fitScore != null) return app.adjudication.fitScore
  return null
}

export function fitScoreLabel(score: number): string {
  if (score >= 80) return 'Strong fit'
  if (score >= 65) return 'Good fit'
  if (score >= 50) return 'Moderate fit'
  return 'Stretch'
}

export function seniorityFitLabel(fit: string | undefined): string | null {
  if (!fit || fit === 'good') return null
  const labels: Record<string, string> = {
    stretch: 'Seniority stretch',
    under: 'Below target level',
    over: 'Above target level',
  }
  return labels[fit] ?? fit
}

export function hasMatchInsights(app: TailoredApplication): boolean {
  return Boolean(
    app.adjudication ||
      app.scoreBreakdown ||
      app.matchReason ||
      app.matchScore != null,
  )
}

export function collectStrengths(app: TailoredApplication): string[] {
  const fromAdjudication = app.adjudication?.strengths ?? []
  const fromReason = app.matchReason?.strengths ?? []
  return [...new Set([...fromAdjudication, ...fromReason].filter(Boolean))]
}

export function collectGaps(app: TailoredApplication): string[] {
  const fromAdjudication = app.adjudication?.gaps ?? []
  const fromReason = app.matchReason?.gaps ?? []
  return [...new Set([...fromAdjudication, ...fromReason].filter(Boolean))]
}

/** Classify match tier (mirrors api/internal/matching/tier.go). */
export function classifyMatchTier(app: TailoredApplication): MatchTier | null {
  if (app.matchTier === 'strong' || app.matchTier === 'promising') {
    return app.matchTier
  }

  const score = displayFitScore(app)
  if (score == null) return null

  const seniority = app.adjudication?.seniorityFit
  if (app.adjudication?.recommend === false) return 'promising'
  if (seniority === 'under' || seniority === 'over') return 'promising'
  if (score >= STRONG_MATCH_MIN_FIT_SCORE) return 'strong'
  return 'promising'
}

export function matchTierLabel(app: TailoredApplication): string | null {
  if (app.matchTierLabel) return app.matchTierLabel
  const tier = classifyMatchTier(app)
  return tier ? MATCH_TIER_LABELS[tier] : null
}

/** One-line human summary for the match insights panel. */
export function buildMatchSummary(app: TailoredApplication): string | null {
  const tier = classifyMatchTier(app)
  const score = displayFitScore(app)
  const seniority = app.adjudication?.seniorityFit

  if (!tier && score == null) return null

  if (seniority === 'over') {
    return 'This role is more senior than your target level, but it fits your preferences — worth applying if you want to grow into the role.'
  }
  if (seniority === 'under') {
    return 'This role is below your target seniority, but it otherwise aligns with your preferences.'
  }
  if (tier === 'strong') {
    return 'Strong alignment with your preferences and profile.'
  }
  if (score != null && score >= 65) {
    return 'Good fit with your preferences and profile.'
  }
  return 'Meets your hard preferences with reasonable profile overlap.'
}

export function topMatchStrengths(app: TailoredApplication, limit = 3): string[] {
  return collectStrengths(app).slice(0, limit)
}

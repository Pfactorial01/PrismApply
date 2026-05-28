package matching

// Match tier labels shown in the product UI.
const (
	MatchTierStrong    = "strong"
	MatchTierPromising = "promising"
)

// Match tier mode settings (stored on user preferences).
const (
	MatchTierModeStrongOnly           = "strong_only"
	MatchTierModeStrongAndPromising   = "strong_and_promising"
)

// StrongMatchMinFitScore is the minimum 0–100 fit score for "Strong Match".
// Used by API responses now; settings filter will reuse this threshold later.
const StrongMatchMinFitScore = 75

// FitScorePercent derives a 0–100 display score from vector match metadata.
// Vector similarity is the user-facing percentage; adjudication fitScore is a last-resort fallback.
func FitScorePercent(matchScore *float32, bd *ScoreBreakdown, adj *AdjudicationResult) *int {
	if bd != nil && bd.FinalScore > 0 {
		s := int(bd.FinalScore*100 + 0.5)
		return &s
	}
	if matchScore != nil {
		s := int(*matchScore*100 + 0.5)
		return &s
	}
	if adj != nil && adj.FitScore > 0 {
		s := adj.FitScore
		return &s
	}
	return nil
}

// ClassifyMatchTier assigns strong vs promising for surfaced applications.
func ClassifyMatchTier(matchScore *float32, bd *ScoreBreakdown, adj *AdjudicationResult) *string {
	scorePtr := FitScorePercent(matchScore, bd, adj)
	if scorePtr == nil {
		return nil
	}
	score := *scorePtr

	if adj != nil && !adj.Recommend {
		t := MatchTierPromising
		return &t
	}
	if adj != nil && (adj.SeniorityFit == "under" || adj.SeniorityFit == "over") {
		t := MatchTierPromising
		return &t
	}
	if score >= StrongMatchMinFitScore {
		t := MatchTierStrong
		return &t
	}
	t := MatchTierPromising
	return &t
}

// NormalizeMatchTierMode returns the effective tier mode, defaulting to strong_and_promising.
func NormalizeMatchTierMode(mode string) string {
	switch mode {
	case MatchTierModeStrongOnly:
		return MatchTierModeStrongOnly
	default:
		return MatchTierModeStrongAndPromising
	}
}

// MatchPassesStretchFilter reports whether a seniority stretch (over) match may be created.
// Stretch roles above the user's target require explicit opt-in via AllowStretchMatches.
func MatchPassesStretchFilter(prefs UserPreferences, adj *AdjudicationResult) bool {
	if adj == nil || adj.SeniorityFit != "over" {
		return true
	}
	return prefs.AllowStretchMatches
}

// MatchPassesTierFilter reports whether a scored match should be created for the user's tier mode.
func MatchPassesTierFilter(prefs UserPreferences, matchScore *float32, bd *ScoreBreakdown, adj *AdjudicationResult) bool {
	if NormalizeMatchTierMode(prefs.MatchTierMode) == MatchTierModeStrongAndPromising {
		return true
	}
	tier := ClassifyMatchTier(matchScore, bd, adj)
	return tier != nil && *tier == MatchTierStrong
}

// MatchTierLabel returns the user-facing label for a tier slug.
func MatchTierLabel(tier string) string {
	switch tier {
	case MatchTierStrong:
		return "Strong Match"
	case MatchTierPromising:
		return "Promising Match"
	default:
		return tier
	}
}

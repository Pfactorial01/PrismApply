package matching_test

import (
	"testing"

	"prismapply/api/internal/matching"
)

func TestClassifyMatchTier(t *testing.T) {
	strong := float32(0.82)
	promising := float32(0.62)

	cases := []struct {
		name  string
		score *float32
		bd    *matching.ScoreBreakdown
		adj   *matching.AdjudicationResult
		want  string
	}{
		{
			name: "strong from adjudication score",
			bd:   &matching.ScoreBreakdown{FinalScore: 0.85},
			adj:  &matching.AdjudicationResult{Recommend: true, FitScore: 85, SeniorityFit: "good"},
			want: matching.MatchTierStrong,
		},
		{
			name: "promising below threshold",
			bd:   &matching.ScoreBreakdown{FinalScore: 0.68},
			adj:  &matching.AdjudicationResult{Recommend: true, FitScore: 68, SeniorityFit: "good"},
			want: matching.MatchTierPromising,
		},
		{
			name: "promising when seniority over",
			bd:   &matching.ScoreBreakdown{FinalScore: 0.85},
			adj:  &matching.AdjudicationResult{Recommend: true, FitScore: 85, SeniorityFit: "over"},
			want: matching.MatchTierPromising,
		},
		{
			name: "promising when seniority under",
			bd:   &matching.ScoreBreakdown{FinalScore: 0.90},
			adj:  &matching.AdjudicationResult{Recommend: true, FitScore: 90, SeniorityFit: "under"},
			want: matching.MatchTierPromising,
		},
		{
			name:  "strong from vector score",
			score: &strong,
			want:  matching.MatchTierStrong,
		},
		{
			name:  "promising from vector score",
			score: &promising,
			want:  matching.MatchTierPromising,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := matching.ClassifyMatchTier(tc.score, tc.bd, tc.adj)
			if got == nil || *got != tc.want {
				t.Fatalf("ClassifyMatchTier() = %v, want %q", got, tc.want)
			}
		})
	}
}

func TestFitScorePercentUsesVectorScore(t *testing.T) {
	score := float32(0.562)
	bd := &matching.ScoreBreakdown{FinalScore: 0.562}
	adj := &matching.AdjudicationResult{FitScore: 1, Recommend: true, SeniorityFit: "over"}
	got := matching.FitScorePercent(&score, bd, adj)
	if got == nil || *got != 56 {
		t.Fatalf("FitScorePercent() = %v, want 56", got)
	}
}

func TestMatchTierLabel(t *testing.T) {
	if matching.MatchTierLabel(matching.MatchTierStrong) != "Strong Match" {
		t.Fatal("strong label")
	}
	if matching.MatchTierLabel(matching.MatchTierPromising) != "Promising Match" {
		t.Fatal("promising label")
	}
}

func TestMatchPassesTierFilter(t *testing.T) {
	strongScore := float32(0.82)
	promisingScore := float32(0.62)
	bdStrong := &matching.ScoreBreakdown{FinalScore: 0.82}
	bdPromising := &matching.ScoreBreakdown{FinalScore: 0.62}
	adj := &matching.AdjudicationResult{Recommend: true, FitScore: 82, SeniorityFit: "good"}

	strongOnly := matching.UserPreferences{MatchTierMode: matching.MatchTierModeStrongOnly}
	both := matching.UserPreferences{MatchTierMode: matching.MatchTierModeStrongAndPromising}

	if !matching.MatchPassesTierFilter(both, &strongScore, bdStrong, adj) {
		t.Fatal("both mode should accept strong")
	}
	if !matching.MatchPassesTierFilter(both, &promisingScore, bdPromising, adj) {
		t.Fatal("both mode should accept promising")
	}
	if !matching.MatchPassesTierFilter(strongOnly, &strongScore, bdStrong, adj) {
		t.Fatal("strong-only mode should accept strong")
	}
	if matching.MatchPassesTierFilter(strongOnly, &promisingScore, bdPromising, adj) {
		t.Fatal("strong-only mode should reject promising")
	}
}

func TestMatchPassesStretchFilter(t *testing.T) {
	over := &matching.AdjudicationResult{SeniorityFit: "over", Recommend: true}
	good := &matching.AdjudicationResult{SeniorityFit: "good", Recommend: true}
	if !matching.MatchPassesStretchFilter(matching.UserPreferences{AllowStretchMatches: true}, over) {
		t.Fatal("stretch allowed when opted in")
	}
	if matching.MatchPassesStretchFilter(matching.UserPreferences{}, over) {
		t.Fatal("stretch blocked by default")
	}
	if !matching.MatchPassesStretchFilter(matching.UserPreferences{}, good) {
		t.Fatal("non-stretch should pass")
	}
}

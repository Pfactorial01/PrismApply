package matching

import (
	"strings"
)

var seniorityRank = map[string]int{
	"intern": 0, "junior": 1, "mid": 2, "senior": 3,
	"staff": 4, "principal": 5, "lead": 4, "manager": 4, "director": 6,
}

// CompareSeniority checks job level against the user's target.
// Target is a minimum: at-target is ideal (good), above is acceptable (over), below is rejected (under).
func CompareSeniority(userTarget, jobLevel string) (eligible bool, fit string) {
	if userTarget == "" || jobLevel == "" || jobLevel == "unknown" {
		return true, "good"
	}
	u, uok := seniorityRank[userTarget]
	j, jok := seniorityRank[jobLevel]
	if !uok || !jok {
		return true, "good"
	}
	if j < u {
		return false, "under"
	}
	if j == u {
		return true, "good"
	}
	return true, "over"
}

func isSeniorityPreferenceViolation(v string) bool {
	lower := strings.ToLower(v)
	keywords := []string{
		"seniority", "senior level", "mid-level", "mid level",
		"junior", "entry-level", "entry level", "target seniority",
		"below user target", "above user target", "stretch role",
	}
	for _, k := range keywords {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func filterSeniorityPreferenceViolations(violations []string) []string {
	if len(violations) == 0 {
		return violations
	}
	out := make([]string, 0, len(violations))
	for _, v := range violations {
		if !isSeniorityPreferenceViolation(v) {
			out = append(out, v)
		}
	}
	return out
}

// ReconcileAdjudicationSeniority applies deterministic seniority rules after LLM adjudication.
func ReconcileAdjudicationSeniority(prefs UserPreferences, facts JobFacts, adj *AdjudicationResult) {
	if adj == nil {
		return
	}
	eligible, fit := CompareSeniority(prefs.SeniorityTarget, facts.SeniorityLevel)
	adj.SeniorityFit = fit

	if !eligible {
		adj.Recommend = false
		msg := "Job seniority (" + facts.SeniorityLevel + ") is below user target (" + prefs.SeniorityTarget + ")"
		if !containsString(adj.PreferenceViolations, msg) {
			adj.PreferenceViolations = append(adj.PreferenceViolations, msg)
		}
		return
	}

	adj.PreferenceViolations = filterSeniorityPreferenceViolations(adj.PreferenceViolations)
	if len(adj.PreferenceViolations) == 0 {
		adj.Recommend = true
	} else {
		adj.Recommend = false
	}
}

func containsString(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

package matching_test

import (
	"testing"

	"prismapply/api/internal/matching"
)

func TestCompareSeniority(t *testing.T) {
	cases := []struct {
		user, job string
		eligible  bool
		fit       string
	}{
		{"mid", "mid", true, "good"},
		{"mid", "senior", true, "over"},
		{"mid", "junior", false, "under"},
		{"mid", "intern", false, "under"},
		{"senior", "staff", true, "over"},
		{"mid", "unknown", true, "good"},
	}

	for _, tc := range cases {
		eligible, fit := matching.CompareSeniority(tc.user, tc.job)
		if eligible != tc.eligible || fit != tc.fit {
			t.Fatalf("CompareSeniority(%q,%q) = (%v,%q), want (%v,%q)", tc.user, tc.job, eligible, fit, tc.eligible, tc.fit)
		}
	}
}

func TestMatchEligible_SeniorityMinimum(t *testing.T) {
	prefs := matching.UserPreferences{SeniorityTarget: "mid"}

	senior := matching.MatchEligible(prefs, matching.JobFacts{SeniorityLevel: "senior"})
	if !senior.OK {
		t.Fatal("senior job should pass for mid-level user")
	}

	junior := matching.MatchEligible(prefs, matching.JobFacts{SeniorityLevel: "junior"})
	if junior.OK {
		t.Fatal("junior job should fail for mid-level user")
	}
}

func TestReconcileAdjudicationSeniority_AcceptsSeniorForMidUser(t *testing.T) {
	prefs := matching.UserPreferences{SeniorityTarget: "mid"}
	facts := matching.JobFacts{SeniorityLevel: "senior"}
	adj := matching.AdjudicationResult{
		Recommend:            false,
		FitScore:             50,
		PreferenceViolations: []string{"Seniority is senior, but user prefers mid-level."},
		SeniorityFit:         "over",
	}

	matching.ReconcileAdjudicationSeniority(prefs, facts, &adj)
	if !adj.Recommend {
		t.Fatalf("expected recommend=true after reconcile, violations=%v", adj.PreferenceViolations)
	}
	if adj.SeniorityFit != "over" {
		t.Fatalf("seniorityFit=%q want over", adj.SeniorityFit)
	}
	if len(adj.PreferenceViolations) != 0 {
		t.Fatalf("expected seniority violations stripped, got %v", adj.PreferenceViolations)
	}
}

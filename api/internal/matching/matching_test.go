package matching_test

import (
	"testing"

	"prismapply/api/internal/matching"
)

func TestMatchEligible_Dealbreakers(t *testing.T) {
	prefs := matching.UserPreferences{
		DealbreakerSlugs: []string{"db_no_crypto", "db_no_oncall"},
	}
	job := matching.JobFacts{
		IndustryTags:   []string{"crypto"},
		HasHeavyOncall: false,
	}
	r := matching.MatchEligible(prefs, job)
	if r.OK {
		t.Fatal("expected crypto dealbreaker to fail gate")
	}

	job2 := matching.JobFacts{HasHeavyOncall: true}
	r2 := matching.MatchEligible(prefs, job2)
	if r2.OK {
		t.Fatal("expected oncall dealbreaker to fail gate")
	}
}

func TestMatchEligible_WorkArrangement(t *testing.T) {
	prefs := matching.UserPreferences{WorkArrangement: "remote"}
	job := matching.JobFacts{RemotePolicy: "onsite"}
	r := matching.MatchEligible(prefs, job)
	if r.OK {
		t.Fatal("remote user should reject onsite-only job")
	}
}

func TestMatchEligible_Visa(t *testing.T) {
	no := false
	prefs := matching.UserPreferences{NeedsVisaSponsorship: true}
	job := matching.JobFacts{RequiresSponsorship: &no}
	r := matching.MatchEligible(prefs, job)
	if r.OK {
		t.Fatal("user needing sponsorship should reject no-sponsor job")
	}
}

func TestExtractJobFacts(t *testing.T) {
	f := matching.ExtractJobFacts(
		"Senior Software Engineer",
		"Acme",
		"Remote US",
		"Remote role. Visa sponsorship available. On-call rotation required. $150k-$180k",
		nil,
	)
	if f.RemotePolicy != "remote" {
		t.Fatalf("remote_policy=%q", f.RemotePolicy)
	}
	if f.SeniorityLevel != "senior" {
		t.Fatalf("seniority=%q", f.SeniorityLevel)
	}
	if !f.HasHeavyOncall {
		t.Fatal("expected oncall")
	}
	if f.RequiresSponsorship == nil || !*f.RequiresSponsorship {
		t.Fatal("expected sponsorship true")
	}
}

func TestBuildProfileSections(t *testing.T) {
	raw := []byte(`{
		"fullName":"Jane Doe",
		"headline":"Backend engineer",
		"resumePlainText":"Built APIs at Foo Corp for 3 years.",
		"seniorityTarget":"senior",
		"selectedDealbreakerSlugs":["db_no_defense"],
		"skillsCoreNarrative":"Go, Postgres, Kafka"
	}`)
	sections := matching.BuildProfileSections(raw)
	if len(sections) < 3 {
		t.Fatalf("expected multiple sections, got %d", len(sections))
	}
	foundResume, foundConstraints := false, false
	for _, s := range sections {
		if s.Key == matching.SectionResume || matching.SectionPrefixMatch(s.Key, matching.SectionResume) {
			foundResume = true
		}
		if s.Key == matching.SectionConstraints {
			foundConstraints = true
		}
	}
	if !foundResume {
		t.Fatal("missing resume section")
	}
	if !foundConstraints {
		t.Fatal("missing constraints section")
	}
}

func TestComputeFinalScore(t *testing.T) {
	b := matching.ScoreBreakdown{
		ResumePosting:  0.7,
		SkillsReqs:     0.6,
		TargetsPosting: 0.5,
		ExperienceDesc: 0.4,
		MaxChunkSim:    0.8,
	}
	score := matching.ComputeFinalScore(&b)
	if score < 0.55 || score > 0.75 {
		t.Fatalf("unexpected score %f", score)
	}
}

package handlers

import "testing"

func TestNormalizeSummaryBullets_fromArray(t *testing.T) {
	got := normalizeSummaryBullets(map[string]any{
		"bullets": []any{
			"Built CI/CD pipelines",
			"Led migration to React",
		},
	})
	want := "• Built CI/CD pipelines\n• Led migration to React"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestNormalizeEmploymentType_fullTime(t *testing.T) {
	if got := normalizeEmploymentType("full_time", true); got != "full_time" {
		t.Fatalf("got %q", got)
	}
	if got := normalizeEmploymentType("fulltime", true); got != "full_time" {
		t.Fatalf("got %q", got)
	}
}

func TestNormalizeParsedWorkEntries(t *testing.T) {
	profile := map[string]any{
		"workEntries": []any{
			map[string]any{
				"company":        "AireBrokers",
				"role":           "Fullstack Developer",
				"employmentType": "full_time",
				"bullets":        []any{"Automated deployments", "Improved API latency"},
			},
		},
	}
	normalizeParsedWorkEntries(profile)
	entries, ok := profile["workEntries"].([]any)
	if !ok || len(entries) != 1 {
		t.Fatal("expected one work entry")
	}
	m := entries[0].(map[string]any)
	if m["employmentType"] != "full_time" {
		t.Fatalf("employmentType=%v", m["employmentType"])
	}
	if m["summaryBullets"] == "" {
		t.Fatal("expected summaryBullets")
	}
	if m["id"] == "" {
		t.Fatal("expected generated id")
	}
}

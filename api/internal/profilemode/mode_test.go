package profilemode_test

import (
	"encoding/json"
	"testing"

	"prismapply/api/internal/profilemode"
)

func TestDeriveProfileMode(t *testing.T) {
	doc := map[string]any{
		"yearsExperience":      "0-1",
		"seniorityTarget":      "junior",
		"paidWorkExperience":   profilemode.PaidNone,
	}
	raw, _ := json.Marshal(doc)
	if got := profilemode.DeriveProfileMode(raw); got != profilemode.ModeEarly {
		t.Fatalf("got %q want early", got)
	}
}

func TestDeriveResumeLayout(t *testing.T) {
	tests := []struct {
		paid string
		want string
	}{
		{profilemode.PaidNone, profilemode.LayoutProjectOnly},
		{profilemode.PaidInternshipOnly, profilemode.LayoutHybrid},
		{profilemode.PaidFullTime, profilemode.LayoutEmploymentLed},
	}
	for _, tc := range tests {
		raw, _ := json.Marshal(map[string]any{"paidWorkExperience": tc.paid})
		if got := profilemode.DeriveResumeLayout(raw); got != tc.want {
			t.Fatalf("paid=%s got %q want %q", tc.paid, got, tc.want)
		}
	}
}

func TestCompileResumePlainText_projectOnly(t *testing.T) {
	raw, _ := json.Marshal(map[string]any{
		"paidWorkExperience":  profilemode.PaidNone,
		"skillsCoreNarrative": "TypeScript, React, Go",
		"schoolName":          "State University",
		"highestEducation":    "bachelors",
		"educationDetails":    "BS Computer Science",
		"projects": []any{
			map[string]any{"title": "Todo App", "summary": "Built a task manager"},
			map[string]any{"title": "API", "summary": "REST service in Go"},
		},
	})
	text := profilemode.CompileResumePlainText(raw)
	if text == "" {
		t.Fatal("expected compiled text")
	}
	for _, want := range []string{"SKILLS", "EDUCATION", "PROJECTS", "Todo App"} {
		if !contains(text, want) {
			t.Fatalf("missing %q in %q", want, text)
		}
	}
	if contains(text, "EXPERIENCE") {
		t.Fatal("project_only should not include EXPERIENCE section")
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

package tailoring

import (
	"strings"
	"testing"

	"prismapply/api/internal/profilemode"
)

func TestValidateStructuredResume_density(t *testing.T) {
	resume := StructuredResume{
		Name:    "Test User",
		Contact: []string{"test@example.com"},
		Experience: []ResumeExperience{
			{Company: "Acme", Role: "Engineer", Bullets: []ResumeBullet{
				{Text: "One", SourceRefs: []SourceRef{{Field: "resume", Excerpt: "One"}}},
				{Text: "Two", SourceRefs: []SourceRef{{Field: "resume", Excerpt: "Two"}}},
			}},
		},
		Projects: []ResumeProject{
			{Title: "Side", Bullets: []ResumeBullet{
				{Text: "Only one", SourceRefs: []SourceRef{{Field: "projects_0", Excerpt: "Only one"}}},
			}},
		},
	}
	result := ValidateStructuredResume(resume, profilemode.LayoutEmploymentLed)
	if result.OK {
		t.Fatal("expected density validation to fail")
	}
	foundRecent := false
	foundProject := false
	for _, w := range result.Warnings {
		if strings.Contains(w, "Acme needs at least 4") {
			foundRecent = true
		}
		if strings.Contains(w, `Project "Side" needs at least 2`) {
			foundProject = true
		}
	}
	if !foundRecent {
		t.Fatalf("expected most recent role density warning, got %v", result.Warnings)
	}
	if !foundProject {
		t.Fatalf("expected project density warning, got %v", result.Warnings)
	}
}

func TestBuildResumeDensityHints_pageTarget(t *testing.T) {
	h := buildResumeDensityHints(map[string]any{
		"seniorityTarget": "staff",
		"yearsExperience": "5-8",
	})
	if h.PageTarget != "2 pages maximum" {
		t.Fatalf("staff should get 2 pages, got %q", h.PageTarget)
	}
	h2 := buildResumeDensityHints(map[string]any{
		"seniorityTarget": "senior",
		"yearsExperience": "5-8",
	})
	if h2.PageTarget != "1 page" {
		t.Fatalf("senior should get 1 page, got %q", h2.PageTarget)
	}
}

func TestCollectExpandFieldHints_includesStories(t *testing.T) {
	hints := collectExpandFieldHints(map[string]any{
		"proudestProfessionalWins":          "Shipped platform v2.",
		"storyHardestTechnicalChallenge":    "Fixed outage.",
		"projects": []any{map[string]any{
			"title": "Demo", "summary": "A demo project.", "impactMetrics": "Used by 3 teams.",
		}},
	})
	if len(hints) < 3 {
		t.Fatalf("expected multiple expand hints, got %d", len(hints))
	}
}

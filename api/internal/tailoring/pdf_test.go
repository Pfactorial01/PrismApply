package tailoring

import (
	"strings"
	"testing"
)

func TestBuildResumeFilename(t *testing.T) {
	got := buildResumeFilename("John Pierce", "Tech Holding", "Senior Frontend Engineer - Next.JS - Contractual Role")
	want := "John_Pierce_Tech_Holding_Senior_Frontend_Engineer_-_NextJS_-_Cont_Resume.pdf"
	if got != want {
		t.Fatalf("buildResumeFilename() = %q, want %q", got, want)
	}
}

func TestStructuredResumeHTMLExperienceSeparator(t *testing.T) {
	html := structuredResumeHTML(StructuredResume{
		Name:    "Jane Doe",
		Contact: []string{"jane@example.com"},
		Experience: []ResumeExperience{
			{Company: "Acme Corp", Role: "Engineer", Dates: "2020–2024"},
		},
	}, TemplateATS)
	if !strings.Contains(html, "Acme Corp") || !strings.Contains(html, " · ") || !strings.Contains(html, "Engineer") {
		t.Fatalf("expected company/role separator in HTML: %s", html)
	}
}

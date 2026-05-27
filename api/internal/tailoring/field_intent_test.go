package tailoring

import "testing"

func TestResolveFieldRoutesObvious(t *testing.T) {
	fields := []ClassifiedField{
		{FormFieldRow: FormFieldRow{Label: "Email *", FieldType: "text", Position: 0}, FieldClass: FieldIdentity},
		{FormFieldRow: FormFieldRow{Label: "Paste a link to a GitHub repository you've contributed to:", FieldType: "text", Position: 1}, FieldClass: FieldIdentity},
		{FormFieldRow: FormFieldRow{Label: "Describe in 2–3 sentences what makes it (your GitHub contribution) technically interesting:", FieldType: "textarea", Position: 2}, FieldClass: FieldLongText},
		{FormFieldRow: FormFieldRow{Label: "Will you require visa sponsorship?", FieldType: "select", Position: 3, Options: []string{"Yes", "No"}}, FieldClass: FieldSelect},
	}

	routes := ResolveFieldRoutes(fields)
	if !routes[0].Confident || routes[0].Strategy != StrategyDeterministic {
		t.Fatalf("email route = %+v", routes[0])
	}
	if !routes[1].Confident || routes[1].ExpectedFormat != FormatURL {
		t.Fatalf("github link route = %+v", routes[1])
	}
	if !routes[2].Confident || routes[2].Strategy != StrategyBehavioral || routes[2].ExpectedFormat != FormatProseShort {
		t.Fatalf("github describe route = %+v", routes[2])
	}
	if !routes[3].Confident || routes[3].Strategy != StrategyCompliance {
		t.Fatalf("sponsorship route = %+v", routes[3])
	}
}

func TestApplyIntentProseNotURL(t *testing.T) {
	r := FieldRoute{ExpectedFormat: FormatURL, Strategy: StrategyDeterministic}
	applyIntent(&r, "prose_repo_description", "prose_short", "behavioral", "", 1, []string{"projects"})
	if r.Strategy != StrategyBehavioral || r.ExpectedFormat != FormatProseShort {
		t.Fatalf("applyIntent() = %+v", r)
	}
}

func TestLintURLInProseField(t *testing.T) {
	fields := []ClassifiedField{
		{FormFieldRow: FormFieldRow{Label: "GitHub link", Position: 0, Required: true}, FieldClass: FieldIdentity},
		{FormFieldRow: FormFieldRow{Label: "Describe repo", Position: 1, Required: true}, FieldClass: FieldLongText},
	}
	routes := []FieldRoute{
		{Label: "GitHub link", Position: 0, ExpectedFormat: FormatURL, Strategy: StrategyDeterministic},
		{Label: "Describe repo", Position: 1, ExpectedFormat: FormatProseShort, Strategy: StrategyBehavioral},
	}
	answers := []FormFieldAnswer{
		{Label: "GitHub link", Value: "https://github.com/example"},
		{Label: "Describe repo", Value: "https://github.com/example"},
	}
	lints := LintFormAnswers(fields, routes, answers, "")
	found := false
	for _, l := range lints {
		if l.Rule == "url_in_prose_field" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected url_in_prose_field lint, got %+v", lints)
	}
}

func TestLintCoverLetterPlaceholder(t *testing.T) {
	lints := lintCoverLetter("Dear Hiring Manager,\n\nThanks.\n\nSincerely,\n[Your Name]")
	if len(lints) == 0 {
		t.Fatal("expected cover letter placeholder lint")
	}
}

func TestFallbackAmbiguousRoutes(t *testing.T) {
	routes := []FieldRoute{
		{Label: "Something vague", FieldClass: FieldShortText, FieldType: "text", Confident: false, Strategy: StrategyNeedsIntent},
	}
	fallbackAmbiguousRoutes(routes)
	if !routes[0].Confident || routes[0].Strategy != StrategyBatchLLM {
		t.Fatalf("fallback route = %+v", routes[0])
	}
}

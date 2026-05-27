package tailoring

import "testing"

func TestSanitizeCoverLetter(t *testing.T) {
	raw := "John Pierce\nMinneapolis, MN\n\n[Date]\n\nDear Hiring Manager,\n\nHello world."
	got := sanitizeCoverLetter(raw, "Jane Doe")
	if !contains(got, "Dear Hiring Manager") {
		t.Fatalf("expected salutation preserved: %q", got)
	}
	if contains(got, "[Date]") {
		t.Fatalf("expected [Date] removed: %q", got)
	}
	if contains(got, "John Pierce") {
		t.Fatalf("expected letterhead stripped: %q", got)
	}
}

func TestReplaceCoverLetterPlaceholders(t *testing.T) {
	raw := "Dear Hiring Manager,\n\nThanks.\n\nSincerely,\n[Your Name]"
	got := replaceCoverLetterPlaceholders(raw, "Adebayo Adeoye")
	if contains(got, "[Your Name]") {
		t.Fatalf("expected placeholder replaced: %q", got)
	}
	if !contains(got, "Adebayo Adeoye") {
		t.Fatalf("expected signer name: %q", got)
	}
}

func TestClassifyGitHubDescribeQuestion(t *testing.T) {
	link := ClassifyFormField(FormFieldRow{
		Label:     "Paste a link to a GitHub repository you've contributed to:",
		FieldType: "text",
	})
	if link.FieldClass != FieldIdentity {
		t.Fatalf("github link class = %q", link.FieldClass)
	}

	describe := ClassifyFormField(FormFieldRow{
		Label:     "Describe in 2–3 sentences what makes it (your GitHub contribution) technically interesting:",
		FieldType: "textarea",
	})
	if describe.FieldClass != FieldLongText {
		t.Fatalf("github describe class = %q", describe.FieldClass)
	}
}

func TestResolveIdentityGitHubDescribeEmpty(t *testing.T) {
	field := ClassifiedField{FormFieldRow: FormFieldRow{
		Label: "Describe in 2–3 sentences what makes it (your GitHub contribution) technically interesting:",
	}}
	profile := map[string]any{"githubUrl": "https://github.com/example"}
	got := resolveIdentityAnswer(field, nil, profile)
	if got != "" {
		t.Fatalf("expected empty for describe question, got %q", got)
	}
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

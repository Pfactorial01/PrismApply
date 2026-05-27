package tailoring

import "testing"

func TestSanitizeCoverLetter(t *testing.T) {
	raw := "John Pierce\nMinneapolis, MN\n\n[Date]\n\nDear Hiring Manager,\n\nHello world."
	got := sanitizeCoverLetter(raw)
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

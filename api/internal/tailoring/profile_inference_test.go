package tailoring

import "testing"

func TestInferLatinAmerica(t *testing.T) {
	opts := []string{"Yes", "No"}
	profile := map[string]any{"region": "mea", "country": "Nigeria"}
	if got := inferLatinAmerica(opts, profile); got != "No" {
		t.Fatalf("expected No, got %q", got)
	}
	profile["region"] = "latam"
	if got := inferLatinAmerica(opts, profile); got != "Yes" {
		t.Fatalf("expected Yes, got %q", got)
	}
}

func TestInferStackYearsReact(t *testing.T) {
	field := ClassifiedField{
		FormFieldRow: FormFieldRow{
			Label:   "3.How many years of experience do you have building complex user interfaces with React?",
			Options: []string{"Less than 2 years", "3 years or more", "I do not use React"},
		},
	}
	profile := map[string]any{
		"stackYears": map[string]any{"react": "3_plus"},
	}
	val, ok := inferStackYears(field, profile)
	if !ok || val != "3 years or more" {
		t.Fatalf("got %q ok=%v", val, ok)
	}
}

func TestInferWorkAuthUS(t *testing.T) {
	field := ClassifiedField{
		FormFieldRow: FormFieldRow{
			Label:   "Are you authorized to work lawfully in the US for US Mobile Inc?",
			Options: []string{"Yes", "No"},
		},
	}
	profile := map[string]any{"workAuthorizedInUS": false}
	val, ok := inferWorkAuthSelect(field, profile)
	if !ok || val != "No" {
		t.Fatalf("got %q ok=%v", val, ok)
	}
}

func TestFormatLocationWithCountry(t *testing.T) {
	got := formatLocationWithCountry("Lagos", "mea", "Nigeria")
	if got != "Lagos, Nigeria" {
		t.Fatalf("got %q", got)
	}
}

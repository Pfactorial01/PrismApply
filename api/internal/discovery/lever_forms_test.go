package discovery

import (
	"context"
	"os"
	"testing"
)

func TestLeverFormFieldsFromApplyHTML_Railroad19Fixture(t *testing.T) {
	html, err := os.ReadFile("testdata/lever_railroad19_apply.html")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	fields := leverFormFieldsFromApplyHTML(string(html))
	if len(fields) < 18 {
		t.Fatalf("expected at least 18 fields, got %d", len(fields))
	}

	byLabel := map[string]string{}
	for _, f := range fields {
		byLabel[f.Label] = f.FieldType
	}

	want := map[string]string{
		"Resume/CV":     "file",
		"Full name":     "text",
		"Email":         "email",
		"Phone":         "text",
		"LinkedIn URL":  "text",
		"Are you legally authorized to work in the United States?": "select",
	}
	for label, typ := range want {
		got, ok := byLabel[label]
		if !ok {
			t.Fatalf("missing field %q", label)
		}
		if got != typ {
			t.Fatalf("field %q: want type %q, got %q", label, typ, got)
		}
	}

	if _, ok := byLabel["LinkedIn profile"]; ok {
		t.Fatal("LinkedIn profile widget should be skipped")
	}

	var authOpts, sponsorOpts []string
	for _, f := range fields {
		switch f.Label {
		case "Are you legally authorized to work in the United States?":
			authOpts = f.Options
		case "Will you now or anytime in the future require sponsorship of any kind?":
			sponsorOpts = f.Options
		}
	}
	if len(authOpts) != 2 || len(sponsorOpts) != 2 {
		t.Fatalf("expected yes/no options on authorization fields: auth=%v sponsor=%v", authOpts, sponsorOpts)
	}
}

func TestFetchLeverJob_FormFields(t *testing.T) {
	if testing.Short() {
		t.Skip("network")
	}
	payload, err := FetchJobViaATSAPI(context.Background(),
		"https://jobs.lever.co/railroad19/a0563ba8-a8d5-494e-954b-108702d54be0", "lever", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(payload.FormFields) < 18 {
		t.Fatalf("expected lever form fields, got %d", len(payload.FormFields))
	}
}

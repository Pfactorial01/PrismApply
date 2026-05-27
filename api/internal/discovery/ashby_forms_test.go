package discovery

import (
	"context"
	"os"
	"testing"
)

func TestAshbyFormFieldsFromApplyHTML_HarveyFixture(t *testing.T) {
	html, err := os.ReadFile("testdata/ashby_harvey_apply.html")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	fields := ashbyFormFieldsFromApplyHTML(string(html))
	if len(fields) < 14 {
		t.Fatalf("expected at least 14 fields, got %d", len(fields))
	}

	byLabel := map[string]string{}
	for _, f := range fields {
		byLabel[f.Label] = f.FieldType
	}

	want := map[string]string{
		"Legal First and Last Name": "text",
		"Email":                     "email",
		"Resume":                    "file",
		"LinkedIn":                  "text",
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
}

func TestFetchAshbyJob_FormFields(t *testing.T) {
	if testing.Short() {
		t.Skip("network")
	}
	payload, err := FetchJobViaATSAPI(context.Background(),
		"https://jobs.ashbyhq.com/harvey/2bd5b22c-d873-45da-a6d3-89944edb701c", "ashby", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(payload.FormFields) < 14 {
		t.Fatalf("expected ashby form fields, got %d", len(payload.FormFields))
	}
}

func TestFetchGreenhouseJob_FormFields(t *testing.T) {
	if testing.Short() {
		t.Skip("network")
	}
	payload, err := FetchJobViaATSAPI(context.Background(),
		"https://boards.greenhouse.io/samsara/jobs/7349219", "greenhouse", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(payload.FormFields) == 0 {
		t.Fatal("expected greenhouse form fields from questions API")
	}
}

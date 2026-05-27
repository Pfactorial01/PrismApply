package discovery

import (
	"testing"

	"prismapply/api/internal/repo"
)

func TestDedupeGreenhouseFormFields(t *testing.T) {
	fields := []repo.FormFieldRow{
		{Label: "Resume/CV", FieldType: "file", Required: false, Position: 0},
		{Label: "Resume/CV", FieldType: "textarea", Required: false, Position: 1},
		{Label: "Cover Letter", FieldType: "file", Required: false, Position: 2},
		{Label: "Cover Letter", FieldType: "textarea", Required: false, Position: 3},
		{Label: "Email", FieldType: "text", Required: true, Position: 4},
	}
	out := repo.DedupeFormFieldsByLabel(fields)
	if len(out) != 3 {
		t.Fatalf("expected 3 fields, got %d", len(out))
	}
	if out[0].FieldType != "file" || out[0].Label != "Resume/CV" {
		t.Fatalf("resume field: %+v", out[0])
	}
	if out[1].FieldType != "file" || out[1].Label != "Cover Letter" {
		t.Fatalf("cover field: %+v", out[1])
	}
	if out[2].Label != "Email" {
		t.Fatalf("email field: %+v", out[2])
	}
	for i, f := range out {
		if f.Position != i {
			t.Fatalf("position %d want %d got %d", i, i, f.Position)
		}
	}
}

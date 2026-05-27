package repo

import (
	"encoding/json"
	"testing"
)

func TestDedupeJobFormFieldsJSON(t *testing.T) {
	raw, err := json.Marshal([]JobFormFieldAPI{
		{Label: "Resume/CV", FieldType: "file", Position: 0},
		{Label: "Resume/CV", FieldType: "textarea", Position: 1},
		{Label: "Cover Letter", FieldType: "file", Position: 2},
		{Label: "Cover Letter", FieldType: "textarea", Position: 3},
	})
	if err != nil {
		t.Fatal(err)
	}
	var out []JobFormFieldAPI
	if err := json.Unmarshal(DedupeJobFormFieldsJSON(raw), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(out))
	}
	if out[0].FieldType != "file" || out[1].FieldType != "file" {
		t.Fatalf("unexpected types: %+v", out)
	}
}

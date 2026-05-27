package repo

import (
	"encoding/json"
	"strings"
)

// DedupeFormFieldsByLabel collapses duplicate labels from multi-control ATS questions.
// For resume/cover uploads, prefers file inputs over textarea siblings.
func DedupeFormFieldsByLabel(fields []FormFieldRow) []FormFieldRow {
	if len(fields) <= 1 {
		return fields
	}
	type bucket struct {
		fields []FormFieldRow
	}
	var groups []bucket
	seen := map[string]int{}
	for _, f := range fields {
		key := strings.ToLower(strings.TrimSpace(f.Label))
		if idx, ok := seen[key]; ok {
			groups[idx].fields = append(groups[idx].fields, f)
			continue
		}
		seen[key] = len(groups)
		groups = append(groups, bucket{fields: []FormFieldRow{f}})
	}

	out := make([]FormFieldRow, 0, len(groups))
	pos := 0
	for _, g := range groups {
		chosen := g.fields[0]
		if len(g.fields) > 1 {
			chosen = pickPreferredFormField(g.fields)
		}
		chosen.Position = pos
		out = append(out, chosen)
		pos++
	}
	return out
}

func pickPreferredFormField(candidates []FormFieldRow) FormFieldRow {
	label := strings.ToLower(strings.TrimSpace(candidates[0].Label))
	if isResumeOrCoverUploadLabel(label) {
		for _, f := range candidates {
			if f.FieldType == "file" {
				return f
			}
		}
	}
	for _, f := range candidates {
		if f.FieldType != "textarea" {
			return f
		}
	}
	return candidates[0]
}

func isResumeOrCoverUploadLabel(label string) bool {
	return strings.Contains(label, "resume") ||
		strings.Contains(label, "cv") ||
		strings.Contains(label, "cover letter") ||
		strings.Contains(label, "curriculum vitae")
}

// JobFormFieldAPI is the JSON shape returned to the frontend.
type JobFormFieldAPI struct {
	Label     string `json:"label"`
	FieldType string `json:"fieldType"`
	Required  bool   `json:"required"`
	Position  int    `json:"position"`
}

// DedupeJobFormFieldsJSON collapses duplicate ATS form fields in API responses.
func DedupeJobFormFieldsJSON(raw []byte) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return json.RawMessage("[]")
	}
	var fields []JobFormFieldAPI
	if err := json.Unmarshal(raw, &fields); err != nil {
		return json.RawMessage(raw)
	}
	rows := make([]FormFieldRow, len(fields))
	for i, f := range fields {
		rows[i] = FormFieldRow{
			Label: f.Label, FieldType: f.FieldType, Required: f.Required, Position: f.Position,
		}
	}
	deduped := DedupeFormFieldsByLabel(rows)
	out := make([]JobFormFieldAPI, len(deduped))
	for i, f := range deduped {
		out[i] = JobFormFieldAPI{
			Label: f.Label, FieldType: f.FieldType, Required: f.Required, Position: f.Position,
		}
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return json.RawMessage(raw)
	}
	return json.RawMessage(encoded)
}

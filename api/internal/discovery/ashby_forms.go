package discovery

import (
	"context"
	"encoding/json"
	"strings"

	"prismapply/api/internal/repo"
)

const ashbyAppDataPrefix = "window.__appData = "

type ashbyAppData struct {
	Posting ashbyAppPosting `json:"posting"`
}

type ashbyAppPosting struct {
	ApplicationForm *ashbyApplicationForm `json:"applicationForm"`
}

type ashbyApplicationForm struct {
	FieldEntries []ashbyFieldEntry `json:"fieldEntries"`
}

type ashbyFieldEntry struct {
	IsRequired bool          `json:"isRequired"`
	Field      ashbyFormField `json:"field"`
}

type ashbyFormField struct {
	Title             string               `json:"title"`
	HumanReadablePath string               `json:"humanReadablePath"`
	Type              string               `json:"type"`
	SelectableValues  []ashbySelectableVal `json:"selectableValues"`
}

type ashbySelectableVal struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

func enrichAshbyFormFields(ctx context.Context, applyURL string) []repo.FormFieldRow {
	if strings.TrimSpace(applyURL) == "" {
		return nil
	}
	pageHTML, err := fetchApplyPageHTML(ctx, applyURL)
	if err != nil {
		return nil
	}
	return ashbyFormFieldsFromApplyHTML(pageHTML)
}

func ashbyFormFieldsFromApplyHTML(pageHTML string) []repo.FormFieldRow {
	raw, ok := extractJSObjectAssignment(pageHTML, ashbyAppDataPrefix)
	if !ok {
		return nil
	}

	var data ashbyAppData
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil
	}
	if data.Posting.ApplicationForm == nil {
		return nil
	}

	var fields []repo.FormFieldRow
	for _, entry := range data.Posting.ApplicationForm.FieldEntries {
		label := strings.TrimSpace(entry.Field.Title)
		if label == "" {
			label = strings.TrimSpace(entry.Field.HumanReadablePath)
		}
		if label == "" {
			continue
		}
		fields = append(fields, repo.FormFieldRow{
			Label:     label,
			FieldType: mapAshbyFieldType(entry.Field),
			Required:  entry.IsRequired,
			Options:   ashbyFieldOptions(entry.Field),
		})
	}

	out := repo.DedupeFormFieldsByLabel(fields)
	for i := range out {
		out[i].Position = i
	}
	return out
}

func mapAshbyFieldType(field ashbyFormField) string {
	switch strings.TrimSpace(field.Type) {
	case "File":
		return "file"
	case "Email":
		return "email"
	case "Phone":
		return "tel"
	case "LongText":
		return "textarea"
	case "Boolean", "ValueSelect", "MultiValueSelect":
		return "select"
	case "Location":
		return "text"
	default:
		return "text"
	}
}

func ashbyFieldOptions(field ashbyFormField) []string {
	if len(field.SelectableValues) > 0 {
		out := make([]string, 0, len(field.SelectableValues))
		for _, v := range field.SelectableValues {
			label := strings.TrimSpace(v.Label)
			if label == "" {
				label = strings.TrimSpace(v.Value)
			}
			if label != "" {
				out = append(out, label)
			}
		}
		return out
	}
	if strings.EqualFold(strings.TrimSpace(field.Type), "Boolean") {
		return []string{"Yes", "No"}
	}
	return nil
}

// extractJSObjectAssignment pulls a JSON object assigned to a JS variable prefix.
func extractJSObjectAssignment(pageHTML, prefix string) ([]byte, bool) {
	idx := strings.Index(pageHTML, prefix)
	if idx < 0 {
		return nil, false
	}
	rest := strings.TrimLeft(pageHTML[idx+len(prefix):], " \t\r\n")
	if len(rest) == 0 || rest[0] != '{' {
		return nil, false
	}

	depth := 0
	inString := false
	escape := false
	for i := 0; i < len(rest); i++ {
		c := rest[i]
		if inString {
			if escape {
				escape = false
				continue
			}
			if c == '\\' {
				escape = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return []byte(rest[:i+1]), true
			}
		}
	}
	return nil, false
}

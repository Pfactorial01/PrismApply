package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"prismapply/api/internal/repo"
)

var (
	leverQuestionLI   = regexp.MustCompile(`(?is)<li[^>]*class="[^"]*application-question[^"]*"[^>]*>(.*?)</li>`)
	leverLabelRe      = regexp.MustCompile(`(?is)class="application-label[^"]*">([^<]+)`)
	leverInputRe      = regexp.MustCompile(`(?is)<input\b([^>]*)>`)
	leverHiddenCardRe = regexp.MustCompile(`(?is)<input type="hidden" value="(\{&quot;createdAt&quot;[^"]+)"`)
	leverInputTypeRe  = regexp.MustCompile(`(?i)type="([^"]+)"`)
	leverInputNameRe  = regexp.MustCompile(`(?i)name="([^"]+)"`)
	leverRequiredRe   = regexp.MustCompile(`(?i)\brequired\b`)
)

type leverCustomCard struct {
	Text   string             `json:"text"`
	Fields []leverCustomField `json:"fields"`
}

type leverCustomField struct {
	Type     string              `json:"type"`
	Text     string              `json:"text"`
	Required bool                `json:"required"`
	Options  []leverCustomOption `json:"options"`
}

type leverCustomOption struct {
	Text string `json:"text"`
}

func fetchApplyPageHTML(ctx context.Context, applyURL string) (string, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, applyURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("User-Agent", "PrismApply-Discovery/1.0")

	resp, err := atsHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP %d from %s", resp.StatusCode, applyURL)
	}
	return string(body), nil
}

func enrichLeverFormFields(ctx context.Context, applyURL string) []repo.FormFieldRow {
	if strings.TrimSpace(applyURL) == "" {
		return nil
	}
	pageHTML, err := fetchApplyPageHTML(ctx, applyURL)
	if err != nil {
		return nil
	}
	return leverFormFieldsFromApplyHTML(pageHTML)
}

func leverFormFieldsFromApplyHTML(pageHTML string) []repo.FormFieldRow {
	var fields []repo.FormFieldRow

	for _, li := range leverQuestionLI.FindAllStringSubmatch(pageHTML, -1) {
		block := li[1]
		labelM := leverLabelRe.FindStringSubmatch(block)
		if labelM == nil {
			continue
		}
		label := strings.TrimSpace(html.UnescapeString(labelM[1]))
		if isLeverSkipLabel(label) {
			continue
		}

		inputM := leverInputRe.FindStringSubmatch(block)
		if inputM == nil {
			continue
		}
		attrs := inputM[1]

		if nameM := leverInputNameRe.FindStringSubmatch(attrs); nameM != nil && strings.HasPrefix(nameM[1], "cards[") {
			continue
		}
		if typeM := leverInputTypeRe.FindStringSubmatch(attrs); typeM != nil && strings.EqualFold(typeM[1], "hidden") {
			continue
		}

		fieldType := "text"
		if typeM := leverInputTypeRe.FindStringSubmatch(attrs); typeM != nil {
			fieldType = mapLeverInputType(typeM[1])
		}

		required := leverRequiredRe.MatchString(attrs) || leverFieldMarkedRequired(block)

		fields = append(fields, repo.FormFieldRow{
			Label:     label,
			FieldType: fieldType,
			Required:  required,
		})
	}

	for _, m := range leverHiddenCardRe.FindAllStringSubmatch(pageHTML, -1) {
		raw := html.UnescapeString(m[1])
		var card leverCustomCard
		if err := json.Unmarshal([]byte(raw), &card); err != nil {
			continue
		}
		for _, f := range card.Fields {
			label := strings.TrimSpace(f.Text)
			if label == "" {
				continue
			}
			fields = append(fields, repo.FormFieldRow{
				Label:     label,
				FieldType: mapLeverCustomFieldType(f.Type),
				Required:  f.Required,
				Options:   leverCustomOptions(f),
			})
		}
	}

	out := repo.DedupeFormFieldsByLabel(fields)
	for i := range out {
		out[i].Position = i
	}
	return out
}

func isLeverSkipLabel(label string) bool {
	switch strings.ToLower(strings.TrimSpace(label)) {
	case "linkedin profile":
		return true
	default:
		return false
	}
}

func leverFieldMarkedRequired(block string) bool {
	return strings.Contains(block, `class="required"`) || strings.Contains(block, "✱")
}

func mapLeverInputType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "file":
		return "file"
	case "email":
		return "email"
	case "tel":
		return "tel"
	case "url":
		return "text"
	default:
		return "text"
	}
}

func mapLeverCustomFieldType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "textarea":
		return "textarea"
	case "multiple-choice", "dropdown", "multiple-select":
		return "select"
	default:
		return "text"
	}
}

func leverCustomOptions(f leverCustomField) []string {
	if len(f.Options) == 0 {
		return nil
	}
	out := make([]string, 0, len(f.Options))
	for _, o := range f.Options {
		if t := strings.TrimSpace(o.Text); t != "" {
			out = append(out, t)
		}
	}
	return out
}

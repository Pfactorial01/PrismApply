package discovery

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"prismapply/api/internal/config"
	"prismapply/api/internal/repo"
	"prismapply/api/internal/tailoring"
)

type JobPayload struct {
	Source        string
	JobURL        string
	ApplyURL      string
	Title         string
	Company       string
	Location      string
	Description   string
	FormFields    []repo.FormFieldRow
	SearchQueryID *int64
}

// ScrapeAndEnrichJob loads listing + apply form via ATS APIs, falling back to headless Chrome.
func ScrapeAndEnrichJob(ctx context.Context, cfg config.Config, jobURL, source string, searchQueryID *int64) (JobPayload, error) {
	listingURL := NormalizeListingURL(jobURL)

	if payload, err := FetchJobViaATSAPI(ctx, listingURL, source, searchQueryID); err == nil {
		return payload, nil
	} else if isRemovedATSError(err) {
		return JobPayload{}, err
	}

	return scrapeAndEnrichJobWithChrome(ctx, cfg, listingURL, source, searchQueryID)
}

func isRemovedATSError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, "HTTP 404") {
		return true
	}
	if strings.Contains(msg, "not found") {
		return true
	}
	return false
}

func scrapeAndEnrichJobWithChrome(ctx context.Context, cfg config.Config, listingURL, source string, searchQueryID *int64) (JobPayload, error) {
	applyURL := listingApplyURL(listingURL, source)

	listingHTML, err := fetchPageHTML(ctx, cfg, listingURL)
	if err != nil {
		return JobPayload{}, fmt.Errorf("listing scrape: %w", err)
	}

	details, err := extractJobDetails(ctx, cfg, listingHTML, listingURL)
	if err != nil {
		return JobPayload{}, err
	}

	applyHTML, err := fetchPageHTML(ctx, cfg, applyURL)
	if err != nil {
		applyHTML = listingHTML
	}

	formFields, err := extractFormFields(ctx, cfg, applyHTML)
	if err != nil {
		formFields = []repo.FormFieldRow{}
	}

	return JobPayload{
		Source:        source,
		JobURL:        listingURL,
		ApplyURL:      applyURL,
		Title:         details.Title,
		Company:       details.Company,
		Location:      details.Location,
		Description:   details.Description,
		FormFields:    formFields,
		SearchQueryID: searchQueryID,
	}, nil
}

func fetchPageHTML(ctx context.Context, cfg config.Config, pageURL string) (string, error) {
	chrome := cfg.ChromePath
	if chrome == "" {
		chrome = "/usr/bin/google-chrome-stable"
	}
	scrapeCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	cmd := exec.CommandContext(scrapeCtx, chrome,
		"--headless=new",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-extensions",
		"--disable-background-networking",
		"--virtual-time-budget=15000",
		"--dump-dom",
		pageURL,
	)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

type jobDetails struct {
	Title       string `json:"title"`
	Company     string `json:"company"`
	Location    string `json:"location"`
	Description string `json:"description"`
}

func extractJobDetails(ctx context.Context, cfg config.Config, pageHTML, url string) (jobDetails, error) {
	system := `Extract job listing metadata from HTML/text. Return JSON only via schema. Do not invent details.`
	user := fmt.Sprintf("URL: %s\n\nPage content (truncated):\n%s", url, truncateText(stripTags(pageHTML), 12000))
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"title":       map[string]any{"type": "string"},
			"company":     map[string]any{"type": "string"},
			"location":    map[string]any{"type": "string"},
			"description": map[string]any{"type": "string"},
		},
		"required":             []string{"title", "company", "location", "description"},
		"additionalProperties": false,
	}
	var out jobDetails
	if err := tailoring.CallJSONLLM(ctx, cfg, system, user, "job_details", schema, 0.2, &out); err != nil {
		return jobDetails{Title: "Unknown Title", Company: "Unknown Company"}, err
	}
	if out.Title == "" {
		out.Title = "Unknown Title"
	}
	if out.Company == "" {
		out.Company = "Unknown Company"
	}
	return out, nil
}

func extractFormFields(ctx context.Context, cfg config.Config, pageHTML string) ([]repo.FormFieldRow, error) {
	system := `Extract application form fields from HTML/text. Include label, field type (text, email, tel, file, select, textarea, checkbox, radio), required flag, and options for select/radio.`
	user := truncateText(stripTags(pageHTML), 12000)
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"fields": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"label":    map[string]any{"type": "string"},
						"type":     map[string]any{"type": "string"},
						"required": map[string]any{"type": "boolean"},
						"options":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					},
					"required":             []string{"label", "type", "required", "options"},
					"additionalProperties": false,
				},
			},
		},
		"required":             []string{"fields"},
		"additionalProperties": false,
	}
	var parsed struct {
		Fields []struct {
			Label    string   `json:"label"`
			Type     string   `json:"type"`
			Required bool     `json:"required"`
			Options  []string `json:"options"`
		} `json:"fields"`
	}
	if err := tailoring.CallJSONLLM(ctx, cfg, system, user, "form_fields", schema, 0.2, &parsed); err != nil {
		return nil, err
	}
	out := make([]repo.FormFieldRow, len(parsed.Fields))
	for i, f := range parsed.Fields {
		out[i] = repo.FormFieldRow{
			Label:     f.Label,
			FieldType: f.Type,
			Required:  f.Required,
			Options:   f.Options,
			Position:  i,
		}
	}
	return out, nil
}

func listingApplyURL(listingURL, source string) string {
	switch source {
	case "lever":
		if !strings.HasSuffix(listingURL, "/apply") {
			return listingURL + "/apply"
		}
	case "ashby":
		if !strings.HasSuffix(listingURL, "/application") {
			return listingURL + "/application"
		}
	}
	return listingURL
}

func stripTags(s string) string {
	var b strings.Builder
	inTag := false
	for _, r := range s {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
			b.WriteRune(' ')
		case !inTag:
			b.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func truncateText(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// writeTempHTML helper for PDF-like flows in tests.
func writeTempHTML(html string) (string, error) {
	dir, err := os.MkdirTemp("", "scrape-*")
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, "page.html")
	return path, os.WriteFile(path, []byte(html), 0o644)
}

package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"prismapply/api/internal/repo"
)

var (
	greenhousePath = regexp.MustCompile(`^/([^/]+)/jobs/(\d+)$`)
	leverPath      = regexp.MustCompile(`(?i)^/([^/]+)/([0-9a-f-]{36})$`)
	ashbyPath      = regexp.MustCompile(`(?i)^/([^/]+)/([0-9a-f-]{36})$`)
)

var atsHTTPClient = &http.Client{Timeout: 30 * time.Second}

// FetchJobViaATSAPI loads job metadata from public ATS APIs (fast, no browser).
func FetchJobViaATSAPI(ctx context.Context, listingURL, source string, searchQueryID *int64) (JobPayload, error) {
	switch source {
	case "greenhouse":
		return fetchGreenhouseJob(ctx, listingURL, searchQueryID)
	case "lever":
		return fetchLeverJob(ctx, listingURL, searchQueryID)
	case "ashby":
		return fetchAshbyJob(ctx, listingURL, searchQueryID)
	default:
		return JobPayload{}, fmt.Errorf("unsupported source %q", source)
	}
}

func fetchGreenhouseJob(ctx context.Context, listingURL string, searchQueryID *int64) (JobPayload, error) {
	board, jobID, err := parseGreenhouseURL(listingURL)
	if err != nil {
		return JobPayload{}, err
	}

	apiURL := fmt.Sprintf("https://boards-api.greenhouse.io/v1/boards/%s/jobs/%s?questions=true", board, jobID)
	var job greenhouseJob
	if err := getJSON(ctx, apiURL, &job); err != nil {
		return JobPayload{}, err
	}

	title := strings.TrimSpace(job.Title)
	if title == "" {
		title = "Unknown Title"
	}
	company := strings.TrimSpace(job.CompanyName)
	if company == "" {
		company = companyFromSlug(board)
	}

	location := ""
	if job.Location.Name != "" {
		location = job.Location.Name
	}

	description := stripTags(html.UnescapeString(job.Content))
	formFields := greenhouseFormFields(job.Questions)

	return JobPayload{
		Source:        "greenhouse",
		JobURL:        listingURL,
		ApplyURL:      listingURL,
		Title:         title,
		Company:       company,
		Location:      location,
		Description:   description,
		FormFields:    formFields,
		SearchQueryID: searchQueryID,
	}, nil
}

func fetchLeverJob(ctx context.Context, listingURL string, searchQueryID *int64) (JobPayload, error) {
	company, postingID, err := parseLeverURL(listingURL)
	if err != nil {
		return JobPayload{}, err
	}

	apiURL := fmt.Sprintf("https://api.lever.co/v0/postings/%s/%s", company, postingID)
	var job leverPosting
	if err := getJSON(ctx, apiURL, &job); err != nil {
		return JobPayload{}, err
	}
	if job.ID == "" {
		return JobPayload{}, fmt.Errorf("lever posting not found")
	}

	title := strings.TrimSpace(job.Text)
	if title == "" {
		title = "Unknown Title"
	}

	applyURL := strings.TrimSpace(job.ApplyURL)
	if applyURL == "" {
		applyURL = listingApplyURL(listingURL, "lever")
	}

	formFields := enrichLeverFormFields(ctx, applyURL)

	return JobPayload{
		Source:        "lever",
		JobURL:        listingURL,
		ApplyURL:      applyURL,
		Title:         title,
		Company:       companyFromSlug(company),
		Location:      strings.TrimSpace(job.Categories.Location),
		Description:   leverDescription(job),
		FormFields:    formFields,
		SearchQueryID: searchQueryID,
	}, nil
}

func fetchAshbyJob(ctx context.Context, listingURL string, searchQueryID *int64) (JobPayload, error) {
	org, jobID, err := parseAshbyURL(listingURL)
	if err != nil {
		return JobPayload{}, err
	}

	apiURL := fmt.Sprintf("https://api.ashbyhq.com/posting-api/job-board/%s", org)
	var board ashbyJobBoard
	if err := getJSON(ctx, apiURL, &board); err != nil {
		return JobPayload{}, err
	}

	var match *ashbyJob
	for i := range board.Jobs {
		if strings.EqualFold(board.Jobs[i].ID, jobID) {
			match = &board.Jobs[i]
			break
		}
	}
	if match == nil {
		return JobPayload{}, fmt.Errorf("ashby job %s not found on board %s", jobID, org)
	}

	title := strings.TrimSpace(match.Title)
	if title == "" {
		title = "Unknown Title"
	}

	applyURL := strings.TrimSpace(match.ApplyURL)
	if applyURL == "" {
		applyURL = listingURL + "/application"
	}

	description := stripTags(match.DescriptionHTML)
	if description == "" {
		description = stripTags(match.DescriptionPlain)
	}

	formFields := enrichAshbyFormFields(ctx, applyURL)

	return JobPayload{
		Source:        "ashby",
		JobURL:        listingURL,
		ApplyURL:      applyURL,
		Title:         title,
		Company:       companyFromSlug(org),
		Location:      strings.TrimSpace(match.Location),
		Description:   description,
		FormFields:    formFields,
		SearchQueryID: searchQueryID,
	}, nil
}

func parseGreenhouseURL(listingURL string) (board, jobID string, err error) {
	u, err := url.Parse(listingURL)
	if err != nil {
		return "", "", err
	}
	m := greenhousePath.FindStringSubmatch(u.Path)
	if len(m) != 3 {
		return "", "", fmt.Errorf("invalid greenhouse URL: %s", listingURL)
	}
	return m[1], m[2], nil
}

func parseLeverURL(listingURL string) (company, postingID string, err error) {
	u, err := url.Parse(listingURL)
	if err != nil {
		return "", "", err
	}
	m := leverPath.FindStringSubmatch(u.Path)
	if len(m) != 3 {
		return "", "", fmt.Errorf("invalid lever URL: %s", listingURL)
	}
	return m[1], m[2], nil
}

func parseAshbyURL(listingURL string) (org, jobID string, err error) {
	u, err := url.Parse(listingURL)
	if err != nil {
		return "", "", err
	}
	m := ashbyPath.FindStringSubmatch(u.Path)
	if len(m) != 3 {
		return "", "", fmt.Errorf("invalid ashby URL: %s", listingURL)
	}
	return m[1], m[2], nil
}

func getJSON(ctx context.Context, rawURL string, dest any) error {
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PrismApply-Discovery/1.0")

	resp, err := atsHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d from %s", resp.StatusCode, rawURL)
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return err
	}
	return nil
}

func greenhouseFormFields(questions []greenhouseQuestion) []repo.FormFieldRow {
	var out []repo.FormFieldRow
	pos := 0
	for _, q := range questions {
		label := strings.TrimSpace(q.Label)
		if label == "" {
			continue
		}
		for _, f := range q.Fields {
			fieldType := mapGreenhouseFieldType(f.Type)
			options := greenhouseFieldOptions(f.Values)
			out = append(out, repo.FormFieldRow{
				Label:     label,
				FieldType: fieldType,
				Required:  q.Required,
				Options:   options,
				Position:  pos,
			})
			pos++
		}
	}
	return repo.DedupeFormFieldsByLabel(out)
}

func mapGreenhouseFieldType(raw string) string {
	switch raw {
	case "input_text":
		return "text"
	case "input_file":
		return "file"
	case "textarea":
		return "textarea"
	case "multi_value_single_select":
		return "select"
	case "multi_value_multi_select":
		return "select"
	default:
		return "text"
	}
}

func greenhouseFieldOptions(values []greenhouseFieldValue) []string {
	if len(values) == 0 {
		return nil
	}
	out := make([]string, 0, len(values))
	for _, v := range values {
		label := strings.TrimSpace(v.Label)
		if label == "" {
			label = fmt.Sprint(v.Value)
		}
		out = append(out, label)
	}
	return out
}

func leverDescription(job leverPosting) string {
	var parts []string
	if s := strings.TrimSpace(job.DescriptionPlain); s != "" {
		parts = append(parts, s)
	} else if s := strings.TrimSpace(stripTags(job.Description)); s != "" {
		parts = append(parts, s)
	}
	for _, list := range job.Lists {
		heading := strings.TrimSpace(list.Text)
		body := strings.TrimSpace(stripTags(list.Content))
		if heading != "" && body != "" {
			parts = append(parts, heading+"\n"+body)
		} else if body != "" {
			parts = append(parts, body)
		} else if heading != "" {
			parts = append(parts, heading)
		}
	}
	if s := strings.TrimSpace(job.AdditionalPlain); s != "" {
		parts = append(parts, s)
	}
	return strings.Join(parts, "\n\n")
}

func companyFromSlug(slug string) string {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return "Unknown Company"
	}
	slug = strings.NewReplacer("-", " ", "_", " ").Replace(slug)
	words := strings.Fields(slug)
	for i, w := range words {
		if len(w) == 0 {
			continue
		}
		words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
	}
	return strings.Join(words, " ")
}

type greenhouseJob struct {
	Title       string              `json:"title"`
	CompanyName string              `json:"company_name"`
	Content     string              `json:"content"`
	Location    greenhouseLocation  `json:"location"`
	Questions   []greenhouseQuestion `json:"questions"`
}

type greenhouseLocation struct {
	Name string `json:"name"`
}

type greenhouseQuestion struct {
	Label    string             `json:"label"`
	Required bool               `json:"required"`
	Fields   []greenhouseField  `json:"fields"`
}

type greenhouseField struct {
	Type   string                `json:"type"`
	Values []greenhouseFieldValue `json:"values"`
}

type greenhouseFieldValue struct {
	Label string `json:"label"`
	Value any    `json:"value"`
}

type leverPosting struct {
	ID              string         `json:"id"`
	Text            string         `json:"text"`
	Description     string         `json:"description"`
	DescriptionPlain string        `json:"descriptionPlain"`
	AdditionalPlain string         `json:"additionalPlain"`
	ApplyURL        string         `json:"applyUrl"`
	Categories      leverCategories `json:"categories"`
	Lists           []leverList    `json:"lists"`
}

type leverCategories struct {
	Location string `json:"location"`
}

type leverList struct {
	Text    string `json:"text"`
	Content string `json:"content"`
}

type ashbyJobBoard struct {
	Jobs []ashbyJob `json:"jobs"`
}

type ashbyJob struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Location         string `json:"location"`
	DescriptionHTML  string `json:"descriptionHtml"`
	DescriptionPlain string `json:"descriptionPlain"`
	ApplyURL         string `json:"applyUrl"`
	JobURL           string `json:"jobUrl"`
}

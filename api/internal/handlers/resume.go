package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"prismapply/api/internal/jsonx"
	"prismapply/api/internal/repo"
)

const maxResumeSize = 10 << 20 // 10 MB

type resumeAnalysisResponse struct {
	Profile json.RawMessage `json:"profile"`
	R2URL   string          `json:"r2Url"`
}

func (h *Handlers) PostResumeUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	if err := r.ParseMultipartForm(maxResumeSize); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid multipart form (max 10 MB)"})
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("resume")
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "missing 'resume' field"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(headExt(header.Filename))
	if ext != ".pdf" {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "only PDF files are accepted"})
		return
	}

	pdfData, err := io.ReadAll(io.LimitReader(file, maxResumeSize))
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not read file"})
		return
	}

	resumeText := strings.TrimSpace(r.FormValue("resumeText"))

	if resumeText == "" {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "missing 'resumeText' field (extracted PDF text)"})
		return
	}

	r2URL := h.storeOriginalResumePDF(userID, pdfData)

	parsedProfile, err := analyzeResumeWithAI(r.Context(), h.cfg.OpenAIAPIKey, h.cfg.OpenAIBaseURL, resumeText)
	if err != nil {
		slog.Warn("resume AI analysis failed, returning raw text", "error", err, "user_id", userID.String())
		parsedProfile = fallbackProfile(resumeText, r2URL)
	}
	if r2URL != "" {
		parsedProfile["resumePdfUrl"] = r2URL
	}
	parsedProfile["resumePlainText"] = resumeText

	existingRaw, _ := repo.GetProfile(r.Context(), h.Pool, userID)
	merged := mergeParsedProfileMaps(existingRaw, parsedProfile)
	if r2URL != "" {
		merged["resumePdfUrl"] = r2URL
	}
	merged["resumePlainText"] = resumeText

	profileJSON, err := json.Marshal(merged)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not marshal profile"})
		return
	}

	if err := repo.UpsertProfile(r.Context(), h.Pool, userID, profileJSON); err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not save profile"})
		return
	}

	jsonx.Write(w, http.StatusOK, resumeAnalysisResponse{
		Profile: profileJSON,
		R2URL:   r2URL,
	})
}

// storeOriginalResumePDF uploads the user's source resume PDF when R2 is configured.
// Onboarding continues without a stored PDF when R2 is missing or upload fails.
func (h *Handlers) storeOriginalResumePDF(userID uuid.UUID, pdfData []byte) string {
	if h.R2 == nil || !h.R2.Enabled() {
		slog.Warn("resume PDF not stored: R2 not configured", "user_id", userID.String())
		return ""
	}
	r2Key := fmt.Sprintf("resumes/%s/original.pdf", userID.String())
	if err := h.R2.Upload(r2Key, bytes.NewReader(pdfData), "application/pdf"); err != nil {
		slog.Warn("resume PDF not stored: r2 upload failed", "error", err, "user_id", userID.String())
		return ""
	}
	return h.R2.PublicURL(r2Key)
}

type resumeParseBody struct {
	ResumeText string `json:"resumeText"`
}

type resumeParseResponse struct {
	Profile json.RawMessage `json:"profile"`
}

// PostResumeParse extracts profile fields from pasted resume text (no PDF upload).
func (h *Handlers) PostResumeParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	defer r.Body.Close()
	b, err := io.ReadAll(io.LimitReader(r.Body, 512<<10))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid body"})
		return
	}

	var body resumeParseBody
	if err := json.Unmarshal(b, &body); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "body must be JSON with resumeText"})
		return
	}

	resumeText := strings.TrimSpace(body.ResumeText)
	if resumeText == "" {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "resumeText is required"})
		return
	}

	ctx := r.Context()
	existingRaw, _ := repo.GetProfile(ctx, h.Pool, userID)

	parsedProfile, err := analyzeResumeWithAI(ctx, h.cfg.OpenAIAPIKey, h.cfg.OpenAIBaseURL, resumeText)
	if err != nil {
		slog.Warn("resume AI analysis failed, returning raw text", "error", err, "user_id", userID.String())
		parsedProfile = fallbackProfile(resumeText, "")
	}

	parsedProfile["resumePlainText"] = resumeText
	merged := mergeParsedProfileMaps(existingRaw, parsedProfile)

	profileJSON, err := json.Marshal(merged)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not marshal profile"})
		return
	}

	if err := repo.UpsertProfile(ctx, h.Pool, userID, profileJSON); err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not save profile"})
		return
	}

	jsonx.Write(w, http.StatusOK, resumeParseResponse{Profile: profileJSON})
}

func mergeParsedProfileMaps(existing json.RawMessage, parsed map[string]any) map[string]any {
	out := map[string]any{}
	if len(existing) > 0 {
		_ = json.Unmarshal(existing, &out)
	}
	for k, v := range parsed {
		if isEmptyMergeValue(v) {
			continue
		}
		out[k] = v
	}
	return out
}

func isEmptyMergeValue(v any) bool {
	switch t := v.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(t) == ""
	case []any:
		return len(t) == 0
	case []string:
		return len(t) == 0
	case bool:
		return false
	case float64, int, int64:
		return false
	default:
		return false
	}
}

func headExt(filename string) string {
	idx := strings.LastIndex(filename, ".")
	if idx < 0 {
		return ""
	}
	return filename[idx:]
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatChoice struct {
	Message struct {
		Content string `json:"content"`
	} `json:"message"`
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func analyzeResumeWithAI(ctx context.Context, apiKey, baseURL, resumeText string) (map[string]any, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is not set")
	}
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	systemPrompt := `You are a resume parsing assistant. Extract structured information from the resume text provided by the user.

Return a JSON object with these fields (use empty string for missing data, empty array for missing arrays):
- fullName: string
- phoneNumber: string
- preferredName: string
- headline: string (one-line professional summary)
- currentCompany: string (most recent employer)
- cityOrDetail: string
- stateOrProvince: string (US state code e.g. CA, NY or Canadian province code e.g. ON, BC — empty if not US/CA)
- region: string (use slug: us, ca, eu_uk, latam, apac, mea, remote_first, other)
- linkedInUrl: string
- githubUrl: string
- portfolioUrl: string
- yearsExperience: string (slug: 0-1, 1-3, 3-5, 5-8, 8-12, 12+)
- seniorityTarget: string (slug: intern, junior, mid, senior, staff, principal, lead, manager, director)
- primaryDiscipline: string (slug: backend, frontend, fullstack, devops, data, ml, mobile, security, embedded, qa, product_eng, other)
- targetRolesNarrative: string (comma-separated role titles from resume)
- honestCareerNarrative: string (2-4 sentence career summary)
- proudestProfessionalWins: string (key achievements)
- skillsCoreNarrative: string (core technical strengths)
- selectedToolSlugs: array of strings (use slugs: aws, gcp, azure, k8s, docker, terraform, postgres, mysql, mongo, redis, kafka, spark, react, node, graphql, datadog, github_actions, other_tools)
- highestEducation: string (slug: high_school, associate, bachelors, masters, doctorate, bootcamp, self_taught, other)
- educationDetails: string
- workEntries: array of employment objects — include EVERY role from the Experience section. For each role:
  - company: string
  - role: string (job title)
  - startDate: string (e.g. "August 2024")
  - endDate: string (e.g. "May 2024" or empty if current)
  - isCurrent: boolean
  - employmentType: one of full_time, part_time, internship, coop, freelance (use full_time for regular employee roles)
  - summaryBullets: string — REQUIRED when the resume lists bullets under that role. Copy each accomplishment/responsibility bullet verbatim, one per line, prefixed with "• ". Do NOT omit bullets that appear in the source text.
- projects: array of objects with fields: kind (slug: side, open_source, bootcamp, work_sample, freelance, other), title, summary, primaryTechSlug (slug: typescript, python, go, rust, java, csharp, ruby, php, swift_kotlin, cpp, data_sql, mixed, other), impactMetrics, link
- resumePlainText: string (the full extracted resume text)

Be thorough. Extract everything you can. If a field cannot be determined from the resume, use an empty string or empty array.`

	body := chatRequest{
		Model:       "gpt-4o-mini",
		Temperature: 0.3,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: resumeText},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 120 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	defer res.Body.Close()

	rb, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var parsed chatResponse
	if err := json.Unmarshal(rb, &parsed); err != nil {
		return nil, fmt.Errorf("parse response: %w (http %d)", err, res.StatusCode)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return nil, fmt.Errorf("openai error: %s", parsed.Error.Message)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("openai http %d: %s", res.StatusCode, strings.TrimSpace(string(rb)))
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("openai returned no choices")
	}

	content := parsed.Choices[0].Message.Content
	var result map[string]any
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("parse AI output: %w", err)
	}

	normalizeParsedWorkEntries(result)
	return result, nil
}

func fallbackProfile(resumeText, r2URL string) map[string]any {
	return map[string]any{
		"resumePlainText":       resumeText,
		"resumeAttachmentName":  nil,
		"fullName":              "",
		"phoneNumber":           "",
		"preferredName":         "",
		"headline":              "",
		"currentCompany":        "",
		"cityOrDetail":          "",
		"stateOrProvince":       "",
		"region":                "",
		"linkedInUrl":           "",
		"githubUrl":             "",
		"portfolioUrl":          "",
		"yearsExperience":       "",
		"seniorityTarget":       "",
		"primaryDiscipline":     "",
		"targetRolesNarrative":  "",
		"honestCareerNarrative": "",
		"proudestProfessionalWins": "",
		"skillsCoreNarrative":   "",
		"selectedToolSlugs":     []string{},
		"highestEducation":      "",
		"educationDetails":      "",
		"workEntries":           []any{},
		"projects":              []any{},
		"storyHardestTechnicalChallenge":    "",
		"storyDisagreementOrConflict":       "",
		"storyBiggestMistake":              "",
		"storyLeadingWithoutAuthority":      "",
		"storyTightDeadline":               "",
		"storyConflictingPriorities":        "",
		"storyProcessImprovement":          "",
		"storyDifficultFeedback":            "",
		"storyMentoringTeaching":           "",
		"storyCrossFunctionalCollaboration": "",
		"storyAmbiguousProblem":            "",
		"storyEthicalOrRiskTradeoff":       "",
		"selectedIndustrySlugs":       []string{},
		"selectedRampAreaSlugs":       []string{},
		"selectedMotivationSlugs":     []string{},
		"selectedNextRoleDesireSlugs": []string{},
		"selectedDealbreakerSlugs":    []string{},
		"workArrangement":       "",
		"teamSizePreference":    "",
		"compensationBand":      "",
		"compensationExtraNote": "",
		"openToEquity":          false,
		"openToContract":        false,
		"openToRelocate":        false,
		"authorizedCountries":   []string{},
		"startAvailability":     "",
		"featuredProjectId":     "",
		"visaStatus":            "",
		"needsVisaSponsorship":  false,
		"workAuthOtherNote":     "",
		"comfortableSharingFailureStories": true,
		"companiesYouAdmire":        "",
		"industryOtherNote":         "",
		"toolsOtherNote":            "",
		"motivationsOtherNote":      "",
		"whatYouWantNextNote":       "",
		"dealBreakersOtherNote":     "",
		"disciplineOtherNote":       "",
		"gapsOrNonTraditionalPath":  "",
		"timezone":                  "",
		"timezoneOtherNote":         "",
		"otherLinks":                "",
		"resumePdfUrl":              r2URL,
	}
}

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

	r2Key := fmt.Sprintf("resumes/%s/original.pdf", userID.String())

	if h.R2 == nil || !h.R2.Enabled() {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "R2 storage not configured"})
		return
	}

	if err := h.R2.Upload(r2Key, bytes.NewReader(pdfData), "application/pdf"); err != nil {
		slog.Error("r2 upload failed", "error", err, "user_id", userID.String())
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "failed to store resume"})
		return
	}

	r2URL := h.R2.PublicURL(r2Key)

	parsedProfile, err := analyzeResumeWithAI(r.Context(), h.cfg.OpenAIAPIKey, h.cfg.OpenAIBaseURL, resumeText)
	if err != nil {
		slog.Warn("resume AI analysis failed, returning raw text", "error", err, "user_id", userID.String())
		parsedProfile = fallbackProfile(resumeText, r2URL)
	} else {
		parsedProfile["resumePdfUrl"] = r2URL
	}

	profileJSON, err := json.Marshal(parsedProfile)
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
- preferredName: string
- headline: string (one-line professional summary)
- cityOrDetail: string
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

	return result, nil
}

func fallbackProfile(resumeText, r2URL string) map[string]any {
	return map[string]any{
		"resumePlainText":       resumeText,
		"resumeAttachmentName":  nil,
		"fullName":              "",
		"preferredName":         "",
		"headline":              "",
		"cityOrDetail":          "",
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

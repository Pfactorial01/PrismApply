package matching

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// JobMatchContext is job posting context for LLM adjudication.
type JobMatchContext struct {
	Title       string
	Company     string
	Location    string
	Description string
}

// AdjudicateConfig controls Layer 3 LLM matching.
type AdjudicateConfig struct {
	Enabled   bool
	APIKey    string
	BaseURL   string
	Model     string
}

// AdjudicateMatch runs Layer 3 structured LLM check (mirrors orchestration adjudicateMatch.ts).
func AdjudicateMatch(ctx context.Context, cfg AdjudicateConfig, prefs UserPreferences, facts JobFacts, job JobMatchContext, score ScoreBreakdown) (AdjudicationResult, error) {
	if !cfg.Enabled {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), nil
	}
	apiKey := strings.TrimSpace(cfg.APIKey)
	if apiKey == "" {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), nil
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "gpt-4o-mini"
	}
	if strings.Contains(model, "/") {
		model = model[strings.LastIndex(model, "/")+1:]
	}
	baseURL := strings.TrimSpace(cfg.BaseURL)
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	system := `You are a job matching adjudicator. Given a user's hard preferences and a job posting, decide if this job should be recommended.

Rules:
- recommend=false if ANY hard preference or dealbreaker would be violated
- preference_violations must list specific violations (empty if none)
- Seniority target is a MINIMUM, not an exact level. Jobs at the user's target level are ideal (seniority_fit=good). Jobs ABOVE the target are acceptable (seniority_fit=over) — do NOT treat a more senior title as a preference violation. Only reject seniority when the job is clearly BELOW the user's target (seniority_fit=under).
- Be conservative on dealbreakers (defense, crypto, gambling, on-call, ads)`

	var prefBullets strings.Builder
	for _, b := range prefs.HardPreferenceBullets {
		prefBullets.WriteString("- ")
		prefBullets.WriteString(b)
		prefBullets.WriteString("\n")
	}

	sponsor := "unknown"
	if facts.RequiresSponsorship != nil {
		if *facts.RequiresSponsorship {
			sponsor = "yes"
		} else {
			sponsor = "no"
		}
	}
	oncall := "no"
	if facts.HasHeavyOncall {
		oncall = "yes"
	}
	industry := "none"
	if len(facts.IndustryTags) > 0 {
		industry = strings.Join(facts.IndustryTags, ", ")
	}
	desc := job.Description
	if len(desc) > 4000 {
		desc = desc[:4000]
	}
	loc := job.Location
	if loc == "" {
		loc = "unknown"
	}

	user := fmt.Sprintf(`## User hard preferences
%s
## Job
Title: %s
Company: %s
Location: %s
Remote policy: %s
Seniority: %s
Employment: %s
Industry signals: %s
On-call: %s
Visa sponsorship: %s

Description excerpt:
%s

## Vector score summary
final=%.3f resume=%.3f skills=%.3f`,
		prefBullets.String(),
		job.Title, job.Company, loc,
		facts.RemotePolicy, facts.SeniorityLevel, facts.EmploymentType,
		industry, oncall, sponsor,
		desc,
		score.FinalScore, score.ResumePosting, score.SkillsReqs,
	)

	schema := map[string]any{
		"type": "json_schema",
		"json_schema": map[string]any{
			"name":   "match_adjudication",
			"strict": true,
			"schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"recommend":               map[string]string{"type": "boolean"},
					"fit_score":               map[string]string{"type": "number"},
					"preference_violations":   map[string]any{"type": "array", "items": map[string]string{"type": "string"}},
					"strengths":               map[string]any{"type": "array", "items": map[string]string{"type": "string"}},
					"gaps":                    map[string]any{"type": "array", "items": map[string]string{"type": "string"}},
					"seniority_fit":           map[string]any{"type": "string", "enum": []string{"good", "stretch", "under", "over"}},
				},
				"required":             []string{"recommend", "fit_score", "preference_violations", "strengths", "gaps", "seniority_fit"},
				"additionalProperties": false,
			},
		},
	}

	body, err := json.Marshal(map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"response_format": schema,
		"temperature":     0.1,
	})
	if err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 90 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), err
	}
	defer res.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), err
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rb, &parsed); err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), fmt.Errorf("adjudicate parse: %w (http %d)", err, res.StatusCode)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), fmt.Errorf("openai: %s", parsed.Error.Message)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), fmt.Errorf("adjudicate http %d", res.StatusCode)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), nil
	}

	var out struct {
		Recommend            bool     `json:"recommend"`
		FitScore             float64  `json:"fit_score"`
		PreferenceViolations []string `json:"preference_violations"`
		Strengths            []string `json:"strengths"`
		Gaps                 []string `json:"gaps"`
		SeniorityFit         string   `json:"seniority_fit"`
	}
	if err := json.Unmarshal([]byte(parsed.Choices[0].Message.Content), &out); err != nil {
		return finalizeAdjudication(prefs, facts, adjudicateFallback(score, prefs, facts)), err
	}

	return finalizeAdjudication(prefs, facts, AdjudicationResult{
		Recommend:            out.Recommend,
		FitScore:             normalizeAdjudicationFitScore(out.FitScore, score),
		PreferenceViolations: out.PreferenceViolations,
		Strengths:            out.Strengths,
		Gaps:                 out.Gaps,
		SeniorityFit:         out.SeniorityFit,
	}), nil
}

func finalizeAdjudication(prefs UserPreferences, facts JobFacts, adj AdjudicationResult) AdjudicationResult {
	ReconcileAdjudicationSeniority(prefs, facts, &adj)
	return adj
}

func normalizeAdjudicationFitScore(raw float64, score ScoreBreakdown) int {
	fit := int(raw + 0.5)
	vectorPct := int(score.FinalScore*100 + 0.5)
	// LLM sometimes returns 0–1 scale or garbage; prefer vector-derived score.
	if fit <= 1 && vectorPct > 5 {
		return vectorPct
	}
	if fit < 0 || fit > 100 {
		return vectorPct
	}
	return fit
}

func adjudicateFallback(score ScoreBreakdown, prefs UserPreferences, facts JobFacts) AdjudicationResult {
	_, fit := CompareSeniority(prefs.SeniorityTarget, facts.SeniorityLevel)
	return AdjudicationResult{
		Recommend:            score.FinalScore >= FinalScoreFloor,
		FitScore:             int(score.FinalScore*100 + 0.5),
		PreferenceViolations: nil,
		Strengths:            nil,
		Gaps:                 nil,
		SeniorityFit:         fit,
	}
}

// AdjudicationAccepted returns true when Layer 3 allows storing the match.
func AdjudicationAccepted(a AdjudicationResult) bool {
	return a.Recommend && len(a.PreferenceViolations) == 0
}

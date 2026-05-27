package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/repo"
)

func main() {
	email := "adeoyeadebayo18+7@gmail.com"
	if len(os.Args) > 1 {
		email = os.Args[1]
	}
	cfg := config.FromEnv()
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer pool.Close()

	var userID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE email=$1`, email).Scan(&userID); err != nil {
		fmt.Fprintln(os.Stderr, "user:", err)
		os.Exit(1)
	}
	prefs, _ := repo.LoadUserPreferences(ctx, pool, userID)
	since := time.Now().Add(-30 * 24 * time.Hour)
	jobs, _ := repo.ListRecentJobsForUserMatch(ctx, pool, since)

	var gateOK, scoreOK int
	var top []struct {
		title, company string
		score          float64
		chunks         int
		gate           bool
	}

	for _, job := range jobs {
		facts := repo.JobRowToFacts(job)
		gate := matching.MatchEligible(prefs, facts)
		score, err := repo.ScoreUserJob(ctx, pool, userID, job.ID)
		if err != nil {
			continue
		}
		if gate.OK {
			gateOK++
		}
		if gate.OK && score.FinalScore >= matching.FinalScoreFloor && score.MatchedChunks >= matching.MinMatchedChunks {
			scoreOK++
			top = append(top, struct {
				title, company string
				score          float64
				chunks         int
				gate           bool
			}{job.Title, job.Company, score.FinalScore, score.MatchedChunks, gate.OK})
		}
	}

	fmt.Printf("User: %s (%d jobs)\n", email, len(jobs))
	fmt.Printf("Gate pass: %d | Score pass (>=%.2f, chunks>=%d): %d\n",
		gateOK, matching.FinalScoreFloor, matching.MinMatchedChunks, scoreOK)

	// sort top by score descending (simple bubble for small n)
	for i := 0; i < len(top); i++ {
		for j := i + 1; j < len(top); j++ {
			if top[j].score > top[i].score {
				top[i], top[j] = top[j], top[i]
			}
		}
	}
	limit := 15
	if len(top) < limit {
		limit = len(top)
	}
	fmt.Println("\nTop score-pass jobs:")
	for i := 0; i < limit; i++ {
		t := top[i]
		fmt.Printf("  %.3f chunks=%d | %s @ %s\n", t.score, t.chunks, t.title, t.company)
	}

	// Adjudication check for score-pass jobs
	if len(top) > 0 {
		fmt.Println("\nAdjudication (score-pass jobs):")
		adjudCfg := matching.AdjudicateConfig{
			Enabled: cfg.MatchAdjudicationEnabled,
			APIKey:  cfg.OpenAIAPIKey,
			BaseURL: cfg.OpenAIBaseURL,
			Model:   cfg.MatchAdjudicationModel,
		}
		for i := 0; i < limit && i < len(top); i++ {
			t := top[i]
			var job repo.JobRowForMatch
			for _, j := range jobs {
				if j.Title == t.title && j.Company == t.company {
					job = j
					break
				}
			}
			if job.ID == uuid.Nil {
				continue
			}
			facts := repo.JobRowToFacts(job)
			score, _ := repo.ScoreUserJob(ctx, pool, userID, job.ID)
			loc, desc := "", ""
			if job.Location != nil {
				loc = *job.Location
			}
			if job.Description != nil {
				desc = *job.Description
			}
			adjudCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
			adj, err := matching.AdjudicateMatch(adjudCtx, adjudCfg, prefs, facts, matching.JobMatchContext{
				Title: job.Title, Company: job.Company, Location: loc, Description: desc,
			}, score)
			cancel()
			if err != nil {
				fmt.Printf("  %s @ %s | adjudicate err: %v\n", t.title, t.company, err)
				continue
			}
			fmt.Printf("  %s @ %s | recommend=%v violations=%v seniority=%s\n",
				t.title, t.company, adj.Recommend, adj.PreferenceViolations, adj.SeniorityFit)
		}
	}

	// Near misses: gate pass but score fail
	fmt.Println("\nNear misses (gate OK, score below floor):")
	n := 0
	for _, job := range jobs {
		facts := repo.JobRowToFacts(job)
		gate := matching.MatchEligible(prefs, facts)
		if !gate.OK {
			continue
		}
		score, _ := repo.ScoreUserJob(ctx, pool, userID, job.ID)
		if score.FinalScore >= matching.FinalScoreFloor && score.MatchedChunks >= matching.MinMatchedChunks {
			continue
		}
		if score.FinalScore >= 0.45 {
			fmt.Printf("  %.3f chunks=%d | %s @ %s\n", score.FinalScore, score.MatchedChunks, job.Title, job.Company)
			n++
			if n >= 10 {
				break
			}
		}
	}
}

// Match-job runs reverse match pipeline for one job ID.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/repo"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/match-job <email> <job_id>")
		os.Exit(1)
	}
	email := os.Args[1]
	jobID, err := uuid.Parse(os.Args[2])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
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
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	prefs, _ := repo.LoadUserPreferences(ctx, pool, userID)

	var job repo.JobRowForMatch
	err = pool.QueryRow(ctx, `
		SELECT id, title, company, location, description, remote_policy, employment_type,
		       seniority_level, requires_sponsorship, industry_tags, has_heavy_oncall
		FROM discovered_jobs WHERE id=$1`, jobID).Scan(
		&job.ID, &job.Title, &job.Company, &job.Location, &job.Description,
		&job.RemotePolicy, &job.EmploymentType, &job.SeniorityLevel,
		&job.RequiresSponsorship, &job.IndustryTags, &job.HasHeavyOncall)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	facts := repo.JobRowToFacts(job)
	gate := matching.MatchEligible(prefs, facts)
	fmt.Printf("gate OK=%v reasons=%v\n", gate.OK, gate.Reasons)

	score, err := repo.ScoreUserJob(ctx, pool, userID, jobID)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("score=%.3f chunks=%d floor=%.2f minChunks=%d\n",
		score.FinalScore, score.MatchedChunks, matching.FinalScoreFloor, matching.MinMatchedChunks)

	loc, desc := "", ""
	if job.Location != nil {
		loc = *job.Location
	}
	if job.Description != nil {
		desc = *job.Description
	}
	adjudCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	adj, err := matching.AdjudicateMatch(adjudCtx, matching.AdjudicateConfig{
		Enabled: cfg.MatchAdjudicationEnabled,
		APIKey:  cfg.OpenAIAPIKey,
		BaseURL: cfg.OpenAIBaseURL,
		Model:   cfg.MatchAdjudicationModel,
	}, prefs, facts, matching.JobMatchContext{
		Title: job.Title, Company: job.Company, Location: loc, Description: desc,
	}, score)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "adjudicate: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("adjudicate recommend=%v violations=%v accepted=%v\n",
		adj.Recommend, adj.PreferenceViolations, matching.AdjudicationAccepted(adj))

	ms := float32(score.FinalScore)
	tierOK := matching.MatchPassesTierFilter(prefs, &ms, &score, &adj)
	fmt.Printf("tier filter OK=%v mode=%q\n", tierOK, prefs.MatchTierMode)

	if !gate.OK || score.FinalScore < matching.FinalScoreFloor || score.MatchedChunks < matching.MinMatchedChunks {
		fmt.Println("pipeline failed before insert")
		os.Exit(1)
	}
	if !matching.AdjudicationAccepted(adj) || !tierOK {
		fmt.Println("pipeline failed adjudication/tier before insert")
		os.Exit(1)
	}

	matchReason := map[string]any{
		"gate": gate, "direction": "reverse",
		"strengths": adj.Strengths, "gaps": adj.Gaps,
	}
	matchID, err := repo.InsertJobMatchV2(ctx, pool, userID, jobID, ms, score.MatchedChunks, true, score, matchReason)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			fmt.Println("match already exists (conflict)")
			os.Exit(0)
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("inserted match_id=%d score=%.3f\n", matchID, score.FinalScore)

	if cfg.RedisURL != "" {
		rdb, err := redisx.New(cfg)
		if err == nil {
			defer func() { _ = rdb.Close() }()
			if err := jobs.EnqueueMatch(ctx, rdb, matchID); err != nil {
				fmt.Fprintf(os.Stderr, "enqueue: %v\n", err)
			} else {
				fmt.Printf("enqueued match_id=%d\n", matchID)
			}
		}
	}
}

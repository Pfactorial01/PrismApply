// Check adjudication for specific job IDs.
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
	email := "adeoyeadebayo18@gmail.com"
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
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	prefs, _ := repo.LoadUserPreferences(ctx, pool, userID)

	ids := []string{
		"1a8f50ce-1775-4558-89cd-f15addc0f19a",
		"23890baa-f7ca-494d-879a-5c339d65f9b3",
		"ee5ea7e2-1d28-4251-90c1-1a2662d166a7",
		"c9f86572-1903-4686-8daf-149efda4c98f",
	}
	adjudCfg := matching.AdjudicateConfig{
		Enabled: true, APIKey: cfg.OpenAIAPIKey, BaseURL: cfg.OpenAIBaseURL, Model: cfg.MatchAdjudicationModel,
	}
	for _, id := range ids {
		var job repo.JobRowForMatch
		err := pool.QueryRow(ctx, `
			SELECT id, title, company, location, description, remote_policy, employment_type,
			       seniority_level, requires_sponsorship, industry_tags, has_heavy_oncall
			FROM discovered_jobs WHERE id=$1`, id).Scan(
			&job.ID, &job.Title, &job.Company, &job.Location, &job.Description,
			&job.RemotePolicy, &job.EmploymentType, &job.SeniorityLevel,
			&job.RequiresSponsorship, &job.IndustryTags, &job.HasHeavyOncall)
		if err != nil {
			fmt.Println(id, err)
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
			fmt.Printf("%s @ %s | score=%.3f adjudicate err: %v\n", job.Title, job.Company, score.FinalScore, err)
			continue
		}
		fmt.Printf("%s @ %s | score=%.3f chunks=%d recommend=%v violations=%v seniority=%s\n",
			job.Title, job.Company, score.FinalScore, score.MatchedChunks, adj.Recommend, adj.PreferenceViolations, adj.SeniorityFit)
	}
}

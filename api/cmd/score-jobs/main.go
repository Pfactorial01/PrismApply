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
	source := ""
	if len(os.Args) > 1 {
		email = os.Args[1]
	}
	if len(os.Args) > 2 {
		source = os.Args[2]
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
	rowsDB, err := pool.Query(ctx, `
		SELECT id, source, title, company, location, description, job_facts_json,
		       remote_policy, employment_type, seniority_level, requires_sponsorship,
		       industry_tags, has_heavy_oncall
		FROM discovered_jobs
		WHERE discovered_at >= $1 AND embedding IS NOT NULL
		ORDER BY discovered_at DESC`, since)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer rowsDB.Close()

	type row struct {
		score   float64
		chunks  int
		title   string
		company string
		source  string
		gate    bool
	}
	var rows []row
	for rowsDB.Next() {
		var job repo.JobRowForMatch
		var src string
		if err := rowsDB.Scan(&job.ID, &src, &job.Title, &job.Company, &job.Location, &job.Description, &job.JobFactsJSON,
			&job.RemotePolicy, &job.EmploymentType, &job.SeniorityLevel, &job.RequiresSponsorship,
			&job.IndustryTags, &job.HasHeavyOncall); err != nil {
			continue
		}
		if source != "" && src != source {
			continue
		}
		facts := repo.JobRowToFacts(job)
		gate := matching.MatchEligible(prefs, facts)
		score, err := repo.ScoreUserJob(ctx, pool, userID, job.ID)
		if err != nil {
			continue
		}
		rows = append(rows, row{
			score: score.FinalScore, chunks: score.MatchedChunks,
			title: job.Title, company: job.Company, source: src, gate: gate.OK,
		})
	}
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].score > rows[i].score {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
	fmt.Printf("User: %s filter=%q (%d jobs)\n", email, source, len(rows))
	for i, r := range rows {
		if i >= 20 {
			break
		}
		g := "gate=FAIL"
		if r.gate {
			g = "gate=OK"
		}
		fmt.Printf("  %.3f chunks=%d %s | %s @ %s [%s]\n", r.score, r.chunks, g, r.title, r.company, r.source)
	}
}

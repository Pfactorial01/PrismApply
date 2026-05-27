package discovery

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"prismapply/api/internal/config"
	"prismapply/api/internal/embeddings"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/repo"
)

type RunResult struct {
	QueriesRun            int
	URLsFound             int
	KnownURLs             int
	NewURLs               int
	JobsStored            int
	MatchJobsEnqueued     int
	Errors                int
}

// Run executes one discovery cycle: Serper → dedup → scrape → embed → enqueue process jobs.
func Run(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client, maxScrapes int) (RunResult, error) {
	if !cfg.DiscoveryEnabled {
		slog.Info("discovery_disabled")
		return RunResult{}, nil
	}
	if maxScrapes <= 0 {
		maxScrapes = cfg.DiscoveryMaxScrapesPerRun
	}

	var result RunResult
	queries, err := repo.LoadActiveDiscoveryQueries(ctx, pool)
	if err != nil {
		return result, err
	}

	type scrapeItem struct {
		URL           string
		Source        string
		SearchQueryID int64
	}
	var scrapeQueue []scrapeItem
	queuedThisRun := map[string]struct{}{}

	for _, q := range queries {
		if len(scrapeQueue) >= maxScrapes {
			break
		}
		urls, searchErr := SearchGoogle(ctx, cfg, q.Query)
		_ = repo.RecordDiscoveryQueryRun(ctx, pool, q.ID, len(urls))
		result.QueriesRun++
		result.URLsFound += len(urls)
		if searchErr != nil {
			result.Errors++
			slog.Warn("search_google_failed", "query_id", q.ID, "error", searchErr)
			continue
		}

		var items []repo.URLSource
		for _, u := range urls {
			src, ok := DetectSource(u)
			if !ok {
				continue
			}
			items = append(items, repo.URLSource{URL: NormalizeListingURL(u), Source: src})
		}
		dedup, err := repo.DedupJobURLs(ctx, pool, items)
		if err != nil {
			return result, err
		}
		result.KnownURLs += dedup.KnownCount
		for _, item := range dedup.NewURLs {
			if len(scrapeQueue) >= maxScrapes {
				break
			}
			key := item.Source + "\x00" + item.URL
			if _, seen := queuedThisRun[key]; seen {
				continue
			}
			queuedThisRun[key] = struct{}{}
			scrapeQueue = append(scrapeQueue, scrapeItem{URL: item.URL, Source: item.Source, SearchQueryID: q.ID})
		}
	}

	result.NewURLs = len(scrapeQueue)
	slog.Info("discovery_scrape_queue", "count", len(scrapeQueue))

	for _, item := range scrapeQueue {
		if jobID, found, err := repo.LookupDiscoveredJobID(ctx, pool, item.Source, item.URL); err != nil {
			result.Errors++
			slog.Warn("lookup_job_failed", "url", item.URL, "error", err)
			continue
		} else if found {
			result.KnownURLs++
			slog.Debug("job_skipped_exists", "url", item.URL, "job_id", jobID)
			continue
		}

		jobPayload, err := ScrapeAndEnrichJob(ctx, cfg, item.URL, item.Source, &item.SearchQueryID)
		if err != nil {
			result.Errors++
			slog.Warn("scrape_failed", "url", item.URL, "error", err)
			continue
		}
		jobID, inserted, err := EmbedAndStoreJob(ctx, cfg, pool, jobPayload)
		if err != nil {
			result.Errors++
			slog.Warn("embed_store_failed", "url", item.URL, "error", err)
			continue
		}
		if !inserted {
			slog.Debug("job_already_stored", "url", item.URL, "job_id", jobID)
			continue
		}
		slog.Info("job_stored", "url", item.URL, "job_id", jobID, "title", jobPayload.Title, "company", jobPayload.Company)
		result.JobsStored++
		if err := jobs.EnqueueProcessJob(ctx, rdb, jobID.String()); err != nil {
			result.Errors++
			slog.Warn("enqueue_process_job_failed", "job_id", jobID, "error", err)
			continue
		}
		result.MatchJobsEnqueued++
	}

	slog.Info("discovery_complete",
		"queries", result.QueriesRun,
		"stored", result.JobsStored,
		"errors", result.Errors,
	)
	return result, nil
}

// ProcessJob runs forward match for a discovered job and enqueues tailor jobs.
func ProcessJob(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client, jobID string) error {
	id, err := uuid.Parse(strings.TrimSpace(jobID))
	if err != nil {
		return err
	}
	matchIDs, err := repo.MatchJobToUsers(ctx, pool, id, matching.AdjudicateConfig{
		Enabled: cfg.MatchAdjudicationEnabled,
		APIKey:  cfg.OpenAIAPIKey,
		BaseURL: cfg.OpenAIBaseURL,
		Model:   cfg.MatchAdjudicationModel,
	})
	if err != nil {
		return err
	}
	for _, matchID := range matchIDs {
		if err := jobs.EnqueueMatch(ctx, rdb, matchID); err != nil {
			return err
		}
	}
	slog.Info("process_job_complete", "job_id", jobID, "matches", len(matchIDs))
	return nil
}

// SearchGoogle calls Serper and returns filtered ATS URLs.
func SearchGoogle(ctx context.Context, cfg config.Config, query string) ([]string, error) {
	if strings.TrimSpace(cfg.SerperAPIKey) == "" {
		return nil, fmt.Errorf("SERPER_API_KEY is not set")
	}
	q := withSearchFreshness(query, cfg.DiscoveryFreshnessDays)
	body := fmt.Sprintf(`{"q":%q,"num":%d}`, q, cfg.DiscoverySerperNumResults)

	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, "https://google.serper.dev/search", strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-KEY", cfg.SerperAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("serper HTTP %d", resp.StatusCode)
	}

	var parsed struct {
		Organic []struct {
			Link string `json:"link"`
		} `json:"organic"`
	}
	if err := jsonDecode(resp.Body, &parsed); err != nil {
		return nil, err
	}
	var links []string
	for _, o := range parsed.Organic {
		if o.Link != "" {
			links = append(links, o.Link)
		}
	}
	return FilterATSJobURLs(links), nil
}

func EmbedAndStoreJob(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, job JobPayload) (uuid.UUID, bool, error) {
	labels := make([]string, len(job.FormFields))
	for i, f := range job.FormFields {
		labels[i] = f.Label
	}
	facts := matching.ExtractJobFacts(job.Title, job.Company, job.Location, job.Description, labels)

	sections := matching.BuildJobSections(job.Title, job.Company, job.Location, job.Description, labels, facts)
	var sectionRows []repo.JobSectionRow
	var legacyEmbedding []float32

	if len(sections) > 0 {
		texts := make([]string, len(sections))
		for i, s := range sections {
			texts[i] = s.Content
		}
		embCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		vecs, err := embeddings.CreateEmbeddingsBatch(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, texts)
		cancel()
		if err != nil {
			return uuid.Nil, false, err
		}
		for i, s := range sections {
			sectionRows = append(sectionRows, repo.JobSectionRow{
				SectionKey: s.Key,
				Content:    s.Content,
				Embedding:  vecs[i],
			})
			if s.Key == matching.JobSectionPostingCore {
				legacyEmbedding = vecs[i]
			}
		}
		if len(legacyEmbedding) == 0 && len(vecs) > 0 {
			legacyEmbedding = vecs[0]
		}
	} else {
		legacyText := strings.Join([]string{job.Title, job.Company, job.Location, job.Description}, "\n")
		if strings.TrimSpace(legacyText) != "" {
			embCtx, cancel := context.WithTimeout(ctx, time.Minute)
			vec, err := embeddings.CreateEmbedding(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, legacyText)
			cancel()
			if err != nil {
				return uuid.Nil, false, err
			}
			legacyEmbedding = vec
		}
	}

	id, inserted, err := repo.InsertDiscoveredJob(ctx, pool, repo.DiscoveredJobInsert{
		Source:        job.Source,
		JobURL:        job.JobURL,
		ApplyURL:      job.ApplyURL,
		Title:         job.Title,
		Company:       job.Company,
		Location:      job.Location,
		Description:   job.Description,
		FormFields:    job.FormFields,
		SearchQueryID: job.SearchQueryID,
		Embedding:     legacyEmbedding,
		Facts:         facts,
		SectionRows:   sectionRows,
	})
	return id, inserted, err
}

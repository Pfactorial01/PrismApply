package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// FromEnv loads process configuration with sensible defaults for local dev.
func FromEnv() Config {
	port := 9001
	if s := os.Getenv("PORT"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			port = n
		}
	}

	accessMin := 15
	if s := os.Getenv("ACCESS_TOKEN_MINUTES"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			accessMin = n
		}
	}

	refreshDays := 14
	if s := os.Getenv("REFRESH_TOKEN_DAYS"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			refreshDays = n
		}
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" {
		jwtSecret = "dev-insecure-change-me"
	}

	embedQueue := strings.TrimSpace(os.Getenv("EMBEDDING_QUEUE_KEY"))
	if embedQueue == "" {
		embedQueue = "prismapply:embed:profile"
	}
	embedDLQ := strings.TrimSpace(os.Getenv("EMBEDDING_DLQ_KEY"))
	if embedDLQ == "" {
		embedDLQ = embedQueue + ":dlq"
	}
	embedModel := strings.TrimSpace(os.Getenv("EMBEDDING_MODEL"))
	if embedModel == "" {
		embedModel = "text-embedding-3-small"
	}
	openAIBase := strings.TrimSpace(os.Getenv("OPENAI_BASE_URL"))
	if openAIBase == "" {
		openAIBase = "https://api.openai.com/v1"
	}

	matchAdjudicationEnabled := true
	if v := strings.TrimSpace(os.Getenv("MATCH_ADJUDICATION_ENABLED")); v != "" {
		matchAdjudicationEnabled = !strings.EqualFold(v, "false") && v != "0"
	}
	matchAdjudicationModel := strings.TrimSpace(os.Getenv("MATCH_ADJUDICATION_MODEL"))
	if matchAdjudicationModel == "" {
		matchAdjudicationModel = "gpt-4o-mini"
	}

	r2Endpoint := strings.TrimSpace(os.Getenv("R2_ENDPOINT"))
	r2AccessKey := strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID"))
	r2SecretKey := strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY"))
	r2Bucket := strings.TrimSpace(os.Getenv("R2_BUCKET"))
	r2PublicURL := strings.TrimSpace(os.Getenv("R2_PUBLIC_URL"))

	tailorModel := strings.TrimSpace(os.Getenv("TAILOR_MODEL"))
	if tailorModel == "" {
		tailorModel = strings.TrimSpace(os.Getenv("MODEL"))
	}
	if tailorModel == "" {
		tailorModel = "gpt-4o-mini"
	}
	if strings.Contains(tailorModel, "/") {
		tailorModel = tailorModel[strings.LastIndex(tailorModel, "/")+1:]
	}

	chromePath := strings.TrimSpace(os.Getenv("CHROME_PATH"))
	if chromePath == "" {
		chromePath = "/usr/bin/google-chrome-stable"
	}

	matchQueue := strings.TrimSpace(os.Getenv("MATCH_QUEUE_KEY"))
	if matchQueue == "" {
		matchQueue = "prismapply:match:new"
	}
	jobProcessQueue := strings.TrimSpace(os.Getenv("JOB_PROCESS_QUEUE_KEY"))
	if jobProcessQueue == "" {
		jobProcessQueue = "prismapply:job:process"
	}
	jobsDLQ := strings.TrimSpace(os.Getenv("JOBS_DLQ_KEY"))
	if jobsDLQ == "" {
		jobsDLQ = "prismapply:jobs:dlq"
	}

	serperKey := strings.TrimSpace(os.Getenv("SERPER_API_KEY"))
	discoveryEnabled := !strings.EqualFold(strings.TrimSpace(os.Getenv("DISCOVERY_ENABLED")), "false")
	discoveryMaxScrapes := atoiDef(os.Getenv("DISCOVERY_MAX_SCRAPES_PER_RUN"), 50)
	discoverySerperNum := atoiDef(os.Getenv("DISCOVERY_SERPER_NUM_RESULTS"), 10)
	discoveryFreshnessDays := atoiDef(os.Getenv("DISCOVERY_SEARCH_FRESHNESS_DAYS"), 30)

	browserbaseKey := strings.TrimSpace(os.Getenv("BROWSERBASE_API_KEY"))
	browserbaseProject := strings.TrimSpace(os.Getenv("BROWSERBASE_PROJECT_ID"))
	scrapeEnv := strings.TrimSpace(os.Getenv("SCRAPE_ENV"))
	if scrapeEnv == "" {
		scrapeEnv = strings.TrimSpace(os.Getenv("ENV"))
	}
	if scrapeEnv == "" {
		scrapeEnv = "LOCAL"
	}

	return Config{
		Addr:              ":" + strconv.Itoa(port),
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
		RedisURL:          strings.TrimSpace(os.Getenv("REDIS_URL")),
		RedisAddr:         strings.TrimSpace(firstNonEmpty(os.Getenv("REDIS_ADDR"), "127.0.0.1:6379")),
		RedisPassword:     strings.TrimSpace(os.Getenv("REDIS_PASSWORD")),
		RedisDB:           atoiDef(os.Getenv("REDIS_DB"), 0),
		JWTSecret:         jwtSecret,
		AccessTokenTTL:    time.Duration(accessMin) * time.Minute,
		RefreshTokenTTL:   time.Duration(refreshDays) * 24 * time.Hour,
		CookieSecure:      strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true") || strings.EqualFold(os.Getenv("COOKIE_SECURE"), "1"),
		CookieDomain:      strings.TrimSpace(os.Getenv("COOKIE_DOMAIN")),
		OpenAIAPIKey:      strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		OpenAIBaseURL:     openAIBase,
		EmbeddingModel:    embedModel,
		EmbeddingQueueKey: embedQueue,
		EmbeddingDLQKey:   embedDLQ,
		MatchAdjudicationEnabled: matchAdjudicationEnabled,
		MatchAdjudicationModel:   matchAdjudicationModel,
		R2Endpoint:        r2Endpoint,
		R2AccessKeyID:     r2AccessKey,
		R2SecretAccessKey: r2SecretKey,
		R2Bucket:          r2Bucket,
		R2PublicURL:       r2PublicURL,
		TailorModel:              tailorModel,
		ChromePath:               chromePath,
		MatchQueueKey:            matchQueue,
		JobProcessQueueKey:       jobProcessQueue,
		JobsDLQKey:                 jobsDLQ,
		SerperAPIKey:               serperKey,
		DiscoveryEnabled:           discoveryEnabled,
		DiscoveryMaxScrapesPerRun:  discoveryMaxScrapes,
		DiscoverySerperNumResults:  discoverySerperNum,
		DiscoveryFreshnessDays:     discoveryFreshnessDays,
		BrowserbaseAPIKey:          browserbaseKey,
		BrowserbaseProjectID:       browserbaseProject,
		ScrapeEnv:                  scrapeEnv,
	}
}

type Config struct {
	Addr              string
	DatabaseURL       string
	RedisURL          string // optional; redis://:pass@host:6379/0 — when set, overrides RedisAddr/Password/DB in redisx.New
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	JWTSecret         string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	CookieSecure      bool
	CookieDomain      string
	OpenAIAPIKey      string
	OpenAIBaseURL     string
	EmbeddingModel    string
	EmbeddingQueueKey string
	EmbeddingDLQKey   string
	MatchAdjudicationEnabled bool
	MatchAdjudicationModel   string
	R2Endpoint        string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicURL       string
	TailorModel              string
	ChromePath               string
	MatchQueueKey            string
	JobProcessQueueKey       string
	JobsDLQKey               string
	SerperAPIKey             string
	DiscoveryEnabled         bool
	DiscoveryMaxScrapesPerRun int
	DiscoverySerperNumResults int
	DiscoveryFreshnessDays   int
	BrowserbaseAPIKey        string
	BrowserbaseProjectID     string
	ScrapeEnv                string
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func atoiDef(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

// ToPgxMigrateDSN converts postgres:// URLs to the scheme golang-migrate's pgx5 driver expects.
func ToPgxMigrateDSN(dsn string) string {
	dsn = strings.TrimSpace(dsn)
	if strings.HasPrefix(dsn, "pgx5://") {
		return dsn
	}
	dsn = strings.TrimPrefix(dsn, "postgresql://")
	if strings.HasPrefix(dsn, "postgres://") {
		return "pgx5://" + strings.TrimPrefix(dsn, "postgres://")
	}
	return "pgx5://" + dsn
}

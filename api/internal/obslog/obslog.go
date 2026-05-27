package obslog

import (
	"log/slog"
	"os"
)

// Init configures JSON logs to stdout for API and worker processes.
func Init(service string) {
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	l := slog.New(h).With("service", service)
	slog.SetDefault(l)
}

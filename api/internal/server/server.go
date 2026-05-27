package server

import (
	"log/slog"
	"net/http"
	"time"

	"prismapply/api/internal/handlers"
	"prismapply/api/internal/requestid"
)

// NewRouter wires HTTP routes (Go 1.22+ method-aware patterns on ServeMux).
func NewRouter(h *handlers.Handlers) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/api/health", handlers.Health)

	mux.HandleFunc("POST /api/auth/signup", h.PostSignup)
	mux.HandleFunc("POST /api/auth/login", h.PostLogin)
	mux.HandleFunc("POST /api/auth/logout", h.PostLogout)
	mux.HandleFunc("POST /api/auth/refresh", h.PostRefresh)
	mux.HandleFunc("GET /api/auth/me", h.GetAuthMe)

	mux.HandleFunc("GET /api/profile", h.GetProfile)
	mux.HandleFunc("PUT /api/profile", h.PutProfile)
	mux.HandleFunc("POST /api/profile", h.PostProfileSubmit)
	mux.HandleFunc("POST /api/profile/", h.PostProfileSubmit)
	mux.HandleFunc("POST /api/profile/submit", h.PostProfileSubmit)
	mux.HandleFunc("POST /api/resume/upload", h.PostResumeUpload)
	mux.HandleFunc("GET /api/applications", h.GetApplications)
	mux.HandleFunc("GET /api/applications/{id}/resume.pdf", h.GetApplicationResumePDF)
	mux.HandleFunc("GET /api/applications/{id}/cover-letter.pdf", h.GetApplicationCoverLetterPDF)
	mux.HandleFunc("PATCH /api/applications/{id}/mark-sent", h.PatchApplicationMarkSent)
	mux.HandleFunc("GET /api/settings", h.GetSettings)
	mux.HandleFunc("PATCH /api/settings", h.PatchSettings)

	return requestIDMiddleware(loggingMiddleware(mux))
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := requestid.FromRequest(r)
		w.Header().Set(requestid.HeaderName(), id)
		ctx := requestid.WithContext(r.Context(), id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)
		slog.Info("http_request",
			"request_id", requestid.FromContext(r.Context()),
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.status,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

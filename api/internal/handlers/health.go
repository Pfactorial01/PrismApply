package handlers

import (
	"net/http"
	"time"

	"prismapply/api/internal/jsonx"
)

type healthResponse struct {
	Status  string    `json:"status"`
	Service string    `json:"service"`
	Time    time.Time `json:"time"`
}

// Health handles GET /health and GET /api/health.
func Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	jsonx.Write(w, http.StatusOK, healthResponse{
		Status:  "ok",
		Service: "prismapply-api",
		Time:    time.Now().UTC(),
	})
}

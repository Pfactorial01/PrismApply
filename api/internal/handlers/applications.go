package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"prismapply/api/internal/jsonx"
	"prismapply/api/internal/repo"
)

func (h *Handlers) GetApplicationResumePDF(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	appID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid application id"})
		return
	}

	app, err := repo.GetTailoredApplicationByID(r.Context(), h.Pool, userID, appID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load application"})
		return
	}
	if app == nil {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "application not found"})
		return
	}
	if strings.TrimSpace(app.ResumePdfURL) == "" {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "resume PDF not available"})
		return
	}

	filename := strings.TrimSpace(app.ResumeFilename)
	if filename == "" {
		filename = fmt.Sprintf("%s_Resume.pdf", sanitizeFilenamePart(app.Company))
	}

	var pdf []byte
	if h.R2 != nil && h.R2.Enabled() {
		key := fmt.Sprintf("resumes/%s/%d.pdf", userID.String(), app.MatchID)
		pdf, err = h.R2.Get(key)
		if err != nil {
			jsonx.Write(w, http.StatusBadGateway, map[string]string{"message": "could not fetch resume PDF"})
			return
		}
	} else {
		jsonx.Write(w, http.StatusServiceUnavailable, map[string]string{"message": "PDF storage not configured"})
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdf)))
	_, _ = w.Write(pdf)
}

func (h *Handlers) GetApplicationCoverLetterPDF(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	appID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid application id"})
		return
	}

	app, err := repo.GetTailoredApplicationByID(r.Context(), h.Pool, userID, appID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load application"})
		return
	}
	if app == nil {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "application not found"})
		return
	}
	if strings.TrimSpace(app.CoverLetterPdfURL) == "" {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "cover letter PDF not available"})
		return
	}

	filename := strings.TrimSpace(app.CoverLetterFilename)
	if filename == "" {
		filename = fmt.Sprintf("%s_Cover_Letter.pdf", sanitizeFilenamePart(app.Company))
	}

	if h.R2 == nil || !h.R2.Enabled() {
		jsonx.Write(w, http.StatusServiceUnavailable, map[string]string{"message": "PDF storage not configured"})
		return
	}
	key := fmt.Sprintf("cover-letters/%s/%s", userID.String(), filename)
	pdf, err := h.R2.Get(key)
	if err != nil {
		jsonx.Write(w, http.StatusBadGateway, map[string]string{"message": "could not fetch cover letter PDF"})
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdf)))
	_, _ = w.Write(pdf)
}

func sanitizeFilenamePart(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		} else if r == ' ' {
			b.WriteRune('_')
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		return "Resume"
	}
	if len(out) > 40 {
		return out[:40]
	}
	return out
}

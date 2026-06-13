package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"prismapply/api/internal/jsonx"
	"prismapply/api/internal/repo"
)

type authMeResponse struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"isAdmin"`
}

func (h *Handlers) requireAdmin(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return uuid.Nil, false
	}
	isAdmin, err := repo.IsUserAdmin(r.Context(), h.Pool, userID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "authorization check failed"})
		return uuid.Nil, false
	}
	if !isAdmin {
		jsonx.Write(w, http.StatusForbidden, map[string]string{"error": "admin access required"})
		return uuid.Nil, false
	}
	return userID, true
}

func parseListParams(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0
	if s := strings.TrimSpace(r.URL.Query().Get("limit")); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if s := strings.TrimSpace(r.URL.Query().Get("offset")); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n >= 0 {
			offset = n
		}
	}
	return limit, offset
}

func parseOptionalUUID(raw string) *uuid.UUID {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil
	}
	return &id
}

func parseOptionalBool(raw string) *bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return nil
	}
	v := raw == "true" || raw == "1" || raw == "yes"
	return &v
}

func (h *Handlers) GetAdminStats(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	stats, err := repo.GetAdminStats(r.Context(), h.Pool)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load stats"})
		return
	}
	jsonx.Write(w, http.StatusOK, stats)
}

func (h *Handlers) GetAdminUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	limit, offset := parseListParams(r)
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	result, err := repo.ListAdminUsers(r.Context(), h.Pool, limit, offset, search)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load users"})
		return
	}
	jsonx.Write(w, http.StatusOK, result)
}

func (h *Handlers) GetAdminUser(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	userID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid user id"})
		return
	}
	user, err := repo.GetAdminUserDetail(r.Context(), h.Pool, userID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load user"})
		return
	}
	if user == nil {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "user not found"})
		return
	}
	jsonx.Write(w, http.StatusOK, user)
}

func (h *Handlers) GetAdminMatches(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	limit, offset := parseListParams(r)
	q := r.URL.Query()
	filters := repo.AdminMatchFilters{
		UserID: parseOptionalUUID(q.Get("userId")),
		Status: strings.TrimSpace(q.Get("status")),
		HasApp: parseOptionalBool(q.Get("hasApplication")),
		Search: strings.TrimSpace(q.Get("search")),
	}
	result, err := repo.ListAdminMatches(r.Context(), h.Pool, limit, offset, filters)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load matches"})
		return
	}
	jsonx.Write(w, http.StatusOK, result)
}

func (h *Handlers) GetAdminMatch(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	matchID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || matchID <= 0 {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid match id"})
		return
	}
	match, err := repo.GetAdminMatchByID(r.Context(), h.Pool, matchID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load match"})
		return
	}
	if match == nil {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "match not found"})
		return
	}
	jsonx.Write(w, http.StatusOK, match)
}

func (h *Handlers) GetAdminApplications(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	limit, offset := parseListParams(r)
	q := r.URL.Query()
	filters := repo.AdminApplicationFilters{
		UserID:     parseOptionalUUID(q.Get("userId")),
		Status:     strings.TrimSpace(q.Get("status")),
		MarkedSent: parseOptionalBool(q.Get("markedSent")),
		Search:     strings.TrimSpace(q.Get("search")),
	}
	result, err := repo.ListAdminApplications(r.Context(), h.Pool, limit, offset, filters)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load applications"})
		return
	}
	jsonx.Write(w, http.StatusOK, result)
}

func (h *Handlers) GetAdminApplication(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	appID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid application id"})
		return
	}
	app, err := repo.GetAdminApplicationByID(r.Context(), h.Pool, appID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load application"})
		return
	}
	if app == nil {
		jsonx.Write(w, http.StatusNotFound, map[string]string{"message": "application not found"})
		return
	}
	jsonx.Write(w, http.StatusOK, app)
}

func (h *Handlers) GetAdminJobRuns(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	limit, offset := parseListParams(r)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	result, err := repo.ListAdminJobRuns(r.Context(), h.Pool, limit, offset, status)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load job runs"})
		return
	}
	jsonx.Write(w, http.StatusOK, result)
}

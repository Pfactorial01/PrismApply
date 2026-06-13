package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"prismapply/api/internal/auth"
	"prismapply/api/internal/config"
	"prismapply/api/internal/embedqueue"
	"prismapply/api/internal/jsonx"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/profilemode"
	"prismapply/api/internal/r2"
	"prismapply/api/internal/repo"
	"prismapply/api/internal/requestid"
)

type Handlers struct {
	Pool            *pgxpool.Pool
	Auth            *auth.Service
	RDB             *redis.Client
	EmbedQueueKey   string
	R2              *r2.Client
	cfg             config.Config
}

func NewHandlers(pool *pgxpool.Pool, authSvc *auth.Service, rdb *redis.Client, embedQueueKey string, r2Client *r2.Client, cfg config.Config) *Handlers {
	return &Handlers{Pool: pool, Auth: authSvc, RDB: rdb, EmbedQueueKey: embedQueueKey, R2: r2Client, cfg: cfg}
}

type credsBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func readJSONBody(r *http.Request, max int64, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, max))
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func (h *Handlers) PostSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	var body credsBody
	if err := readJSONBody(r, 1<<20, &body); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || body.Password == "" {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "email and password required"})
		return
	}
	hash, err := h.Auth.HashPassword(body.Password)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not hash password"})
		return
	}
	id, err := repo.CreateUser(ctx, h.Pool, body.Email, hash, h.cfg.IsAdminEmail(body.Email))
	if errors.Is(err, repo.ErrEmailExists) {
		jsonx.Write(w, http.StatusConflict, map[string]string{"message": "email already registered"})
		return
	}
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not create user"})
		return
	}
	email := strings.ToLower(body.Email)
	if err := h.Auth.IssueAuthCookies(ctx, w, id, email); err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not start session"})
		return
	}
	jsonx.Write(w, http.StatusCreated, authMeResponse{ID: id.String(), Email: email, IsAdmin: h.cfg.IsAdminEmail(email)})
}

func (h *Handlers) PostLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	var body credsBody
	if err := readJSONBody(r, 1<<20, &body); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || body.Password == "" {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "email and password required"})
		return
	}
	u, hash, err := repo.UserByEmail(ctx, h.Pool, body.Email)
	if errors.Is(err, repo.ErrNotFound) {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"message": "invalid credentials"})
		return
	}
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "lookup failed"})
		return
	}
	if !h.Auth.CheckPassword(hash, body.Password) {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"message": "invalid credentials"})
		return
	}
	if h.cfg.IsAdminEmail(u.Email) {
		if err := repo.EnsureAdminByEmail(ctx, h.Pool, u.Email); err != nil {
			slog.Warn("admin sync failed on login", "error", err, "email", u.Email)
		} else {
			u.IsAdmin = true
		}
	}
	if err := h.Auth.IssueAuthCookies(ctx, w, u.ID, u.Email); err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not start session"})
		return
	}
	jsonx.Write(w, http.StatusOK, authMeResponse{ID: u.ID.String(), Email: u.Email, IsAdmin: u.IsAdmin})
}

func (h *Handlers) PostLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	h.Auth.Logout(r.Context(), w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) PostRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	if err := h.Auth.RefreshAccessCookie(ctx, w, r); err != nil {
		if errors.Is(err, auth.ErrNoAuth) {
			jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
			return
		}
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "refresh failed"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) GetAuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	claims, err := h.Auth.ParseAccessToken(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	u, err := repo.UserByID(ctx, h.Pool, id)
	if errors.Is(err, repo.ErrNotFound) {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "lookup failed"})
		return
	}
	if h.cfg.IsAdminEmail(u.Email) && !u.IsAdmin {
		if err := repo.EnsureAdminByEmail(ctx, h.Pool, u.Email); err != nil {
			slog.Warn("admin sync failed on /me", "error", err, "email", u.Email)
		} else {
			u.IsAdmin = true
		}
	}
	jsonx.Write(w, http.StatusOK, authMeResponse{ID: u.ID.String(), Email: u.Email, IsAdmin: u.IsAdmin})
}

func (h *Handlers) GetProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	id, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	raw, err := repo.GetProfile(ctx, h.Pool, id)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load profile"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// parseUpsertProfileRequest validates auth and JSON body for profile create/update.
func (h *Handlers) parseUpsertProfileRequest(w http.ResponseWriter, r *http.Request) (uuid.UUID, json.RawMessage, bool) {
	id, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return uuid.Nil, nil, false
	}
	defer r.Body.Close()
	b, err := io.ReadAll(io.LimitReader(r.Body, 4<<20))
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid body"})
		return uuid.Nil, nil, false
	}
	if !json.Valid(b) {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "body must be JSON"})
		return uuid.Nil, nil, false
	}
	return id, json.RawMessage(b), true
}

func (h *Handlers) upsertProfile(w http.ResponseWriter, r *http.Request, enqueueEmbed bool) {
	id, raw, ok := h.parseUpsertProfileRequest(w, r)
	if !ok {
		return
	}
	normalized, err := profilemode.NormalizeProfileJSON(raw)
	if err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid profile JSON"})
		return
	}
	raw = normalized
	if enqueueEmbed {
		stamped, err := profilemode.StampProfileSubmittedAt(raw)
		if err != nil {
			jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid profile JSON"})
			return
		}
		raw = stamped
	}
	if err := repo.UpsertProfile(r.Context(), h.Pool, id, raw); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}
	if enqueueEmbed {
		prefs := matching.BuildUserPreferences(raw)
		prefs.ProfileMode = profilemode.DeriveProfileMode(raw)
		prefs.ResumeLayout = profilemode.DeriveResumeLayout(raw)
		if existing, err := repo.LoadUserPreferences(r.Context(), h.Pool, id); err == nil {
			if existing.MatchTierMode != "" {
				prefs.MatchTierMode = existing.MatchTierMode
			}
			prefs.AllowStretchMatches = existing.AllowStretchMatches
		}
		if err := repo.UpdateProfilePreferences(r.Context(), h.Pool, id, prefs); err != nil {
			slog.Warn("preferences_json update failed", "error", err, "user_id", id.String())
		}
		if n, err := repo.DeletePendingJobMatches(r.Context(), h.Pool, id); err != nil {
			slog.Warn("delete pending matches failed", "error", err, "user_id", id.String())
		} else if n > 0 {
			slog.Info("deleted stale pending matches", "count", n, "user_id", id.String())
		}
		h.enqueueProfileEmbed(r, id, raw)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) enqueueProfileEmbed(r *http.Request, userID uuid.UUID, profileJSON json.RawMessage) {
	if h.RDB == nil || !embedqueue.ProfileReadyForEmbed(profileJSON) {
		return
	}
	key := h.EmbedQueueKey
	if key == "" {
		key = embedqueue.DefaultQueueKey
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	reqID := requestid.FromContext(r.Context())
	if err := embedqueue.EnqueueProfileEmbed(ctx, h.RDB, key, userID, reqID); err != nil {
		slog.Error("embedqueue enqueue failed", "error", err, "user_id", userID.String(), "request_id", reqID)
	}
}

func (h *Handlers) PutProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	h.upsertProfile(w, r, false)
}

// PostProfileSubmit is the explicit form-submit path; upserts JSONB and enqueues embed/match work.
func (h *Handlers) PostProfileSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	h.upsertProfile(w, r, true)
}

func (h *Handlers) GetApplications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	apps, err := repo.GetTailoredApplications(r.Context(), h.Pool, userID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load applications"})
		return
	}
	if apps == nil {
		apps = []repo.TailoredApplication{}
	}
	jsonx.Write(w, http.StatusOK, apps)
}

type markSentBody struct {
	MarkedSent bool `json:"markedSent"`
}

func (h *Handlers) PatchApplicationMarkSent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
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
	var body markSentBody
	if err := readJSONBody(r, 1<<10, &body); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	if body.MarkedSent {
		err = repo.MarkApplicationSent(r.Context(), h.Pool, userID, appID)
	} else {
		err = repo.UnmarkApplicationSent(r.Context(), h.Pool, userID, appID)
	}
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not update application"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	settings, err := repo.GetUserSettings(r.Context(), h.Pool, userID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load settings"})
		return
	}
	jsonx.Write(w, http.StatusOK, settings)
}

type patchSettingsBody struct {
	MatchTierMode         string `json:"matchTierMode"`
	AllowStretchMatches   *bool  `json:"allowStretchMatches"`
}

func (h *Handlers) PatchSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID, err := h.Auth.UserIDFromAccess(r)
	if err != nil {
		jsonx.Write(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	var body patchSettingsBody
	if err := readJSONBody(r, 1<<10, &body); err != nil {
		jsonx.Write(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	mode := matching.NormalizeMatchTierMode(body.MatchTierMode)
	prefs, err := repo.LoadUserPreferences(r.Context(), h.Pool, userID)
	if err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not load settings"})
		return
	}
	prefs.MatchTierMode = mode
	if body.AllowStretchMatches != nil {
		prefs.AllowStretchMatches = *body.AllowStretchMatches
	}
	if err := repo.UpdateProfilePreferences(r.Context(), h.Pool, userID, prefs); err != nil {
		jsonx.Write(w, http.StatusInternalServerError, map[string]string{"message": "could not save settings"})
		return
	}
	if mode == matching.MatchTierModeStrongOnly {
		if _, err := repo.DeletePendingPromisingMatches(r.Context(), h.Pool, userID); err != nil {
			slog.Warn("delete pending promising matches failed", "error", err, "user_id", userID.String())
		}
	}
	if !prefs.AllowStretchMatches {
		if _, err := repo.DeletePendingStretchMatches(r.Context(), h.Pool, userID); err != nil {
			slog.Warn("delete pending stretch matches failed", "error", err, "user_id", userID.String())
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

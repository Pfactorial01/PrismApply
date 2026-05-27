package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"prismapply/api/internal/config"
)

const (
	CookieAccess  = "access_token"
	CookieRefresh = "refresh_token"
)

type Service struct {
	pool         *pgxpool.Pool
	redis        *redis.Client
	jwtSecret    []byte
	accessTTL    time.Duration
	refreshTTL   time.Duration
	secureCookie bool
	cookieDomain string
	bcryptCost   int
}

func NewService(cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client) *Service {
	return &Service{
		pool:         pool,
		redis:        rdb,
		jwtSecret:    []byte(cfg.JWTSecret),
		accessTTL:    cfg.AccessTokenTTL,
		refreshTTL:   cfg.RefreshTokenTTL,
		secureCookie: cfg.CookieSecure,
		cookieDomain: cfg.CookieDomain,
		bcryptCost:   bcrypt.DefaultCost,
	}
}

type accessClaims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

func refreshRedisKey(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return "prismapply:refresh:" + hex.EncodeToString(sum[:])
}

func randomToken() (string, error) {
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) HashPassword(plain string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(plain), s.bcryptCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func (s *Service) CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

func (s *Service) IssueAuthCookies(ctx context.Context, w http.ResponseWriter, userID uuid.UUID, email string) error {
	now := time.Now()
	ac := accessClaims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	accessJWT := jwt.NewWithClaims(jwt.SigningMethodHS256, ac)
	accessStr, err := accessJWT.SignedString(s.jwtSecret)
	if err != nil {
		return err
	}
	refresh, err := randomToken()
	if err != nil {
		return err
	}
	if err := s.redis.Set(ctx, refreshRedisKey(refresh), userID.String(), s.refreshTTL).Err(); err != nil {
		return err
	}
	s.setAccessCookie(w, accessStr)
	s.setRefreshCookie(w, refresh)
	return nil
}

func (s *Service) setAccessCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieAccess,
		Value:    value,
		Path:     "/",
		MaxAge:   int(s.accessTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.secureCookie,
		SameSite: http.SameSiteLaxMode,
		Domain:   s.cookieDomain,
	})
}

func (s *Service) setRefreshCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieRefresh,
		Value:    value,
		Path:     "/",
		MaxAge:   int(s.refreshTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.secureCookie,
		SameSite: http.SameSiteLaxMode,
		Domain:   s.cookieDomain,
	})
}

func (s *Service) ClearAuthCookies(w http.ResponseWriter) {
	for _, name := range []string{CookieAccess, CookieRefresh} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   s.secureCookie,
			SameSite: http.SameSiteLaxMode,
			Domain:   s.cookieDomain,
		})
	}
}

var ErrNoAuth = errors.New("not authenticated")

func (s *Service) ParseAccessToken(r *http.Request) (*accessClaims, error) {
	c, err := r.Cookie(CookieAccess)
	if err != nil || c.Value == "" {
		return nil, ErrNoAuth
	}
	var claims accessClaims
	tok, err := jwt.ParseWithClaims(c.Value, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil || !tok.Valid {
		return nil, ErrNoAuth
	}
	if claims.Subject == "" {
		return nil, ErrNoAuth
	}
	return &claims, nil
}

func (s *Service) UserIDFromAccess(r *http.Request) (uuid.UUID, error) {
	claims, err := s.ParseAccessToken(r)
	if err != nil {
		return uuid.Nil, err
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, ErrNoAuth
	}
	return id, nil
}

// RefreshAccessCookie reads the refresh cookie, validates Redis, and issues a new access cookie.
func (s *Service) RefreshAccessCookie(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	c, err := r.Cookie(CookieRefresh)
	if err != nil || c.Value == "" {
		return ErrNoAuth
	}
	userIDStr, err := s.redis.Get(ctx, refreshRedisKey(c.Value)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return ErrNoAuth
		}
		return err
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return ErrNoAuth
	}
	var email string
	if err := s.pool.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&email); err != nil {
		return ErrNoAuth
	}
	now := time.Now()
	ac := accessClaims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	accessJWT := jwt.NewWithClaims(jwt.SigningMethodHS256, ac)
	accessStr, err := accessJWT.SignedString(s.jwtSecret)
	if err != nil {
		return err
	}
	s.setAccessCookie(w, accessStr)
	return nil
}

func (s *Service) Logout(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(CookieRefresh); err == nil && c.Value != "" {
		_ = s.redis.Del(ctx, refreshRedisKey(c.Value)).Err()
	}
	s.ClearAuthCookies(w)
}

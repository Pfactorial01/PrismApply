package repo

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrEmailExists = errors.New("email exists")

type User struct {
	ID      uuid.UUID
	Email   string
	IsAdmin bool
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func IsUserAdmin(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (bool, error) {
	var isAdmin bool
	err := pool.QueryRow(ctx, `SELECT is_admin FROM users WHERE id = $1`, id).Scan(&isAdmin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, ErrNotFound
		}
		return false, err
	}
	return isAdmin, nil
}

// EnsureAdminByEmail promotes a user to admin when their email is in ADMIN_EMAILS.
func EnsureAdminByEmail(ctx context.Context, pool *pgxpool.Pool, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	_, err := pool.Exec(ctx, `
		UPDATE users SET is_admin = true, updated_at = now()
		WHERE lower(email) = $1 AND is_admin = false`, email)
	return err
}

func CreateUser(ctx context.Context, pool *pgxpool.Pool, email, passwordHash string, isAdmin bool) (uuid.UUID, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, is_admin)
		VALUES ($1, $2, $3)
		RETURNING id`, email, passwordHash, isAdmin).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return uuid.Nil, ErrEmailExists
		}
		return uuid.Nil, err
	}
	return id, nil
}

func UserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var hash string
	err := pool.QueryRow(ctx, `
		SELECT id, email, is_admin, password_hash FROM users WHERE lower(email) = $1`,
		email).Scan(&u.ID, &u.Email, &u.IsAdmin, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrNotFound
	}
	return u, hash, err
}

func UserByID(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `
		SELECT id, email, is_admin FROM users WHERE id = $1`, id).Scan(&u.ID, &u.Email, &u.IsAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

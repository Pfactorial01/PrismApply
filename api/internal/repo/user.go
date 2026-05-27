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
	ID    uuid.UUID
	Email string
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func CreateUser(ctx context.Context, pool *pgxpool.Pool, email, passwordHash string) (uuid.UUID, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id`, email, passwordHash).Scan(&id)
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
		SELECT id, email, password_hash FROM users WHERE lower(email) = $1`, email).Scan(&u.ID, &u.Email, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrNotFound
	}
	return u, hash, err
}

func UserByID(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `SELECT id, email FROM users WHERE id = $1`, id).Scan(&u.ID, &u.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

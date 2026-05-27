package requestid

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type ctxKey struct{}

const headerName = "X-Request-ID"

// FromRequest returns X-Request-ID if present and non-empty, otherwise a new UUID string.
func FromRequest(r *http.Request) string {
	if v := strings.TrimSpace(r.Header.Get(headerName)); v != "" {
		return v
	}
	return uuid.New().String()
}

// WithContext stores the request id for handlers and enqueue paths.
func WithContext(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// FromContext returns the request id or empty string.
func FromContext(ctx context.Context) string {
	v, _ := ctx.Value(ctxKey{}).(string)
	return v
}

// HeaderName is the outbound / inbound correlation header.
func HeaderName() string { return headerName }

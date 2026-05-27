package embeddings

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strings"
)

// Default chunking for RAG-sized inputs (~3–4k tokens per chunk with overlap).
const (
	DefaultChunkRunes   = 2000
	DefaultOverlapRunes = 200
)

// ChunkRunes splits s into overlapping rune windows for embedding.
func ChunkRunes(s string, chunkRunes, overlapRunes int) []string {
	if chunkRunes <= 0 {
		chunkRunes = DefaultChunkRunes
	}
	if overlapRunes < 0 || overlapRunes >= chunkRunes {
		overlapRunes = min(overlapRunes, chunkRunes/4)
	}
	r := []rune(s)
	if len(r) == 0 {
		return nil
	}
	var out []string
	for i := 0; i < len(r); {
		j := i + chunkRunes
		if j > len(r) {
			j = len(r)
		}
		out = append(out, string(r[i:j]))
		if j == len(r) {
			break
		}
		next := j - overlapRunes
		if next <= i {
			next = i + 1
		}
		i = next
	}
	return out
}

// CanonicalJobURL normalizes a job posting URL for deduplication (best-effort).
func CanonicalJobURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return strings.ToLower(strings.TrimRight(raw, "/"))
	}
	u.Scheme = strings.ToLower(u.Scheme)
	u.Host = strings.ToLower(u.Host)
	u.Fragment = ""
	u.RawQuery = ""
	for strings.HasSuffix(u.Path, "/") && len(u.Path) > 1 {
		u.Path = strings.TrimSuffix(u.Path, "/")
	}
	return u.String()
}

// SHA256Hex returns lowercase hex sha256 of s.
func SHA256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

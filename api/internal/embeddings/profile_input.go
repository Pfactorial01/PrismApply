package embeddings

import (
	"bytes"
	"encoding/json"
)

// maxProfileBytes caps JSON sent to the embedding model (rough safety under typical token limits).
const maxProfileBytes = 240_000

// ProfileJSONToEmbedInput turns stored profile JSON into a single string for one embedding vector.
func ProfileJSONToEmbedInput(raw []byte) string {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return ""
	}
	var buf bytes.Buffer
	if err := json.Compact(&buf, raw); err != nil {
		// invalid JSON should not reach here if DB enforces jsonb; fall back to raw string
		return string(truncateBytes(raw, maxProfileBytes))
	}
	return string(truncateBytes(buf.Bytes(), maxProfileBytes))
}

func truncateBytes(b []byte, max int) []byte {
	if len(b) <= max {
		return b
	}
	return b[:max]
}

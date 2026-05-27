package embeddings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultDims = 1536

type embedRequest struct {
	Model string `json:"model"`
	Input any `json:"input"` // string or []string
}

type embedResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// CreateEmbedding calls OpenAI-compatible POST {base}/embeddings for a single string.
func CreateEmbedding(ctx context.Context, apiKey, baseURL, model, input string) ([]float32, error) {
	vecs, err := CreateEmbeddingsBatch(ctx, apiKey, baseURL, model, []string{input})
	if err != nil {
		return nil, err
	}
	if len(vecs) == 0 {
		return nil, fmt.Errorf("empty embedding in response")
	}
	return vecs[0], nil
}

// CreateEmbeddingsBatch embeds multiple strings in one API call (order preserved).
func CreateEmbeddingsBatch(ctx context.Context, apiKey, baseURL, model string, inputs []string) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is not set")
	}
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	if model == "" {
		model = "text-embedding-3-small"
	}

	body, err := json.Marshal(embedRequest{Model: model, Input: inputs})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 120 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	var parsed embedResponse
	if err := json.Unmarshal(rb, &parsed); err != nil {
		return nil, fmt.Errorf("embeddings response: %w (http %d)", err, res.StatusCode)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return nil, fmt.Errorf("openai error: %s", parsed.Error.Message)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("embeddings http %d: %s", res.StatusCode, strings.TrimSpace(string(rb)))
	}
	if len(parsed.Data) != len(inputs) {
		return nil, fmt.Errorf("embeddings count mismatch got %d want %d", len(parsed.Data), len(inputs))
	}
	out := make([][]float32, len(inputs))
	for i, d := range parsed.Data {
		raw := d.Embedding
		if len(raw) != defaultDims {
			return nil, fmt.Errorf("embedding[%d] length %d, database expects %d", i, len(raw), defaultDims)
		}
		vec := make([]float32, len(raw))
		for j, x := range raw {
			vec[j] = float32(x)
		}
		out[i] = vec
	}
	return out, nil
}

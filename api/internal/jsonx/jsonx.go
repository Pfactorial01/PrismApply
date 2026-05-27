package jsonx

import (
	"encoding/json"
	"net/http"
)

// Write sends a JSON body with the given HTTP status.
func Write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

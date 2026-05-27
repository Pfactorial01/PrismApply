package repo

import (
	"strconv"
	"strings"
)

// FormatVector renders a float32 slice as a pgvector literal for casting to vector.
func FormatVector(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, x := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(x), 'f', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

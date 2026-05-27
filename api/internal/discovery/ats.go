package discovery

import (
	"encoding/json"
	"io"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var (
	leverListing = regexp.MustCompile(`^https://jobs\.lever\.co/[^/]+/[0-9a-f-]{36}`)
	greenhouse   = regexp.MustCompile(`^https://(boards|job-boards)\.greenhouse\.io/[^/]+/jobs/\d+`)
	ashbyListing = regexp.MustCompile(`^https://jobs\.ashbyhq\.com/[^/]+/[0-9a-f-]{36}`)
)

func NormalizeListingURL(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return strings.TrimSpace(raw)
	}
	u.Fragment = ""
	u.RawQuery = ""
	path := strings.TrimSuffix(u.Path, "/")
	for _, suffix := range []string{"/application", "/apply"} {
		if strings.HasSuffix(path, suffix) {
			path = strings.TrimSuffix(path, suffix)
			break
		}
	}
	u.Path = path
	return u.String()
}

func DetectSource(raw string) (string, bool) {
	n := NormalizeListingURL(raw)
	switch {
	case leverListing.MatchString(n):
		return "lever", true
	case greenhouse.MatchString(n):
		return "greenhouse", true
	case ashbyListing.MatchString(n):
		return "ashby", true
	default:
		return "", false
	}
}

func FilterATSJobURLs(links []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, link := range links {
		src, ok := DetectSource(link)
		if !ok {
			continue
		}
		n := NormalizeListingURL(link)
		key := src + "|" + n
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, n)
	}
	return out
}

func withSearchFreshness(query string, days int) string {
	if strings.Contains(strings.ToLower(query), "after:") {
		return query
	}
	if days <= 0 {
		days = 30
	}
	cutoff := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	return query + " after:" + cutoff
}

func jsonDecode(r io.Reader, dest any) error {
	return json.NewDecoder(r).Decode(dest)
}

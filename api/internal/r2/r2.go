package r2

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

type Client struct {
	endpoint       string
	accessKey      string
	secretKey      string
	bucket         string
	publicURL      string
	httpClient     *http.Client
}

func New(endpoint, accessKey, secretKey, bucket, publicURL string) *Client {
	e := strings.TrimRight(endpoint, "/")
	if !strings.Contains(e, "://") {
		e = "https://" + e
	}
	// R2 endpoints sometimes include the bucket as a path suffix — strip it
	if strings.HasSuffix(e, "/"+bucket) {
		e = e[:len(e)-len(bucket)-1]
	}

	pu := strings.TrimRight(publicURL, "/")
	return &Client{
		endpoint:   e,
		accessKey:  accessKey,
		secretKey:  secretKey,
		bucket:     bucket,
		publicURL:  pu,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c.endpoint != "" && c.accessKey != "" && c.secretKey != "" && c.bucket != ""
}

func (c *Client) PublicURL(key string) string {
	if c.publicURL == "" {
		return ""
	}
	return c.publicURL + "/" + strings.TrimPrefix(key, "/")
}

func (c *Client) Get(key string) ([]byte, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("r2 client not configured")
	}
	key = strings.TrimPrefix(key, "/")
	now := time.Now().UTC()
	region := "auto"
	service := "s3"
	bodyHash := "UNSIGNED-PAYLOAD"
	host := hostFromEndpoint(c.endpoint)
	path := "/" + c.bucket + "/" + key

	amzDate := now.Format("20060102T150405Z")
	dateStr := now.Format("20060102")

	headers := map[string]string{
		"host":                 host,
		"x-amz-content-sha256": bodyHash,
		"x-amz-date":           amzDate,
	}

	var sortedKeys []string
	for k := range headers {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	var signedHeaders []string
	for _, k := range sortedKeys {
		signedHeaders = append(signedHeaders, strings.ToLower(k))
	}

	var canonicalHeaders strings.Builder
	for _, k := range sortedKeys {
		canonicalHeaders.WriteString(strings.ToLower(k))
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(strings.TrimSpace(headers[k]))
		canonicalHeaders.WriteByte('\n')
	}

	canonicalRequest := strings.Join([]string{
		"GET",
		path,
		"",
		canonicalHeaders.String(),
		strings.Join(signedHeaders, ";"),
		bodyHash,
	}, "\n")

	credentialScope := dateStr + "/" + region + "/" + service + "/aws4_request"

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := hmacSHA256([]byte("AWS4"+c.secretKey), []byte(dateStr))
	signingKey = hmacSHA256(signingKey, []byte(region))
	signingKey = hmacSHA256(signingKey, []byte(service))
	signingKey = hmacSHA256(signingKey, []byte("aws4_request"))
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKey, credentialScope, strings.Join(signedHeaders, ";"), signature,
	)

	url := c.endpoint + path
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("x-amz-content-sha256", bodyHash)
	req.Header.Set("x-amz-date", amzDate)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("r2 get failed (HTTP %d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return io.ReadAll(resp.Body)
}

func (c *Client) Upload(key string, body io.Reader, contentType string) error {
	if !c.Enabled() {
		return fmt.Errorf("r2 client not configured")
	}

	data, err := io.ReadAll(body)
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}
	return c.putObject(key, data, contentType)
}

func (c *Client) putObject(key string, data []byte, contentType string) error {
	key = strings.TrimPrefix(key, "/")
	now := time.Now().UTC()
	region := "auto"
	service := "s3"

	bodyHash := "UNSIGNED-PAYLOAD"
	host := hostFromEndpoint(c.endpoint)

	path := "/" + c.bucket + "/" + key

	amzDate := now.Format("20060102T150405Z")
	dateStr := now.Format("20060102")

	headers := map[string]string{
		"host":                 host,
		"x-amz-content-sha256": bodyHash,
		"x-amz-date":           amzDate,
		"content-type":         contentType,
	}

	var sortedKeys []string
	for k := range headers {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	var signedHeaders []string
	for _, k := range sortedKeys {
		signedHeaders = append(signedHeaders, strings.ToLower(k))
	}

	var canonicalHeaders strings.Builder
	for _, k := range sortedKeys {
		canonicalHeaders.WriteString(strings.ToLower(k))
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(strings.TrimSpace(headers[k]))
		canonicalHeaders.WriteByte('\n')
	}

	canonicalRequest := strings.Join([]string{
		"PUT",
		path,
		"",
		canonicalHeaders.String(),
		strings.Join(signedHeaders, ";"),
		bodyHash,
	}, "\n")

	credentialScope := dateStr + "/" + region + "/" + service + "/aws4_request"

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := hmacSHA256([]byte("AWS4"+c.secretKey), []byte(dateStr))
	signingKey = hmacSHA256(signingKey, []byte(region))
	signingKey = hmacSHA256(signingKey, []byte(service))
	signingKey = hmacSHA256(signingKey, []byte("aws4_request"))
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKey, credentialScope, strings.Join(signedHeaders, ";"), signature,
	)

	url := c.endpoint + path

	req, err := http.NewRequest("PUT", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("x-amz-content-sha256", bodyHash)
	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("content-type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("upload request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("r2 upload failed (HTTP %d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

func hostFromEndpoint(endpoint string) string {
	e := strings.TrimPrefix(endpoint, "https://")
	e = strings.TrimPrefix(e, "http://")
	e = strings.Split(e, "/")[0]
	return e
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

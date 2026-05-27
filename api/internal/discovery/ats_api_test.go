package discovery

import (
	"context"
	"strings"
	"testing"
)

func TestParseGreenhouseURL(t *testing.T) {
	board, id, err := parseGreenhouseURL("https://boards.greenhouse.io/ripple/jobs/7930279")
	if err != nil || board != "ripple" || id != "7930279" {
		t.Fatalf("parse greenhouse: board=%q id=%q err=%v", board, id, err)
	}
}

func TestParseLeverURL(t *testing.T) {
	company, posting, err := parseLeverURL("https://jobs.lever.co/olo/cf24b481-6c24-40f7-9737-224d5d2ba0ca")
	if err != nil || company != "olo" || posting != "cf24b481-6c24-40f7-9737-224d5d2ba0ca" {
		t.Fatalf("parse lever: company=%q posting=%q err=%v", company, posting, err)
	}
}

func TestFetchGreenhouseJob(t *testing.T) {
	if testing.Short() {
		t.Skip("network")
	}
	payload, err := FetchJobViaATSAPI(context.Background(),
		"https://boards.greenhouse.io/samsara/jobs/7349219", "greenhouse", nil)
	if err != nil {
		t.Fatal(err)
	}
	if payload.Title == "" || payload.Title == "Unknown Title" {
		t.Fatalf("expected title, got %q", payload.Title)
	}
	if !strings.Contains(payload.Company, "Samsara") {
		t.Fatalf("expected company Samsara, got %q", payload.Company)
	}
	if len(payload.Description) < 100 {
		t.Fatalf("expected description, got len=%d", len(payload.Description))
	}
	if len(payload.FormFields) == 0 {
		t.Fatal("expected greenhouse form fields")
	}
}

func TestFetchLeverJob(t *testing.T) {
	if testing.Short() {
		t.Skip("network")
	}
	payload, err := FetchJobViaATSAPI(context.Background(),
		"https://jobs.lever.co/olo/cf24b481-6c24-40f7-9737-224d5d2ba0ca", "lever", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(payload.Title, "Software Engineer") {
		t.Fatalf("unexpected title: %q", payload.Title)
	}
	if payload.Company != "Olo" {
		t.Fatalf("unexpected company: %q", payload.Company)
	}
	if len(payload.FormFields) == 0 {
		t.Fatal("expected lever form fields from apply page")
	}
}

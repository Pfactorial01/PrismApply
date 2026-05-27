package discovery

import "testing"

func TestNormalizeListingURL_StripsApplication(t *testing.T) {
	raw := "https://jobs.ashbyhq.com/deel/2885ca76-6ca7-4037-a34a-6d59216873ec/application"
	want := "https://jobs.ashbyhq.com/deel/2885ca76-6ca7-4037-a34a-6d59216873ec"
	if got := NormalizeListingURL(raw); got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestNormalizeListingURL_StripsLeverApply(t *testing.T) {
	raw := "https://jobs.lever.co/olo/cf24b481-6c24-40f7-9737-224d5d2ba0ca/apply"
	want := "https://jobs.lever.co/olo/cf24b481-6c24-40f7-9737-224d5d2ba0ca"
	if got := NormalizeListingURL(raw); got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestDetectSource_AshbyApplicationURL(t *testing.T) {
	src, ok := DetectSource("https://jobs.ashbyhq.com/deel/2885ca76-6ca7-4037-a34a-6d59216873ec/application")
	if !ok || src != "ashby" {
		t.Fatalf("DetectSource: ok=%v src=%q", ok, src)
	}
}

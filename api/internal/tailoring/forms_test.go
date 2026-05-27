package tailoring

import "testing"

func TestClassifyCoverLetterSeparateFromResume(t *testing.T) {
	resume := ClassifyFormField(FormFieldRow{Label: "Resume/CV", FieldType: "file"})
	if resume.FieldClass != FieldFile {
		t.Fatalf("resume file class = %q", resume.FieldClass)
	}

	coverFile := ClassifyFormField(FormFieldRow{Label: "Cover Letter", FieldType: "file"})
	if coverFile.FieldClass != FieldCoverLetter {
		t.Fatalf("cover file class = %q", coverFile.FieldClass)
	}

	coverText := ClassifyFormField(FormFieldRow{Label: "Cover Letter", FieldType: "textarea"})
	if coverText.FieldClass != FieldCoverLetterText {
		t.Fatalf("cover text class = %q", coverText.FieldClass)
	}
}

func TestFinalizeFormAnswersScopedByPosition(t *testing.T) {
	classified := []ClassifiedField{
		{FormFieldRow: FormFieldRow{Label: "Resume/CV", FieldType: "file", Position: 0}, FieldClass: FieldFile},
		{FormFieldRow: FormFieldRow{Label: "Cover Letter", FieldType: "file", Position: 1}, FieldClass: FieldCoverLetter},
	}
	answers := FinalizeFormAnswers([]FormFieldAnswer{}, classified, "https://example/resume.pdf", "Dear hiring manager,", "https://example/cover.pdf")
	if answers[0].Value != "https://example/resume.pdf" {
		t.Fatalf("resume value = %q", answers[0].Value)
	}
	if answers[1].Value != "https://example/cover.pdf" {
		t.Fatalf("cover value = %q", answers[1].Value)
	}
}

func TestFormatLocationAnswer(t *testing.T) {
	got := formatLocationAnswer("Chicago, IL", "us")
	if got != "Chicago, IL, United States" {
		t.Fatalf("formatLocationAnswer() = %q", got)
	}
}

func TestResolveExportControlsAnswer(t *testing.T) {
	field := ClassifiedField{
		FormFieldRow: FormFieldRow{
			Label: "EXPORT CONTROLS - eligibility",
			Options: []string{
				"A United States citizen or national",
				"None of the above",
			},
		},
	}
	profile := map[string]any{"visaStatus": "citizen_pr"}
	got := resolveExportControlsAnswer(field, profile)
	if got != "A United States citizen or national" {
		t.Fatalf("resolveExportControlsAnswer() = %q", got)
	}
}

func TestPrimaryBehavioralStory(t *testing.T) {
	profile := map[string]any{
		"storyDifficultFeedback": "Was told my docs assumed too much context.",
	}
	story, key := primaryBehavioralStory(profile, "Tell us about impactful feedback you've received")
	if key != "storyDifficultFeedback" || story == "" {
		t.Fatalf("primaryBehavioralStory() = (%q, %q)", story, key)
	}
}

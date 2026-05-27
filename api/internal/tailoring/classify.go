package tailoring

import "regexp"

var (
	coverLetterPattern = regexp.MustCompile(`(?i)\bcover letter\b`)
	identityPatterns   = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bname\b`),
		regexp.MustCompile(`(?i)\bfull name\b`),
		regexp.MustCompile(`(?i)\bfirst name\b`),
		regexp.MustCompile(`(?i)\blast name\b`),
		regexp.MustCompile(`(?i)\bemail\b`),
		regexp.MustCompile(`(?i)\bphone\b`),
		regexp.MustCompile(`(?i)\blinkedin\b`),
		regexp.MustCompile(`(?i)\bgithub\b`),
		regexp.MustCompile(`(?i)\bportfolio\b`),
		regexp.MustCompile(`(?i)\bwebsite\b`),
		regexp.MustCompile(`(?i)\burl\b`),
	}
	filePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bresume\b`),
		regexp.MustCompile(`(?i)\bcv\b`),
		regexp.MustCompile(`(?i)\bcurriculum vitae\b`),
		regexp.MustCompile(`(?i)\battach\b.*\bfile\b`),
	}
	eeoPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bgender\b`),
		regexp.MustCompile(`(?i)\brace\b`),
		regexp.MustCompile(`(?i)\bethnic`),
		regexp.MustCompile(`(?i)\bveteran\b`),
		regexp.MustCompile(`(?i)\bdisabilit`),
		regexp.MustCompile(`(?i)\bsexual orientation\b`),
		regexp.MustCompile(`(?i)\bpronoun`),
		regexp.MustCompile(`(?i)\beeo\b`),
		regexp.MustCompile(`(?i)\bvoluntary self`),
	}
	locationPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\blocation\b`),
		regexp.MustCompile(`(?i)\bcity\b`),
		regexp.MustCompile(`(?i)\bstate\b`),
		regexp.MustCompile(`(?i)\bcountry\b`),
		regexp.MustCompile(`(?i)\bzip\b`),
		regexp.MustCompile(`(?i)\bpostal\b`),
		regexp.MustCompile(`(?i)\bremote\b`),
		regexp.MustCompile(`(?i)\brelocation\b`),
		regexp.MustCompile(`(?i)\bcommute\b`),
		regexp.MustCompile(`(?i)\bdays?\s+(in|at|on)\s+office\b`),
		regexp.MustCompile(`(?i)\bwork authorization\b`),
		regexp.MustCompile(`(?i)\bauthorized to work\b`),
		regexp.MustCompile(`(?i)\blegal.*work\b`),
	}
	behavioralPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bwhy\b.*\b(company|us|this role|delete|join)\b`),
		regexp.MustCompile(`(?i)\bdescribe a time\b`),
		regexp.MustCompile(`(?i)\btell us about\b`),
		regexp.MustCompile(`(?i)\bexample of\b`),
		regexp.MustCompile(`(?i)\bexperience with\b`),
		regexp.MustCompile(`(?i)\bwhat interests you\b`),
		regexp.MustCompile(`(?i)\bwhat motivates\b`),
		regexp.MustCompile(`(?i)\badditional information\b`),
		regexp.MustCompile(`(?i)\banything else\b`),
	}
)

func matchAny(label string, patterns []*regexp.Regexp) bool {
	for _, p := range patterns {
		if p.MatchString(label) {
			return true
		}
	}
	return false
}

func isCoverLetterLabel(label string) bool {
	return coverLetterPattern.MatchString(label)
}

func isResumeUploadLabel(label string) bool {
	return matchAny(label, filePatterns) && !isCoverLetterLabel(label)
}

func ClassifyFormField(field FormFieldRow) ClassifiedField {
	label := field.Label
	ft := field.FieldType

	if isCoverLetterLabel(label) {
		if ft == "file" {
			return ClassifiedField{FormFieldRow: field, FieldClass: FieldCoverLetter}
		}
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldCoverLetterText}
	}
	if ft == "file" || isResumeUploadLabel(label) {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldFile}
	}
	if matchAny(label, eeoPatterns) {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldEEO}
	}
	if matchAny(label, identityPatterns) {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldIdentity}
	}
	if ft == "select" || ft == "radio" || ft == "checkbox" {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldSelect}
	}
	if matchAny(label, locationPatterns) {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldLocation}
	}
	if matchAny(label, behavioralPatterns) {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldBehavior}
	}
	if ft == "textarea" {
		return ClassifiedField{FormFieldRow: field, FieldClass: FieldLongText}
	}
	return ClassifiedField{FormFieldRow: field, FieldClass: FieldShortText}
}

func ClassifyFormFields(fields []FormFieldRow) []ClassifiedField {
	out := make([]ClassifiedField, len(fields))
	for i, f := range fields {
		out[i] = ClassifyFormField(f)
	}
	return out
}

func IsFileField(field FormFieldRow) bool {
	return ClassifyFormField(field).FieldClass == FieldFile
}

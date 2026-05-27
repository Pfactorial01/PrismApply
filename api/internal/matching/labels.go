package matching

var slugLabels = map[string]string{
	"db_no_defense":  "No defense sector",
	"db_no_gambling": "No gambling",
	"db_no_crypto":   "No crypto-first products",
	"db_no_oncall":   "No heavy on-call",
	"db_no_ads":      "No surveillance / ads-only business",
	"db_other":       "Other dealbreaker",

	"fintech":     "FinTech",
	"healthtech":  "HealthTech / biotech",
	"b2b_saas":    "B2B SaaS",
	"consumer":    "Consumer tech",
	"devtools":    "Developer tools",
	"infra_cloud": "Infra / cloud",
	"climate":     "Climate / sustainability",
	"gov":         "Gov / defense-adjacent",
	"edtech":      "EdTech",
	"gaming":      "Gaming",
	"crypto":      "Crypto / web3",

	"remote":    "Remote-first",
	"hybrid":    "Hybrid",
	"onsite":    "Mostly onsite",
	"flexible":  "Flexible / negotiable",
	"intern":    "Intern",
	"junior":    "Junior",
	"mid":       "Mid-level",
	"senior":    "Senior",
	"staff":     "Staff",
	"principal": "Principal",
	"lead":      "Tech lead",
	"manager":   "Engineering manager",
	"director":  "Director+",

	"us":    "United States",
	"ca":    "Canada",
	"eu_uk": "Europe / UK",
	"latam": "Latin America",
	"apac":  "Asia–Pacific",
	"mea":   "Middle East / Africa",
	"other": "Other",
}

func labelForSlug(slug string) string {
	if l, ok := slugLabels[slug]; ok {
		return l
	}
	return slug
}

// LabelForSlug returns a human-readable label for a stored slug value.
func LabelForSlug(slug string) string {
	return labelForSlug(slug)
}

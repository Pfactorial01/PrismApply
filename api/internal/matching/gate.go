package matching

import (
	"strings"
)

// MatchEligible runs Layer 1 hard preference checks. Only passing pairs may be scored/tailored.
func MatchEligible(prefs UserPreferences, job JobFacts) GateResult {
	var reasons []string

	if r := checkWorkArrangement(prefs.WorkArrangement, job.RemotePolicy); r != "" {
		reasons = append(reasons, r)
	}
	if r := checkVisa(prefs, job); r != "" {
		reasons = append(reasons, r)
	}
	if r := checkContract(prefs.OpenToContract, job.EmploymentType); r != "" {
		reasons = append(reasons, r)
	}
	if r := checkSeniority(prefs.SeniorityTarget, job.SeniorityLevel); r != "" {
		reasons = append(reasons, r)
	}
	for _, r := range checkDealbreakers(prefs, job) {
		reasons = append(reasons, r)
	}

	return GateResult{OK: len(reasons) == 0, Reasons: reasons}
}

func checkWorkArrangement(userArr, jobRemote string) string {
	if userArr == "" || userArr == "flexible" || jobRemote == "unknown" || jobRemote == "" {
		return ""
	}
	switch userArr {
	case "remote":
		if jobRemote == "onsite" {
			return "Job is onsite-only; user requires remote-first"
		}
	case "hybrid":
		if jobRemote == "onsite" {
			return "Job is onsite-only; user requires hybrid or remote"
		}
	case "onsite":
		// user accepts onsite; remote/hybrid jobs still OK
	}
	return ""
}

func checkVisa(prefs UserPreferences, job JobFacts) string {
	if !prefs.NeedsVisaSponsorship {
		return ""
	}
	if job.RequiresSponsorship != nil && !*job.RequiresSponsorship {
		return "Job does not offer visa sponsorship; user requires sponsorship"
	}
	return ""
}

func checkContract(openToContract bool, employmentType string) string {
	if openToContract || employmentType != "contract" {
		return ""
	}
	return "Job is contract; user is not open to contract"
}

func checkSeniority(userTarget, jobLevel string) string {
	eligible, _ := CompareSeniority(userTarget, jobLevel)
	if !eligible {
		return "Job seniority (" + jobLevel + ") is below user target (" + userTarget + ")"
	}
	return ""
}

func checkDealbreakers(prefs UserPreferences, job JobFacts) []string {
	var reasons []string
	tags := make(map[string]bool)
	for _, t := range job.IndustryTags {
		tags[t] = true
	}
	combined := strings.ToLower(job.Title + " " + job.Company)

	for _, slug := range prefs.DealbreakerSlugs {
		switch slug {
		case "db_no_defense":
			if tags["defense"] || strings.Contains(combined, "defense") {
				reasons = append(reasons, "Dealbreaker: defense sector")
			}
		case "db_no_gambling":
			if tags["gambling"] {
				reasons = append(reasons, "Dealbreaker: gambling")
			}
		case "db_no_crypto":
			if tags["crypto"] {
				reasons = append(reasons, "Dealbreaker: crypto-first")
			}
		case "db_no_oncall":
			if job.HasHeavyOncall {
				reasons = append(reasons, "Dealbreaker: heavy on-call")
			}
		case "db_no_ads":
			if tags["ads"] {
				reasons = append(reasons, "Dealbreaker: ads/surveillance business")
			}
		}
	}
	return reasons
}

package matching

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	reRemote     = regexp.MustCompile(`(?i)\b(remote|work from home|wfh|distributed)\b`)
	reHybrid     = regexp.MustCompile(`(?i)\b(hybrid)\b`)
	reOnsite     = regexp.MustCompile(`(?i)\b(on[- ]?site|in[- ]?office)\b`)
	reContract   = regexp.MustCompile(`(?i)\b(contract|1099|c2c|freelance)\b`)
	reNoSponsor  = regexp.MustCompile(`(?i)(no (visa )?sponsorship|unable to sponsor|will not sponsor|cannot sponsor)`)
	reSponsor    = regexp.MustCompile(`(?i)(visa sponsorship|h-?1b|sponsor visa)`)
	reOncall     = regexp.MustCompile(`(?i)(on[- ]?call|pager duty|pager rotation)`)
	reDefense    = regexp.MustCompile(`(?i)\b(defense|military|dod|clearance|classified)\b`)
	reGambling   = regexp.MustCompile(`(?i)\b(gambling|casino|sports betting|betting)\b`)
	reCrypto     = regexp.MustCompile(`(?i)\b(crypto|web3|blockchain|defi|nft)\b`)
	reAds        = regexp.MustCompile(`(?i)\b(adtech|advertising platform|surveillance)\b`)
	reSalary     = regexp.MustCompile(`(?i)\$?\s*(\d{2,3})\s*k`)
)

var seniorityTitlePatterns = []struct {
	level string
	re    *regexp.Regexp
}{
	{"intern", regexp.MustCompile(`(?i)\bintern\b`)},
	{"junior", regexp.MustCompile(`(?i)\b(junior|jr\.?|entry[- ]?level)\b`)},
	{"mid", regexp.MustCompile(`(?i)\b(mid[- ]?level|intermediate)\b`)},
	{"senior", regexp.MustCompile(`(?i)\b(senior|sr\.?)\b`)},
	{"staff", regexp.MustCompile(`(?i)\b(staff)\b`)},
	{"principal", regexp.MustCompile(`(?i)\b(principal|distinguished)\b`)},
	{"lead", regexp.MustCompile(`(?i)\b(tech lead|team lead)\b`)},
	{"manager", regexp.MustCompile(`(?i)\b(engineering manager|eng manager)\b`)},
	{"director", regexp.MustCompile(`(?i)\b(director|vp of engineering)\b`)},
}

// ExtractJobFacts infers structured job metadata from title, location, and description.
func ExtractJobFacts(title, company, location, description string, formFieldLabels []string) JobFacts {
	combined := strings.Join([]string{title, company, location, description, strings.Join(formFieldLabels, " ")}, "\n")
	lower := strings.ToLower(combined)

	facts := JobFacts{
		Title:        strings.TrimSpace(title),
		Company:      strings.TrimSpace(company),
		LocationText: strings.TrimSpace(location),
		IndustryTags: detectIndustryTags(lower),
	}

	facts.RemotePolicy = detectRemotePolicy(lower, location)
	facts.EmploymentType = detectEmploymentType(lower)
	facts.SeniorityLevel = detectSeniorityLevel(title, lower)
	facts.HasHeavyOncall = reOncall.MatchString(lower)

	if reNoSponsor.MatchString(lower) {
		f := false
		facts.RequiresSponsorship = &f
	} else if reSponsor.MatchString(lower) {
		t := true
		facts.RequiresSponsorship = &t
	}

	facts.SalaryMinUSD, facts.SalaryMaxUSD = parseSalaryRange(lower)
	return facts
}

func detectRemotePolicy(lower, location string) string {
	loc := strings.ToLower(location)
	if reRemote.MatchString(lower) || strings.Contains(loc, "remote") {
		if reHybrid.MatchString(lower) {
			return "hybrid"
		}
		return "remote"
	}
	if reHybrid.MatchString(lower) {
		return "hybrid"
	}
	if reOnsite.MatchString(lower) {
		return "onsite"
	}
	return "unknown"
}

func detectEmploymentType(lower string) string {
	if reContract.MatchString(lower) {
		return "contract"
	}
	return "full_time"
}

func detectSeniorityLevel(title, lower string) string {
	for _, p := range seniorityTitlePatterns {
		if p.re.MatchString(title) || p.re.MatchString(lower) {
			return p.level
		}
	}
	return "unknown"
}

func detectIndustryTags(lower string) []string {
	var tags []string
	checks := []struct {
		tag string
		re  *regexp.Regexp
	}{
		{"defense", reDefense},
		{"gambling", reGambling},
		{"crypto", reCrypto},
		{"ads", reAds},
	}
	for _, c := range checks {
		if c.re.MatchString(lower) {
			tags = append(tags, c.tag)
		}
	}
	return tags
}

func parseSalaryRange(lower string) (*int, *int) {
	matches := reSalary.FindAllStringSubmatch(lower, -1)
	if len(matches) == 0 {
		return nil, nil
	}
	var vals []int
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		n, err := strconv.Atoi(m[1])
		if err != nil || n <= 0 {
			continue
		}
		vals = append(vals, n*1000)
	}
	if len(vals) == 0 {
		return nil, nil
	}
	min, max := vals[0], vals[0]
	for _, v := range vals[1:] {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	return &min, &max
}


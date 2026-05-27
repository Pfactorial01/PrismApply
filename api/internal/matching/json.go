package matching

import "encoding/json"

// JobFactsToJSON marshals JobFacts for storage.
func JobFactsToJSON(f JobFacts) ([]byte, error) {
	return json.Marshal(f)
}

// JobFactsFromJSON unmarshals stored job facts.
func JobFactsFromJSON(raw []byte) (JobFacts, error) {
	var f JobFacts
	if len(raw) == 0 {
		return f, nil
	}
	err := json.Unmarshal(raw, &f)
	return f, err
}

// PreferencesToJSON marshals UserPreferences for storage.
func PreferencesToJSON(p UserPreferences) ([]byte, error) {
	return json.Marshal(p)
}

package seeddata

import _ "embed"

//go:embed match_user_java.json
var MatchUserJavaJSON []byte

//go:embed match_user_embedded.json
var MatchUserEmbeddedJSON []byte

//go:embed match_user_backend.json
var MatchUserBackendJSON []byte

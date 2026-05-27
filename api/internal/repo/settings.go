package repo

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

type UserSettings struct {
	MatchTierMode string `json:"matchTierMode"`
}

func GetUserSettings(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (UserSettings, error) {
	prefs, err := LoadUserPreferences(ctx, pool, userID)
	if err != nil {
		return UserSettings{}, err
	}
	return UserSettings{
		MatchTierMode: matching.NormalizeMatchTierMode(prefs.MatchTierMode),
	}, nil
}

func UpdateUserMatchTierMode(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, mode string) error {
	prefs, err := LoadUserPreferences(ctx, pool, userID)
	if err != nil {
		return err
	}
	prefs.MatchTierMode = matching.NormalizeMatchTierMode(mode)
	return UpdateProfilePreferences(ctx, pool, userID, prefs)
}

// DeletePendingPromisingMatches removes pending matches classified as promising (no tailored app yet).
func DeletePendingPromisingMatches(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	rows, err := pool.Query(ctx, `
		SELECT jm.id, jm.score, jm.score_breakdown, jm.adjudication
		FROM job_matches jm
		WHERE jm.user_id = $1
		  AND jm.status = 'pending'
		  AND NOT EXISTS (
		    SELECT 1 FROM tailored_applications ta WHERE ta.match_id = jm.id
		  )`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var deleteIDs []int64
	for rows.Next() {
		var id int64
		var score float32
		var bdRaw, adjRaw []byte
		if err := rows.Scan(&id, &score, &bdRaw, &adjRaw); err != nil {
			return 0, err
		}

		var bd matching.ScoreBreakdown
		if len(bdRaw) > 0 {
			_ = json.Unmarshal(bdRaw, &bd)
		}
		var adj matching.AdjudicationResult
		if len(adjRaw) > 0 {
			_ = json.Unmarshal(adjRaw, &adj)
		}
		adjPtr := (*matching.AdjudicationResult)(nil)
		if len(adjRaw) > 0 {
			adjPtr = &adj
		}

		tier := matching.ClassifyMatchTier(&score, &bd, adjPtr)
		if tier != nil && *tier == matching.MatchTierPromising {
			deleteIDs = append(deleteIDs, id)
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(deleteIDs) == 0 {
		return 0, nil
	}

	tag, err := pool.Exec(ctx, `DELETE FROM job_matches WHERE id = ANY($1)`, deleteIDs)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

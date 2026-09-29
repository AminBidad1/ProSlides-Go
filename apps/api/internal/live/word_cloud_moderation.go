package live

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/proslides/proslides/internal/presentations"
)

const wordCloudModerationAction = "moderate_word_cloud_term"

func (s *PostgresStore) ModerateWordCloudTerm(
	c context.Context,
	session string,
	host string,
	request string,
	expected int64,
	item string,
	canonicalKey string,
	hidden bool,
) (WordCloudModerationResult, bool, error) {
	var result WordCloudModerationResult

	loadPrior := func(row pgx.Row) (bool, error) {
		var action string
		var raw []byte
		if err := row.Scan(&action, &raw); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return false, nil
			}
			return false, err
		}
		if action != wordCloudModerationAction {
			return false, ErrConflict
		}
		if err := json.Unmarshal(raw, &result); err != nil {
			return false, err
		}
		result.Duplicate = true
		return true, nil
	}

	if found, err := loadPrior(s.pool.QueryRow(c, `
		SELECT c.action,c.result
		FROM live_commands c
		JOIN live_sessions l ON l.id=c.session_id
		WHERE c.session_id=$1 AND c.request_id=$2 AND l.host_id=$3
	`, session, request, host)); err != nil || found {
		return result, found, err
	}

	tx, err := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return result, false, err
	}
	defer tx.Rollback(c)

	var current Session
	if err = scanSession(tx.QueryRow(c, `
		SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,
		       active_item_id::text,activity_phase,stage_view,ends_at
		FROM live_sessions
		WHERE id=$1 AND host_id=$2
		FOR UPDATE
	`, session, host), &current); errors.Is(err, pgx.ErrNoRows) {
		return result, false, ErrNotFound
	} else if err != nil {
		return result, false, err
	}

	if found, priorErr := loadPrior(tx.QueryRow(c, `
		SELECT c.action,c.result
		FROM live_commands c
		WHERE c.session_id=$1 AND c.request_id=$2
	`, session, request)); priorErr != nil || found {
		return result, found, priorErr
	}

	if current.StateVersion != expected {
		return result, false, ErrConflict
	}
	if current.State != Presenting ||
		current.ActiveItemID == nil ||
		*current.ActiveItemID != item ||
		current.ActivityPhase == nil ||
		(*current.ActivityPhase != ActivityClosed && *current.ActivityPhase != ActivityRevealed) {
		return result, false, ErrInvalidTransition
	}

	var definitionRaw json.RawMessage
	if err = tx.QueryRow(c, `
		SELECT content
		FROM live_session_slides
		WHERE session_id=$1 AND slide_id=$2 AND kind='activity'
	`, session, item).Scan(&definitionRaw); errors.Is(err, pgx.ErrNoRows) {
		return result, false, ErrNotFound
	} else if err != nil {
		return result, false, err
	}

	definition, decodeErr := presentations.DecodeActivityDefinition(definitionRaw)
	if decodeErr != nil ||
		definition.ActivityKind != presentations.ActivityKindText ||
		(definition.Results.Aggregation != presentations.TextAggregationEntryFrequency &&
			definition.Results.Aggregation != presentations.TextAggregationWordFrequency) {
		return result, false, ErrInvalid
	}

	key := canonicalWordCloudEntry(canonicalKey)
	if key == "" || len([]rune(key)) > 512 {
		return result, false, ErrInvalid
	}

	var exists bool
	if err = tx.QueryRow(c, `
		SELECT EXISTS(
			SELECT 1
			FROM answers a
			CROSS JOIN LATERAL jsonb_array_elements_text(
				COALESCE(a.answer->'terms','[]'::jsonb)
			) term(value)
			WHERE a.session_id=$1
			  AND a.question_slide_id=$2
			  AND term.value=$3
		)
	`, session, item, key).Scan(&exists); err != nil {
		return result, false, err
	}
	if !exists {
		return result, false, ErrNotFound
	}

	var currentlyHidden bool
	if err = tx.QueryRow(c, `
		SELECT EXISTS(
			SELECT 1
			FROM live_word_cloud_moderation
			WHERE session_id=$1
			  AND activity_item_id=$2
			  AND canonical_key=$3
			  AND hidden
		)
	`, session, item, key).Scan(&currentlyHidden); err != nil {
		return result, false, err
	}

	if currentlyHidden == hidden {
		result = WordCloudModerationResult{
			ActivityItemID: item,
			CanonicalKey:  key,
			Hidden:        hidden,
			StateVersion:  current.StateVersion,
		}
		rawResult, marshalErr := json.Marshal(result)
		if marshalErr != nil {
			return result, false, marshalErr
		}
		if _, err = tx.Exec(c, `
			INSERT INTO live_commands(
				session_id,request_id,action,result_state,result_state_version,result
			)
			VALUES($1,$2,$3,$4,$5,$6)
		`, session, request, wordCloudModerationAction, current.State, current.StateVersion, rawResult); err != nil {
			return result, false, mapPG(err)
		}
		if err = tx.Commit(c); err != nil {
			return result, false, err
		}
		return result, false, nil
	}

	if hidden {
		if _, err = tx.Exec(c, `
			INSERT INTO live_word_cloud_moderation(
				session_id,activity_item_id,canonical_key,hidden,updated_by,updated_at
			)
			VALUES($1,$2,$3,TRUE,$4,clock_timestamp())
			ON CONFLICT (session_id,activity_item_id,canonical_key)
			DO UPDATE SET
				hidden=TRUE,
				updated_by=EXCLUDED.updated_by,
				updated_at=clock_timestamp()
		`, session, item, key, host); err != nil {
			return result, false, mapPG(err)
		}
	} else {
		if _, err = tx.Exec(c, `
			DELETE FROM live_word_cloud_moderation
			WHERE session_id=$1
			  AND activity_item_id=$2
			  AND canonical_key=$3
		`, session, item, key); err != nil {
			return result, false, mapPG(err)
		}
	}

	if err = scanSession(tx.QueryRow(c, `
		UPDATE live_sessions
		SET state_version=state_version+1,updated_at=clock_timestamp()
		WHERE id=$1
		RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,
		          active_item_id::text,activity_phase,stage_view,ends_at
	`, session), &current); err != nil {
		return result, false, mapPG(err)
	}

	result = WordCloudModerationResult{
		ActivityItemID: item,
		CanonicalKey:  key,
		Hidden:        hidden,
		StateVersion:  current.StateVersion,
	}

	rawResult, marshalErr := json.Marshal(result)
	if marshalErr != nil {
		return result, false, marshalErr
	}
	if _, err = tx.Exec(c, `
		INSERT INTO live_commands(
			session_id,request_id,action,result_state,result_state_version,result
		)
		VALUES($1,$2,$3,$4,$5,$6)
	`, session, request, wordCloudModerationAction, current.State, current.StateVersion, rawResult); err != nil {
		return result, false, mapPG(err)
	}

	if err = insertEvent(c, tx, session, current.StateVersion, "activity.moderation_updated", map[string]any{
		"activity_item_id": item,
		"canonical_key":   key,
		"hidden":          hidden,
	}); err != nil {
		return result, false, err
	}
	if err = insertEvent(c, tx, session, current.StateVersion, "session.state_changed", sessionEventPayload(current, "word_cloud_moderation")); err != nil {
		return result, false, err
	}

	if err = tx.Commit(c); err != nil {
		return result, false, err
	}
	return result, false, nil
}

func wordCloudModerationState(
	c context.Context,
	tx pgx.Tx,
	session string,
	item string,
) (*WordCloudModerationState, error) {
	var definitionRaw json.RawMessage
	if err := tx.QueryRow(c, `
		SELECT content
		FROM live_session_slides
		WHERE session_id=$1 AND slide_id=$2 AND kind='activity'
	`, session, item).Scan(&definitionRaw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	definition, err := presentations.DecodeActivityDefinition(definitionRaw)
	if err != nil {
		return nil, err
	}
	if definition.ActivityKind != presentations.ActivityKindText {
		return nil, nil
	}

	query := `
		WITH counts AS (
			SELECT term.value AS aggregation_key,count(*)::int AS count
			FROM answers a
			CROSS JOIN LATERAL jsonb_array_elements_text(
				COALESCE(a.answer->'terms','[]'::jsonb)
			) term(value)
			WHERE a.session_id=$1 AND a.question_slide_id=$2
			GROUP BY term.value
		),
		base AS (
			SELECT
				counts.aggregation_key,
				counts.aggregation_key AS display_value,
				counts.count,
				(m.canonical_key IS NOT NULL) AS hidden
			FROM counts
			LEFT JOIN live_word_cloud_moderation m
			  ON m.session_id=$1
			 AND m.activity_item_id=$2
			 AND m.canonical_key=counts.aggregation_key
			 AND m.hidden
		),
		visible AS (
			SELECT *
			FROM base
			WHERE NOT hidden
			ORDER BY count DESC,aggregation_key
			LIMIT 100
		),
		hidden_terms AS (
			SELECT *
			FROM base
			WHERE hidden
			ORDER BY count DESC,aggregation_key
			LIMIT 100
		)
		SELECT aggregation_key,display_value,count,hidden
		FROM (
			SELECT * FROM visible
			UNION ALL
			SELECT * FROM hidden_terms
		) moderated
		ORDER BY hidden ASC,count DESC,aggregation_key
	`
	if definition.Results.Aggregation == presentations.TextAggregationEntryFrequency {
		query = `
			WITH expanded AS (
				SELECT
					term.value AS aggregation_key,
					a.answer->'entries'->>((term.ordinality-1)::int) AS display_value,
					a.submitted_at,
					a.id
				FROM answers a
				CROSS JOIN LATERAL jsonb_array_elements_text(
					COALESCE(a.answer->'terms','[]'::jsonb)
				) WITH ORDINALITY term(value, ordinality)
				WHERE a.session_id=$1 AND a.question_slide_id=$2
			),
			counts AS (
				SELECT aggregation_key,count(*)::int AS count
				FROM expanded
				GROUP BY aggregation_key
			),
			labels AS (
				SELECT DISTINCT ON (aggregation_key)
					aggregation_key,display_value
				FROM expanded
				WHERE display_value IS NOT NULL AND display_value<>''
				ORDER BY aggregation_key,submitted_at,id
			),
			base AS (
				SELECT
					counts.aggregation_key,
					COALESCE(labels.display_value,counts.aggregation_key) AS display_value,
					counts.count,
					(m.canonical_key IS NOT NULL) AS hidden
				FROM counts
				LEFT JOIN labels USING (aggregation_key)
				LEFT JOIN live_word_cloud_moderation m
				  ON m.session_id=$1
				 AND m.activity_item_id=$2
				 AND m.canonical_key=counts.aggregation_key
				 AND m.hidden
			),
			visible AS (
				SELECT *
				FROM base
				WHERE NOT hidden
				ORDER BY count DESC,aggregation_key
				LIMIT 100
			),
			hidden_terms AS (
				SELECT *
				FROM base
				WHERE hidden
				ORDER BY count DESC,aggregation_key
				LIMIT 100
			)
			SELECT aggregation_key,display_value,count,hidden
			FROM (
				SELECT * FROM visible
				UNION ALL
				SELECT * FROM hidden_terms
			) moderated
			ORDER BY hidden ASC,count DESC,aggregation_key
		`
	}

	rows, err := tx.Query(c, query, session, item)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	state := &WordCloudModerationState{
		ActivityItemID: item,
		Terms:          []WordCloudModerationTerm{},
	}
	for rows.Next() {
		var term WordCloudModerationTerm
		if err := rows.Scan(&term.CanonicalKey, &term.Text, &term.Count, &term.Hidden); err != nil {
			return nil, err
		}
		state.Terms = append(state.Terms, term)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return state, nil
}

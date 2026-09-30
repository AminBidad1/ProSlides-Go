package presentations

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

const (
	maxActivityTitleRunes     = 80
	maxActivityPromptRunes    = 180
	maxActivityTitleLines     = 1
	maxActivityPromptLines    = 4
	maxChoiceOptionTextRunes  = 75
	maxChoiceOptionTextLines  = 2
	maxContentTitleRunes      = 120
	maxContentTitleLines      = 2
	maxContentTextRunes       = 600
	maxContentTextLines       = 10
	minLiveDurationSeconds   = 5
	maxLiveDurationSeconds   = 1200

	// Stored v1 definitions created before the projector-safe authoring policy
	// must remain decodable for reports and an already-running live session.
	maxStoredActivityTitleRunes    = 500
	maxStoredActivityPromptRunes   = 10_000
	maxStoredChoiceOptionTextRunes = 2_000
	maxStoredChoiceOptions         = 100
	minStoredDurationSeconds       = 1
	maxStoredDurationSeconds       = 86_400
)

func authoredLineCount(value string) int {
	normalized := strings.ReplaceAll(value, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	return strings.Count(normalized, "\n") + 1
}

func normalizeSlideDefinition(kind string, raw json.RawMessage) (string, json.RawMessage, error) {
	if !validJSONObject(raw) {
		return "", nil, errInvalidSlideDefinition
	}

	switch kind {
	case ItemKindActivity:
		var activity ActivityDefinition
		if err := decodeStrictObject(raw, &activity); err != nil {
			return "", nil, err
		}
		if err := validateActivityDefinition(activity); err != nil {
			return "", nil, err
		}
		if err := validateActivityAuthoringPolicy(activity); err != nil {
			return "", nil, err
		}
		normalized, err := json.Marshal(activity)
		if err != nil {
			return "", nil, errInvalidSlideDefinition
		}
		return ItemKindActivity, normalized, nil
	case "content":
		var value ContentDefinition
		if err := decodeStrictObject(raw, &value); err != nil {
			return "", nil, err
		}
		if (strings.TrimSpace(value.Title) == "" &&
			strings.TrimSpace(value.Text) == "" &&
			!value.ImagePlacement.hasImage()) ||
			utf8.RuneCountInString(value.Title) > maxContentTitleRunes ||
			authoredLineCount(value.Title) > maxContentTitleLines ||
			utf8.RuneCountInString(value.Text) > maxContentTextRunes ||
			authoredLineCount(value.Text) > maxContentTextLines ||
			value.ImagePlacement.validateAuthoring() != nil {
			return "", nil, errInvalidSlideDefinition
		}
		normalized, err := json.Marshal(value)
		if err != nil {
			return "", nil, errInvalidSlideDefinition
		}
		return kind, normalized, nil
	default:
		return "", nil, errInvalidSlideDefinition
	}
}


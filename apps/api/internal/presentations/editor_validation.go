package presentations

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

var errInvalidSlideDefinition = errors.New("invalid slide definition")

// ValidateLiveItemDefinition enforces the current presenter-paced authoring
// policy on a canonical frozen item before it enters a new live run. Stored v1
// definitions remain decodable separately for reports and already-running
// sessions.
func ValidateLiveItemDefinition(kind string, raw json.RawMessage) error {
	_, _, err := normalizeSlideDefinition(kind, raw)
	return err
}

func validateSlideContent(kind string, raw json.RawMessage) error {
	return ValidateLiveItemDefinition(kind, raw)
}

func decodeStrictObject(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errInvalidSlideDefinition
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errInvalidSlideDefinition
	}
	return nil
}

func validJSONObject(raw json.RawMessage) bool {
	var value map[string]any
	return len(raw) > 0 && json.Unmarshal(raw, &value) == nil && value != nil
}

package presentations

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"unicode/utf8"
)

var errInvalidPresentationSettings = errors.New("invalid presentation settings")

func validatePresentationSettings(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}

	var values map[string]json.RawMessage
	if err := json.Unmarshal(raw, &values); err != nil {
		return errInvalidPresentationSettings
	}

	for _, key := range []string{"background_color", "text_color", "accent_color"} {
		value, ok := values[key]
		if !ok {
			continue
		}
		var color string
		if json.Unmarshal(value, &color) != nil || !validHexColor(color) {
			return errInvalidPresentationSettings
		}
	}

	if value, ok := values["visualization_palette"]; ok {
		var palette []string
		if json.Unmarshal(value, &palette) != nil || len(palette) < 3 || len(palette) > 8 {
			return errInvalidPresentationSettings
		}
		for _, color := range palette {
			if !validHexColor(color) {
				return errInvalidPresentationSettings
			}
		}
	}

	if value, ok := values["background_image_url"]; ok {
		var resourceURL string
		if json.Unmarshal(value, &resourceURL) != nil ||
			!validOptionalImageURL(resourceURL, 4096) {
			return errInvalidPresentationSettings
		}
	}

	if value, ok := values["background_image_asset_id"]; ok {
		var assetID string
		if json.Unmarshal(value, &assetID) != nil {
			return errInvalidPresentationSettings
		}
		assetID = strings.TrimSpace(assetID)
		if assetID != "" && !validUUID(assetID) {
			return errInvalidPresentationSettings
		}
	}

	for _, key := range []string{
		"background_image_focal_x",
		"background_image_focal_y",
	} {
		value, ok := values[key]
		if !ok {
			continue
		}
		var focal *float64
		if json.Unmarshal(value, &focal) != nil ||
			focal == nil ||
			*focal < 0 ||
			*focal > 1 {
			return errInvalidPresentationSettings
		}
	}

	if value, ok := values["music_url"]; ok {
		var resourceURL string
		if json.Unmarshal(value, &resourceURL) != nil ||
			!validOptionalRemoteURL(resourceURL, 4096) {
			return errInvalidPresentationSettings
		}
	}

	return nil
}


func validOptionalRemoteURL(value string, maxRunes int) bool {
	if utf8.RuneCountInString(value) > maxRunes {
		return false
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	parsed, err := url.ParseRequestURI(value)
	return err == nil &&
		(parsed.Scheme == "http" || parsed.Scheme == "https") &&
		parsed.Host != ""
}

func validHexColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, r := range value[1:] {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		case r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}

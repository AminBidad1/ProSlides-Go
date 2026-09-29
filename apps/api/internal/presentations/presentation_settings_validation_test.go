package presentations

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidatePresentationSettingsAcceptsKnownValues(t *testing.T) {
	raw := json.RawMessage(`{
		"background_color":"#312e81",
		"background_image_url":"https://example.com/background.jpg",
		"text_color":"#ffffff",
		"accent_color":"#8b5cf6",
		"visualization_palette":["#8b5cf6","#06b6d4","#10b981"],
		"music_url":"https://example.com/music.mp3"
	}`)

	if err := validatePresentationSettings(raw); err != nil {
		t.Fatalf("valid presentation settings rejected: %v", err)
	}
}

func TestValidatePresentationSettingsRejectsInvalidKnownValues(t *testing.T) {
	cases := []string{
		`{"background_color":"banana"}`,
		`{"text_color":"#fff"}`,
		`{"accent_color":"red"}`,
		`{"visualization_palette":[]}`,
		`{"visualization_palette":["#112233","#445566"]}`,
		`{"visualization_palette":["#112233","#445566","nope"]}`,
		`{"background_image_url":"javascript:alert(1)"}`,
		`{"background_image_url":123}`,
		`{"background_color":null}`,
		`{"music_url":"javascript:alert(1)"}`,
		`{"music_url":123}`,
	}

	for _, raw := range cases {
		if err := validatePresentationSettings(json.RawMessage(raw)); err == nil {
			t.Fatalf("invalid presentation settings accepted: %s", raw)
		}
	}
}

func TestValidatePresentationSettingsAcceptsEmptyImageAndAdditionalSettings(t *testing.T) {
	raw := json.RawMessage(`{
		"background_image_url":"",
		"music_url":"",
		"custom_future_setting":{"enabled":true}
	}`)

	if err := validatePresentationSettings(raw); err != nil {
		t.Fatalf("compatible additional settings rejected: %v", err)
	}
}

func TestValidatePresentationSettingsRejectsOversizedBackgroundImageURL(t *testing.T) {
	longURL := "https://example.com/" + strings.Repeat("ع", 4096)
	raw, err := json.Marshal(map[string]any{
		"background_image_url": longURL,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := validatePresentationSettings(raw); err == nil {
		t.Fatal("oversized background image URL accepted")
	}
}

func TestValidatePresentationSettingsRejectsOversizedMusicURL(t *testing.T) {
	longURL := "https://example.com/" + strings.Repeat("ع", 4096)
	raw, err := json.Marshal(map[string]any{"music_url": longURL})
	if err != nil {
		t.Fatal(err)
	}
	if err := validatePresentationSettings(raw); err == nil {
		t.Fatal("oversized music URL accepted")
	}
}

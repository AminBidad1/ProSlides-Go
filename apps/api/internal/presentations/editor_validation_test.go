package presentations

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateSlideContentAcceptsCompleteChoiceActivity(t *testing.T) {
	raw := json.RawMessage(`{
		"schema_version":1,
		"activity_kind":"choice",
		"prompt":{"title":"","text":"Choose","image_url":""},
		"response":{"selection":"multiple","options":[
			{"id":"a","text":"A","image_url":"","order":1},
			{"id":"b","text":"B","image_url":"","order":2}
		]},
		"evaluation":{"mode":"correctness","correct_option_ids":["a"]},
		"scoring":{"mode":"points","min_points":0,"max_points":100,"speed_bonus":true,"partial_credit":true},
		"timing":{"duration_seconds":30},
		"results":{"show_overall_leaderboard_after":true}
	}`)
	if err := validateSlideContent(ItemKindActivity, raw); err != nil {
		t.Fatalf("complete Choice Activity rejected: %v", err)
	}
}

func TestValidateSlideContentRejectsInvalidChoiceActivity(t *testing.T) {
	base := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Choose"},
		Response: ActivityResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
			},
		},
		Evaluation: ActivityEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"a"},
		},
		Scoring: ActivityScoringPolicy{
			Mode:      ScoringModePoints,
			MaxPoints: 100,
		},
		Timing:  ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{},
	}

	invalid := base
	invalid.Response.Options[1].ID = "a"
	raw, err := json.Marshal(invalid)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSlideContent(ItemKindActivity, raw); err == nil {
		t.Fatal("Choice Activity with duplicate option ids accepted")
	}
}

func TestValidateChoiceActivityUsesSeparateQuizAndPollProjectionLimits(t *testing.T) {
	makeOptions := func(count int) []ChoiceOptionDefinition {
		options := make([]ChoiceOptionDefinition, count)
		for i := range options {
			options[i] = ChoiceOptionDefinition{
				ID:    string(rune('a' + i)),
				Text:  "Option",
				Order: i + 1,
			}
		}
		return options
	}
	validate := func(value ActivityDefinition) error {
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return validateSlideContent(ItemKindActivity, raw)
	}

	quizOptions := makeOptions(9)
	quiz := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Choose"},
		Response: ActivityResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options:   quizOptions,
		},
		Evaluation: ActivityEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: []string{quizOptions[0].ID},
		},
		Scoring: ActivityScoringPolicy{
			Mode:      ScoringModePoints,
			MaxPoints: 100,
		},
		Timing: ActivityTimingPolicy{DurationSeconds: 30},
	}
	if err := validate(quiz); err == nil {
		t.Fatal("correctness-evaluated Choice Activity with 9 options accepted")
	}

	pollOptions := makeOptions(13)
	poll := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Choose"},
		Response: ActivityResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options:   pollOptions,
		},
		Evaluation: ActivityEvaluationPolicy{Mode: EvaluationModeNone},
		Scoring:    ActivityScoringPolicy{Mode: ScoringModeNone},
		Timing:     ActivityTimingPolicy{DurationSeconds: 30},
	}
	if err := validate(poll); err == nil {
		t.Fatal("unscored Poll Activity with 13 options accepted")
	}
}

func TestValidateContentSlideRequiresVisibleContent(t *testing.T) {
	if err := validateSlideContent("content", json.RawMessage(`{"title":"","text":"","image_url":""}`)); err == nil {
		t.Fatal("empty content slide accepted")
	}
	if err := validateSlideContent("content", json.RawMessage(`{"title":"Introduction","text":"","image_url":""}`)); err != nil {
		t.Fatalf("visible content slide rejected: %v", err)
	}
}

func TestReplaceSlideRejectsInvalidActivityBeforeStore(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/slides/s", strings.NewReader(`{
		"position":0,
		"kind":"activity",
		"content":{"schema_version":1,"activity_kind":"choice"}
	}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", result.Code)
	}
}


func TestValidateChoiceActivityLengthsCountUnicodeCharacters(t *testing.T) {
	makeActivity := func(text, optionText string) json.RawMessage {
		value := ActivityDefinition{
			SchemaVersion: ActivitySchemaVersion1,
			ActivityKind:  ActivityKindChoice,
			Prompt:        ActivityPrompt{Text: text},
			Response: ActivityResponsePolicy{
				Selection: ChoiceSelectionSingle,
				Options: []ChoiceOptionDefinition{
					{ID: "a", Text: optionText, Order: 1},
					{ID: "b", Text: "گزینه دوم", Order: 2},
				},
			},
			Evaluation: ActivityEvaluationPolicy{
				Mode:             EvaluationModeCorrectness,
				CorrectOptionIDs: []string{"a"},
			},
			Scoring: ActivityScoringPolicy{
				Mode:      ScoringModePoints,
				MaxPoints: 100,
			},
			Timing: ActivityTimingPolicy{DurationSeconds: 30},
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	if err := validateSlideContent(ItemKindActivity, makeActivity(strings.Repeat("س", 180), strings.Repeat("گ", 75))); err != nil {
		t.Fatalf("unicode Choice Activity at documented limits rejected: %v", err)
	}
	if err := validateSlideContent(ItemKindActivity, makeActivity(strings.Repeat("س", 181), "گزینه")); err == nil {
		t.Fatal("Choice prompt over documented character limit accepted")
	}
	if err := validateSlideContent(ItemKindActivity, makeActivity("پرسش", strings.Repeat("گ", 76))); err == nil {
		t.Fatal("Choice option over documented character limit accepted")
	}
}


func TestValidateActivityAndContentRejectUnsafeMediaURLs(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt: ActivityPrompt{
			Text:     "Choose",
			ImageURL: "javascript:alert(1)",
		},
		Response: ActivityResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
			},
		},
		Evaluation: ActivityEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"a"},
		},
		Scoring: ActivityScoringPolicy{Mode: ScoringModePoints, MaxPoints: 100},
		Timing:  ActivityTimingPolicy{DurationSeconds: 30},
	}
	raw, err := json.Marshal(activity)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSlideContent(ItemKindActivity, raw); err == nil {
		t.Fatal("unsafe Activity image URL accepted")
	}

	if err := validateSlideContent(
		"content",
		json.RawMessage(`{"title":"Intro","text":"","image_url":"data:image/svg+xml;base64,AAAA"}`),
	); err == nil {
		t.Fatal("unsafe Content image URL accepted")
	}
}

func TestValidateContentSlideLengthsCountUnicodeCharacters(t *testing.T) {
	makeContent := func(title, text, imageURL string) json.RawMessage {
		value := map[string]any{
			"title":     title,
			"text":      text,
			"image_url": imageURL,
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	if err := validateSlideContent("content", makeContent(strings.Repeat("ع", 120), strings.Repeat("م", 600), "")); err != nil {
		t.Fatalf("unicode content at documented limits rejected: %v", err)
	}
	if err := validateSlideContent("content", makeContent(strings.Repeat("ع", 121), "متن", "")); err == nil {
		t.Fatal("content title over documented character limit accepted")
	}
	if err := validateSlideContent("content", makeContent("عنوان", strings.Repeat("م", 601), "")); err == nil {
		t.Fatal("content text over documented character limit accepted")
	}
}

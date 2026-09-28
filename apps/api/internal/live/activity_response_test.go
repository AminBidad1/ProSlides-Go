package live

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/proslides/proslides/internal/presentations"
)

func wordCloudDefinition(maxWords int) presentations.ActivityDefinition {
	return presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindText,
		Prompt: presentations.ActivityPrompt{
			Text: "سه واژه درباره این جلسه بنویسید",
		},
		Response: presentations.ActivityResponsePolicy{
			MaxLength: 80,
			MaxWords:  maxWords,
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode: presentations.EvaluationModeNone,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing: presentations.ActivityTimingPolicy{
			DurationSeconds: 30,
		},
		Results: presentations.ActivityResultPolicy{
			Aggregation: presentations.TextAggregationWordFrequency,
		},
	}
}

func entryWordCloudDefinition(maxEntries, maxEntryLength int) presentations.ActivityDefinition {
	return presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindText,
		Prompt: presentations.ActivityPrompt{
			Text: "سه عبارت کوتاه درباره این جلسه بنویسید",
		},
		Response: presentations.ActivityResponsePolicy{
			MaxEntries:     maxEntries,
			MaxEntryLength: maxEntryLength,
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode: presentations.EvaluationModeNone,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing: presentations.ActivityTimingPolicy{
			DurationSeconds: 30,
		},
		Results: presentations.ActivityResultPolicy{
			Aggregation: presentations.TextAggregationEntryFrequency,
		},
	}
}

func TestNormalizeTextActivityResponseFreezesUnicodeTerms(t *testing.T) {
	raw := json.RawMessage(`{"text":"  داده، داده AI هوش‌مصنوعی  "}`)
	normalized, selected, err := normalizeActivityResponse(
		wordCloudDefinition(4),
		raw,
	)
	if err != nil {
		t.Fatalf("normalize Text response: %v", err)
	}
	if selected != nil {
		t.Fatalf("Text Activity unexpectedly returned Choice indexes: %#v", selected)
	}

	var stored storedTextActivityResponse
	if err := json.Unmarshal(normalized, &stored); err != nil {
		t.Fatal(err)
	}
	if stored.Text != "داده، داده AI هوش‌مصنوعی" {
		t.Fatalf("stored text = %q", stored.Text)
	}
	wantTerms := []string{"داده", "ai", "هوش‌مصنوعی"}
	if !reflect.DeepEqual(stored.Terms, wantTerms) {
		t.Fatalf("terms = %#v, want %#v", stored.Terms, wantTerms)
	}
}

func TestNormalizeTextActivityResponseCanonicalizesPersianArabicGlyphVariants(t *testing.T) {
	normalized, _, err := normalizeActivityResponse(
		wordCloudDefinition(4),
		json.RawMessage(`{"text":"یادگیری يادگيري کتاب كتاب"}`),
	)
	if err != nil {
		t.Fatalf("normalize Persian variants: %v", err)
	}

	var stored storedTextActivityResponse
	if err := json.Unmarshal(normalized, &stored); err != nil {
		t.Fatal(err)
	}
	if stored.Text != "یادگیری يادگيري کتاب كتاب" {
		t.Fatalf("authored text should be preserved apart from NFKC/trim, got %q", stored.Text)
	}
	wantTerms := []string{"یادگیری", "کتاب"}
	if !reflect.DeepEqual(stored.Terms, wantTerms) {
		t.Fatalf("terms = %#v, want %#v", stored.Terms, wantTerms)
	}
}

func TestNormalizeTextActivityResponseCountsRepeatedWordsTowardLimit(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		wordCloudDefinition(3),
		json.RawMessage(`{"text":"داده داده AI هوش‌مصنوعی"}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}


func TestNormalizeEntryWordCloudPreservesPhrases(t *testing.T) {
	normalized, selected, err := normalizeActivityResponse(
		entryWordCloudDefinition(3, 30),
		json.RawMessage(`{"entries":["  هوش مصنوعی  ","AI","یادگیری ماشینی"]}`),
	)
	if err != nil {
		t.Fatalf("normalize entry Word Cloud: %v", err)
	}
	if selected != nil {
		t.Fatalf("entry Word Cloud unexpectedly returned Choice indexes: %#v", selected)
	}

	var stored storedTextActivityResponse
	if err := json.Unmarshal(normalized, &stored); err != nil {
		t.Fatal(err)
	}
	wantEntries := []string{"هوش مصنوعی", "AI", "یادگیری ماشینی"}
	if !reflect.DeepEqual(stored.Entries, wantEntries) {
		t.Fatalf("entries = %#v, want %#v", stored.Entries, wantEntries)
	}
	wantTerms := []string{"هوش مصنوعی", "ai", "یادگیری ماشینی"}
	if !reflect.DeepEqual(stored.Terms, wantTerms) {
		t.Fatalf("terms = %#v, want %#v", stored.Terms, wantTerms)
	}
	if stored.Text != "" {
		t.Fatalf("legacy text should be empty for entry Word Cloud, got %q", stored.Text)
	}
}

func TestNormalizeEntryWordCloudCanonicalizesAndDeduplicatesEntries(t *testing.T) {
	normalized, _, err := normalizeActivityResponse(
		entryWordCloudDefinition(4, 30),
		json.RawMessage(`{"entries":["یادگیری   ماشینی","يادگيري ماشيني","كتاب","کتاب"]}`),
	)
	if err != nil {
		t.Fatalf("normalize entry Word Cloud variants: %v", err)
	}

	var stored storedTextActivityResponse
	if err := json.Unmarshal(normalized, &stored); err != nil {
		t.Fatal(err)
	}
	wantEntries := []string{"یادگیری   ماشینی", "كتاب"}
	if !reflect.DeepEqual(stored.Entries, wantEntries) {
		t.Fatalf("entries = %#v, want %#v", stored.Entries, wantEntries)
	}
	wantTerms := []string{"یادگیری ماشینی", "کتاب"}
	if !reflect.DeepEqual(stored.Terms, wantTerms) {
		t.Fatalf("terms = %#v, want %#v", stored.Terms, wantTerms)
	}
}

func TestNormalizeEntryWordCloudRejectsLegacyTextShape(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		entryWordCloudDefinition(3, 30),
		json.RawMessage(`{"text":"هوش مصنوعی"}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestNormalizeEntryWordCloudRejectsOverlongEntry(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		entryWordCloudDefinition(3, 4),
		json.RawMessage(`{"entries":["سلامت"]}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestNormalizeTextActivityResponseRejectsUnknownShape(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		wordCloudDefinition(3),
		json.RawMessage(`{"text":"داده","selected_option_indexes":[0]}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestNormalizeChoiceActivityResponseStillUsesFrozenOptionIndexes(t *testing.T) {
	definition := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt: presentations.ActivityPrompt{
			Text: "انتخاب کنید",
		},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionMultiple,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "first", Text: "اول", Order: 1},
				{ID: "second", Text: "دوم", Order: 2},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode:             presentations.EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"first"},
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode:      presentations.ScoringModePoints,
			MaxPoints: 100,
		},
		Timing: presentations.ActivityTimingPolicy{DurationSeconds: 30},
		Results: presentations.ActivityResultPolicy{},
	}

	normalized, selected, err := normalizeActivityResponse(
		definition,
		json.RawMessage(`{"selected_option_indexes":[1,0]}`),
	)
	if err != nil {
		t.Fatalf("normalize Choice response: %v", err)
	}
	if !reflect.DeepEqual(selected, []int{1, 0}) {
		t.Fatalf("selected = %#v", selected)
	}
	if string(normalized) != `{"selected_option_indexes":[1,0]}` {
		t.Fatalf("normalized = %s", normalized)
	}
}

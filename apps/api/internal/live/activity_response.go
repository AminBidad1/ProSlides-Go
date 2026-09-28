package live

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/proslides/proslides/internal/presentations"
	"golang.org/x/text/unicode/norm"
)

type choiceActivityResponse struct {
	SelectedOptionIndexes []int `json:"selected_option_indexes"`
}

type textActivityResponse struct {
	Text    string   `json:"text,omitempty"`
	Entries []string `json:"entries,omitempty"`
}

type storedTextActivityResponse struct {
	Text    string   `json:"text,omitempty"`
	Entries []string `json:"entries,omitempty"`
	Terms   []string `json:"terms"`
}

func normalizeActivityResponse(
	definition presentations.ActivityDefinition,
	raw json.RawMessage,
) (json.RawMessage, []int, error) {
	if len(raw) == 0 || len(raw) > 8192 {
		return nil, nil, ErrInvalid
	}

	switch definition.ActivityKind {
	case presentations.ActivityKindChoice:
		var response choiceActivityResponse
		if err := decodeStrictResponse(raw, &response); err != nil {
			return nil, nil, ErrInvalid
		}
		if len(response.SelectedOptionIndexes) == 0 ||
			len(response.SelectedOptionIndexes) > len(definition.Response.Options) {
			return nil, nil, ErrInvalid
		}

		seen := make(map[int]struct{}, len(response.SelectedOptionIndexes))
		for _, index := range response.SelectedOptionIndexes {
			if index < 0 || index >= len(definition.Response.Options) {
				return nil, nil, ErrInvalid
			}
			if _, duplicate := seen[index]; duplicate {
				return nil, nil, ErrInvalid
			}
			seen[index] = struct{}{}
		}
		if definition.Response.Selection == presentations.ChoiceSelectionSingle &&
			len(response.SelectedOptionIndexes) != 1 {
			return nil, nil, ErrInvalid
		}

		normalized, err := json.Marshal(response)
		if err != nil {
			return nil, nil, err
		}
		return normalized, response.SelectedOptionIndexes, nil

	case presentations.ActivityKindText:
		var response textActivityResponse
		if err := decodeStrictResponse(raw, &response); err != nil {
			return nil, nil, ErrInvalid
		}

		switch definition.Results.Aggregation {
		case presentations.TextAggregationWordFrequency:
			if len(response.Entries) != 0 {
				return nil, nil, ErrInvalid
			}
			text := strings.TrimSpace(norm.NFKC.String(response.Text))
			if text == "" || utf8.RuneCountInString(text) > definition.Response.MaxLength {
				return nil, nil, ErrInvalid
			}
			tokens := wordCloudTokens(text)
			if len(tokens) == 0 || len(tokens) > definition.Response.MaxWords {
				return nil, nil, ErrInvalid
			}
			normalized, err := json.Marshal(storedTextActivityResponse{
				Text:  text,
				Terms: uniqueWordCloudTerms(tokens),
			})
			if err != nil {
				return nil, nil, err
			}
			return normalized, nil, nil

		case presentations.TextAggregationEntryFrequency:
			if response.Text != "" ||
				len(response.Entries) == 0 ||
				len(response.Entries) > definition.Response.MaxEntries {
				return nil, nil, ErrInvalid
			}

			entries := make([]string, 0, len(response.Entries))
			keys := make([]string, 0, len(response.Entries))
			seen := make(map[string]struct{}, len(response.Entries))
			for _, rawEntry := range response.Entries {
				entry := strings.TrimSpace(norm.NFKC.String(rawEntry))
				if entry == "" ||
					utf8.RuneCountInString(entry) > definition.Response.MaxEntryLength {
					return nil, nil, ErrInvalid
				}
				key := canonicalWordCloudEntry(entry)
				if key == "" {
					return nil, nil, ErrInvalid
				}
				if _, duplicate := seen[key]; duplicate {
					continue
				}
				seen[key] = struct{}{}
				entries = append(entries, entry)
				keys = append(keys, key)
			}
			if len(entries) == 0 {
				return nil, nil, ErrInvalid
			}
			normalized, err := json.Marshal(storedTextActivityResponse{
				Entries: entries,
				Terms:   keys,
			})
			if err != nil {
				return nil, nil, err
			}
			return normalized, nil, nil
		default:
			return nil, nil, ErrInvalid
		}
	default:
		return nil, nil, ErrInvalid
	}
}

func wordCloudTokens(value string) []string {
	normalized := strings.ToLower(norm.NFKC.String(value))
	tokens := make([]string, 0, 4)
	var current []rune

	flush := func() {
		if len(current) == 0 {
			return
		}
		term := strings.Trim(string(current), "'’\u200c\u200d")
		current = current[:0]
		if term != "" {
			tokens = append(tokens, term)
		}
	}

	for _, rawRune := range normalized {
		r := canonicalWordCloudRune(rawRune)
		if unicode.IsLetter(r) ||
			unicode.IsNumber(r) ||
			unicode.IsMark(r) ||
			r == '\u200c' ||
			r == '\u200d' ||
			((r == '\'' || r == '’') && len(current) > 0) {
			current = append(current, r)
			continue
		}
		flush()
	}
	flush()
	return tokens
}

func canonicalWordCloudEntry(value string) string {
	var builder strings.Builder
	pendingSpace := false
	for _, rawRune := range strings.ToLower(norm.NFKC.String(value)) {
		r := canonicalWordCloudRune(rawRune)
		if unicode.IsSpace(r) {
			if builder.Len() > 0 {
				pendingSpace = true
			}
			continue
		}
		if unicode.IsControl(r) {
			continue
		}
		if pendingSpace {
			builder.WriteRune(' ')
			pendingSpace = false
		}
		builder.WriteRune(r)
	}
	return strings.TrimSpace(builder.String())
}

func canonicalWordCloudRune(r rune) rune {
	// Persian users frequently paste Arabic keyboard variants. These glyphs
	// are visually equivalent in Persian Word Clouds but NFKC intentionally
	// keeps them distinct, so canonicalize only the aggregation key.
	switch r {
	case 'ي':
		return 'ی'
	case 'ك':
		return 'ک'
	default:
		return r
	}
}

func uniqueWordCloudTerms(tokens []string) []string {
	terms := make([]string, 0, len(tokens))
	seen := make(map[string]struct{}, len(tokens))
	for _, term := range tokens {
		if _, duplicate := seen[term]; duplicate {
			continue
		}
		seen[term] = struct{}{}
		terms = append(terms, term)
	}
	return terms
}

func decodeStrictResponse(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return ErrInvalid
	}
	return nil
}

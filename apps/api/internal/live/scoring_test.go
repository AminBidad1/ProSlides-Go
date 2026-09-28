package live

import (
	"testing"
	"time"
)

func TestDeductionPolicyScenarioMatrix(t *testing.T) {
	policy := DeductionPolicy{}

	tests := []struct {
		name     string
		question Question
		selected []int
		want     int
	}{
		{
			name:     "single correct answer gets full score",
			question: Question{Type: "single", Correct: []int{0}, MaxPoints: 100},
			selected: []int{0},
			want:     100,
		},
		{
			name:     "single wrong answer gets zero",
			question: Question{Type: "single", Correct: []int{0}, MaxPoints: 100},
			selected: []int{1},
			want:     0,
		},
		{
			name:     "missing correctness definition cannot score",
			question: Question{Type: "single", Correct: nil, MaxPoints: 100},
			selected: []int{0},
			want:     0,
		},
		{
			name:     "multiple exact match gets full score",
			question: Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100},
			selected: []int{0, 1},
			want:     100,
		},
		{
			name:     "exact mode rejects a correct subset",
			question: Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100},
			selected: []int{0},
			want:     0,
		},
		{
			name:     "partial mode awards proportional score",
			question: Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100, PartialScoring: true},
			selected: []int{0},
			want:     50,
		},
		{
			name:     "partial mode deducts wrong selections",
			question: Question{Type: "multiple", Correct: []int{0, 1, 2}, MaxPoints: 120, PartialScoring: true},
			selected: []int{0, 1, 9},
			want:     40,
		},
		{
			name:     "wrong selection can cancel partial credit but never go negative",
			question: Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100, PartialScoring: true},
			selected: []int{0, 9},
			want:     0,
		},
		{
			name:     "duplicate selections do not inflate score",
			question: Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100, PartialScoring: true},
			selected: []int{0, 0},
			want:     50,
		},
		{
			name: "speed bonus interpolates between min and max",
			question: Question{
				Correct:       []int{0, 1},
				MaxPoints:     100,
				MinPoints:     20,
				FasterAnswers: true,
				Duration:      10 * time.Second,
				Remaining:     5 * time.Second,
			},
			selected: []int{0, 1},
			want:     60,
		},
		{
			name: "speed bonus clamps remaining time above duration",
			question: Question{
				Correct:       []int{0},
				MaxPoints:     100,
				MinPoints:     20,
				FasterAnswers: true,
				Duration:      10 * time.Second,
				Remaining:     20 * time.Second,
			},
			selected: []int{0},
			want:     100,
		},
		{
			name: "speed bonus clamps negative remaining time to minimum",
			question: Question{
				Correct:       []int{0},
				MaxPoints:     100,
				MinPoints:     20,
				FasterAnswers: true,
				Duration:      10 * time.Second,
				Remaining:     -time.Second,
			},
			selected: []int{0},
			want:     20,
		},
		{
			name: "equal min and max points stay constant",
			question: Question{
				Correct:       []int{0},
				MaxPoints:     75,
				MinPoints:     75,
				FasterAnswers: true,
				Duration:      30 * time.Second,
				Remaining:     2 * time.Second,
			},
			selected: []int{0},
			want:     75,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := policy.Score(tt.question, tt.selected); got != tt.want {
				t.Fatalf("Score()=%d, want %d", got, tt.want)
			}
		})
	}
}

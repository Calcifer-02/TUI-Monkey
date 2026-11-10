// Пакет engine управляет тренировками независимо от интерфейса.
package engine

import (
	"embed"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"strings"
	"time"
	"unicode"
)

//go:embed languages/*
var dictionaries embed.FS

type Config struct {
	Mode        string   `json:"mode"`
	Language    string   `json:"language"`
	Words       int      `json:"words"`
	Duration    int      `json:"duration"`
	SuddenDeath bool     `json:"suddenDeath"`
	NoBackspace bool     `json:"noBackspace"`
	NoBacktrack bool     `json:"noBacktrack"`
	Text        string   `json:"text,omitempty"`
	WordList    []string `json:"wordList,omitempty"`
}

type KeyStat struct {
	Key    string `json:"key"`
	Misses int    `json:"misses"`
}
type Snapshot struct {
	Config      Config    `json:"config"`
	Text        string    `json:"text"`
	Typed       string    `json:"typed"`
	Status      string    `json:"status"`
	Elapsed     float64   `json:"elapsed"`
	Remaining   float64   `json:"remaining"`
	WPM         float64   `json:"wpm"`
	RawWPM      float64   `json:"rawWpm"`
	Accuracy    float64   `json:"accuracy"`
	Progress    float64   `json:"progress"`
	Errors      int       `json:"errors"`
	Streak      int       `json:"streak"`
	BestStreak  int       `json:"bestStreak"`
	Correct     int       `json:"correct"`
	Attempts    int       `json:"attempts"`
	MissedWords []string  `json:"missedWords"`
	WeakKeys    []KeyStat `json:"weakKeys"`
	Samples     []float64 `json:"samples"`
}

type Session struct {
	config                               Config
	target, typed                        []rune
	status                               string
	started, ended                       time.Time
	attempts, errors, streak, bestStreak int
	missed                               map[int]bool
	weak                                 map[rune]int
	samples                              []float64
	sampledSecond                        int
}

func Languages() []string {
	entries, _ := dictionaries.ReadDir("languages")
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

func Normalize(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || unicode.In(r, unicode.Cf) {
			return -1
		}
		return r
	}, text)
}

func New(c Config) (*Session, error) {
	if c.Mode != "words" && c.Mode != "time" && c.Mode != "custom" {
		return nil, fmt.Errorf("unknown mode: %s", c.Mode)
	}
	if c.Words < 1 || c.Words > 1000 {
		return nil, fmt.Errorf("words must be between 1 and 1000")
	}
	if c.Duration < 1 || c.Duration > 600 {
		return nil, fmt.Errorf("duration must be between 1 and 600 seconds")
	}
	text := Normalize(c.Text)
	if c.Mode != "custom" {
		text = ""
	}
	if len([]rune(text)) > 10000 {
		return nil, fmt.Errorf("custom text exceeds 10000 characters")
	}
	if c.Mode == "custom" && text == "" {
		return nil, fmt.Errorf("custom text is empty")
	}
	if text == "" {
		words := c.WordList
		if len(words) == 0 {
			if strings.ContainsAny(c.Language, "/\\.") {
				return nil, fmt.Errorf("invalid language")
			}
			data, err := dictionaries.ReadFile("languages/" + c.Language)
			if err != nil {
				return nil, fmt.Errorf("unknown language: %s", c.Language)
			}
			words = strings.Fields(string(data))
		}
		if len(words) == 0 {
			return nil, fmt.Errorf("word list is empty")
		}
		n := c.Words
		// Запас текста для самой продолжительной тренировки.
		if c.Mode == "time" {
			n = c.Duration * 6
		}
		selected := make([]string, n)
		last := -1
		for i := range selected {
			pick := rand.IntN(len(words))
			if len(words) > 1 && pick == last {
				pick = (pick + 1 + rand.IntN(len(words)-1)) % len(words)
			}
			selected[i], last = words[pick], pick
		}
		text = Normalize(strings.Join(selected, " "))
	}
	if text == "" {
		return nil, fmt.Errorf("word list is empty")
	}
	return &Session{config: c, target: []rune(text), status: "ready", missed: map[int]bool{}, weak: map[rune]int{}, samples: []float64{}}, nil
}

func (s *Session) elapsed(now time.Time) float64 {
	if s.started.IsZero() {
		return 0
	}
	if !s.ended.IsZero() {
		now = s.ended
	}
	return math.Max(0, now.Sub(s.started).Seconds())
}

func (s *Session) Tick(now time.Time) {
	if s.status != "running" {
		return
	}
	if s.config.Mode == "time" && s.elapsed(now) >= float64(s.config.Duration) {
		s.status = "complete"
		s.ended = s.started.Add(time.Duration(s.config.Duration) * time.Second)
	}
	elapsed := s.elapsed(now)
	if int(elapsed) > s.sampledSecond {
		s.samples = append(s.samples, s.wpm(now))
		s.sampledSecond = int(elapsed)
	}
}

func (s *Session) Input(value string, now time.Time) {
	s.Tick(now)
	if s.status != "ready" && s.status != "running" {
		return
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			continue
		}
		if len(s.typed) >= len(s.target) {
			break
		}
		if s.started.IsZero() {
			s.started = now
			s.status = "running"
		}
		expected := s.target[len(s.typed)]
		s.attempts++
		if r == expected {
			s.streak++
			if s.streak > s.bestStreak {
				s.bestStreak = s.streak
			}
		} else {
			s.errors++
			s.streak = 0
			s.weak[expected]++
			word := strings.Count(string(s.target[:len(s.typed)]), " ")
			s.missed[word] = true
		}
		s.typed = append(s.typed, r)
		if s.config.SuddenDeath && r != expected {
			s.status = "failed"
			s.ended = now
			break
		}
		if len(s.typed) == len(s.target) {
			s.status = "complete"
			s.ended = now
			break
		}
	}
}

func (s *Session) Backspace(word bool, now time.Time) {
	s.Tick(now)
	if s.status != "running" || s.config.NoBackspace || len(s.typed) == 0 {
		return
	}
	n := len(s.typed)
	if s.config.NoBacktrack && s.typed[n-1] == ' ' {
		return
	}
	n--
	if word {
		for n > 0 && s.typed[n-1] != ' ' {
			n--
		}
	}
	s.typed = s.typed[:n]
	s.streak = 0
}

func (s *Session) Abort(now time.Time) {
	s.Tick(now)
	if s.status == "running" {
		s.status = "aborted"
		s.ended = now
	}
}

func (s *Session) correct() int {
	count := 0
	for i, r := range s.typed {
		if r == s.target[i] {
			count++
		}
	}
	return count
}
func (s *Session) wpm(now time.Time) float64 {
	elapsed := s.elapsed(now)
	if elapsed < 0.1 {
		return 0
	}
	return float64(s.correct()) / 5 / (elapsed / 60)
}
func round(n float64) float64 { return math.Round(n*10) / 10 }

func (s *Session) Snapshot(now time.Time) Snapshot {
	s.Tick(now)
	elapsed := s.elapsed(now)
	accuracy, raw := 100.0, 0.0
	if s.attempts > 0 {
		accuracy = 100 * float64(s.attempts-s.errors) / float64(s.attempts)
	}
	if elapsed >= 0.1 {
		raw = float64(s.attempts) / 5 / (elapsed / 60)
	}
	remaining := math.Max(0, float64(s.config.Duration)-elapsed)
	progress := float64(len(s.typed)) / float64(len(s.target))
	if s.config.Mode == "time" {
		progress = elapsed / float64(s.config.Duration)
	}
	missed, seen := []string{}, map[string]bool{}
	words := strings.Fields(string(s.target))
	for i, w := range words {
		if s.missed[i] && !seen[w] {
			missed = append(missed, w)
			seen[w] = true
		}
	}
	weak := []KeyStat{}
	for k, n := range s.weak {
		weak = append(weak, KeyStat{string(k), n})
	}
	sort.Slice(weak, func(i, j int) bool {
		if weak[i].Misses == weak[j].Misses {
			return weak[i].Key < weak[j].Key
		}
		return weak[i].Misses > weak[j].Misses
	})
	return Snapshot{s.config, string(s.target), string(s.typed), s.status, round(elapsed), round(remaining), round(s.wpm(now)), round(raw), round(accuracy), math.Min(1, progress), s.errors, s.streak, s.bestStreak, s.correct(), s.attempts, missed, weak, s.samples}
}

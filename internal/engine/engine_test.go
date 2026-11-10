package engine

import (
	"math"
	"testing"
	"time"
)

func session(t *testing.T, text string) *Session {
	t.Helper()
	s, err := New(Config{Mode: "custom", Language: "english200", Words: 25, Duration: 30, Text: text})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func TestUnicodeAndMetrics(t *testing.T) {
	s := session(t, "привет мир")
	start := time.Unix(100, 0)
	s.Input("привет ", start)
	s.Input("мир", start.Add(12*time.Second))
	got := s.Snapshot(start.Add(40 * time.Second))
	if got.Status != "complete" || got.WPM != 10 || got.Accuracy != 100 || got.Elapsed != 12 {
		t.Fatalf("unexpected metrics: %+v", got)
	}
}
func TestCorrectionDoesNotEraseMistake(t *testing.T) {
	s := session(t, "go now")
	now := time.Unix(100, 0)
	s.Input("gx", now)
	s.Backspace(false, now)
	s.Input("o now", now.Add(time.Second))
	got := s.Snapshot(now.Add(time.Second))
	if got.Errors != 1 || got.Correct != 6 || got.Attempts != 7 || got.Accuracy != 85.7 || len(got.MissedWords) != 1 || got.MissedWords[0] != "go" {
		t.Fatalf("bad correction: %+v", got)
	}
}
func TestTimerStartsOnFirstCharacterAndClamps(t *testing.T) {
	s := session(t, "the quick brown fox")
	s.config.Mode = "time"
	s.config.Duration = 15
	now := time.Unix(100, 0)
	if s.Snapshot(now).Elapsed != 0 {
		t.Fatal("idle timer advanced")
	}
	s.Input("the", now)
	s.Input(" x", now.Add(16*time.Second))
	got := s.Snapshot(now.Add(time.Hour))
	if got.Status != "complete" || got.Elapsed != 15 || got.Typed != "the" || got.Remaining != 0 {
		t.Fatalf("timer: %+v", got)
	}
}
func TestStrictModes(t *testing.T) {
	now := time.Unix(100, 0)
	s := session(t, "one two")
	s.config.NoBacktrack = true
	s.Input("one ", now)
	s.Backspace(true, now)
	if string(s.typed) != "one " {
		t.Fatal("backtracked")
	}
	s.config.NoBackspace = true
	s.Input("t", now)
	s.Backspace(false, now)
	if string(s.typed) != "one t" {
		t.Fatal("backspace allowed")
	}
	s = session(t, "one")
	s.config.SuddenDeath = true
	s.Input("xone", now)
	if s.status != "failed" || string(s.typed) != "x" {
		t.Fatal("sudden death ignored")
	}
}

func TestAbortFreezesPartialResult(t *testing.T) {
	s := session(t, "hello world")
	now := time.Unix(100, 0)
	s.Input("hello", now)
	s.Abort(now.Add(5 * time.Second))
	s.Input(" world", now.Add(6*time.Second))
	got := s.Snapshot(now.Add(time.Hour))
	if got.Status != "aborted" || got.Elapsed != 5 || got.WPM != 12 || got.Typed != "hello" {
		t.Fatalf("abort: %+v", got)
	}
}
func TestValidationAndDictionary(t *testing.T) {
	if Normalize("hello\x1b world\u202e") != "hello world" {
		t.Fatal("control characters retained")
	}
	for _, lang := range Languages() {
		s, err := New(Config{Mode: "words", Language: lang, Words: 10, Duration: 30})
		if err != nil || len(s.target) == 0 {
			t.Fatalf("dictionary %s: %v", lang, err)
		}
	}
	_, err := New(Config{Mode: "words", Language: "../../secret", Words: 10, Duration: 30})
	if err == nil {
		t.Fatal("invalid language accepted")
	}
	_, err = New(Config{Mode: "custom", Words: 10, Duration: 30, Text: " \n "})
	if err == nil {
		t.Fatal("empty custom text accepted")
	}
	s := session(t, "a")
	now := time.Now()
	s.Input("a", now)
	if math.IsNaN(s.Snapshot(now).WPM) || math.IsInf(s.Snapshot(now).WPM, 0) {
		t.Fatal("nonfinite WPM")
	}
}

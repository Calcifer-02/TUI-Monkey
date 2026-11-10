package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"github.com/Calcifer-02/TUI-Monkey/internal/engine"
	"os"
	"time"
)

type request struct {
	ID     int           `json:"id"`
	Type   string        `json:"type"`
	Config engine.Config `json:"config"`
	Text   string        `json:"text"`
	Word   bool          `json:"word"`
}
type response struct {
	ID        int              `json:"id"`
	State     *engine.Snapshot `json:"state,omitempty"`
	Languages []string         `json:"languages,omitempty"`
	Error     string           `json:"error,omitempty"`
}

func main() {
	scan := bufio.NewScanner(os.Stdin)
	scan.Buffer(make([]byte, 4096), 1024*1024)
	out := json.NewEncoder(os.Stdout)
	var session *engine.Session
	for scan.Scan() {
		var req request
		if err := json.Unmarshal(scan.Bytes(), &req); err != nil {
			_ = out.Encode(response{Error: "invalid JSON"})
			continue
		}
		res := response{ID: req.ID}
		now := time.Now()
		switch req.Type {
		case "languages":
			res.Languages = engine.Languages()
		case "start":
			next, err := engine.New(req.Config)
			if err != nil {
				res.Error = err.Error()
			} else {
				session = next
			}
		case "input", "backspace", "tick", "abort":
			if session == nil {
				res.Error = "start a session first"
				break
			}
			switch req.Type {
			case "input":
				session.Input(req.Text, now)
			case "backspace":
				session.Backspace(req.Word, now)
			case "tick":
				session.Tick(now)
			case "abort":
				session.Abort(now)
			}
		default:
			res.Error = "unknown request type"
		}
		if session != nil && res.Error == "" && req.Type != "languages" {
			state := session.Snapshot(now)
			res.State = &state
		}
		if err := out.Encode(res); err != nil {
			return
		}
	}
	if err := scan.Err(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

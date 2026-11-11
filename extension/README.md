# TUI Monkey

Typing practice in the VS Code terminal.

- Word, timed and custom-text practice.
- Live WPM, accuracy, streaks and progress.
- Russian, English and programming dictionaries from ttyper.
- Personal greeting from your VS Code GitHub account, Git or OS username.
- Local history, personal bests and missed-word practice.
- Feed the monkey a banana with Space in the menu.

Run **TUI Monkey: Start Typing** from the Command Palette, or click
**Monkey** in the status bar. Select text and use
**TUI Monkey: Practice Selected Text** to train with your own code.

Use arrows to configure your session, Enter to start, Tab to restart,
Escape for the menu and Ctrl+C to quit. Expand the terminal to at least
44 columns and 18 rows; the full mascot panel appears at 82 × 24.

This extension includes its own executable and Go engine. No separate
Go, Bun or Node.js installation is required. Install the VSIX matching
your operating system and architecture.

Settings: `tuiMonkey.language`, `tuiMonkey.words`,
`tuiMonkey.displayName`, `tuiMonkey.showStatusBar`.

Results stay in `~/.tui-monkey/history/`. Interrupted sessions are saved
and included in statistics. Select a history entry and press D to delete it.
No telemetry or cloud sync.
Selected text is written to a temporary local file and removed when
the terminal closes. Text is never included in history.

Source: [TUI Monkey on GitHub](https://github.com/Calcifer-02/TUI-Monkey).

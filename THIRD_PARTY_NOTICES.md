# Third-party notices

TUI Monkey is a Go and TypeScript reimplementation inspired by
[ttyper](https://github.com/max-niederman/ttyper), by Max Niederman.

The original Rust source, Cargo files, README and MIT license are preserved
under `reference/ttyper/`, from commit
`e218bad9d5c546ff31c1b2a141a42c2eebf50d23`.
The complete upstream repository was cloned into the ignored `.upstream/ttyper/`
directory during development. The reference snapshot is not built or executed.
Upstream word lists are embedded into the Go binary from
`internal/engine/languages/`. Their copyright notice is distributed with
each package as `TTYper-LICENSE.md`.

Copyright (c) 2022 Max Niederman. Licensed under the MIT License.

Runtime dependencies include React (MIT), Ink (MIT), Yoga (MIT), Zod (MIT),
and Bun (MIT). Standalone extension bundles include their transitive runtime
dependencies. See `DEPENDENCY_LICENSES.txt` in the extension package for
the bundled dependency license texts. npm dependencies carry their own
license files. The mascot is an original terminal character; the project has no
affiliation with Anthropic, Claude Code, or ttyper's maintainers.

---
title: Claude Code Wordle mod — design spec
status: approved
date: 2026-10-07
---

# Claude Wordle mod — design spec

A Claude Code mod that lets a developer play a Wordle-style game in a pane
while Claude is generating a response (or anytime, on demand), so waiting
on a long turn isn't dead time.

This is the stable reference every implementation stage reads from. It
does not change per stage — if a decision here turns out wrong, fix it
here first, then update the stages that depended on it.

## 1. Target surfaces

Both the CLI terminal and the Code tab of the Claude Desktop app. One
codebase. Rendering must work identically on both, which rules out the
`Raster` element (terminal-only) as the primary board renderer — the
board is drawn with emoji/text tiles (🟩🟨⬜) instead, which render fine
everywhere and need no surface-specific branching.

## 2. Trigger model

- `/wordle` command: always available, opens the pane on demand,
  regardless of whether Claude is mid-turn.
- A persisted config flag (`$.store` key, toggled via
  `/wordle config auto-open on|off`) controls whether a `turn.start` hook
  *also* opens the pane automatically when Claude begins generating.
- The pane never auto-closes on `turn.complete`. The user closes it
  themselves (✕ / Esc). Auto-open is a convenience; auto-close would
  fight the user if they're mid-guess when the turn finishes.
- An auto-opened pane (opened by the mod itself, not by a user action)
  only appears in a terminal ≥144 columns wide (≥110 after the user has
  opened it manually once) — a `mods` platform constraint, not something
  this mod can override. `/wordle` run directly by the user has no such
  width gate.

## 3. Game rules

Classic Wordle: one 5-letter answer word, 6 guesses, each guess scored
letter-by-letter as green (correct position), yellow (in the word, wrong
position), or gray (not in the word), with standard duplicate-letter
handling (a repeated letter in the guess is scored against the remaining
unmatched copies in the answer, greens claimed first).

## 4. Word source

### 4.1 Daily word

Primary source: the NYT's unofficial, undocumented endpoint —

```
GET https://www.nytimes.com/svc/wordle/v2/<YYYY-MM-DD>.json
→ { "id": ..., "solution": "prove", "print_date": "2026-10-07",
    "days_since_launch": 1936, "editor": "..." }
```

Verified reachable and unauthenticated on 2026-10-07 (returned `"prove"`
for today and `"mural"` for 2024-01-01). It is **not** a documented,
supported public API — it can change or be blocked without notice. Short
timeout (~3s) on every call.

Each date's resolved solution is cached in `$.store` keyed by date, so
it's fetched at most once ever per date, not once per pane-open.

### 4.2 Fallback

If the live fetch fails (timeout, non-200, schema change): fall back to
a word computed **offline and deterministically** from a small bundled
answer list (`data/fallback-answers.txt`) via
`index = daysSinceEpoch(date) % fallbackList.length`. The resulting
record for that date is tagged `source: "fallback"` (vs `"live"`).

The board UI shows a small warning indicator when the active puzzle's
word came from the fallback path. Selecting/pressing the indicator shows
the reason (e.g. "Couldn't reach the live word — showing an offline
puzzle instead.") as a toast — there's no hover in a terminal, so this is
click/press-to-reveal, not hover-to-reveal.

### 4.3 Archive (past puzzles)

Because the primary source is a pure function of date, "play a past
puzzle" needs no separate archive storage — it's the same resolution
path (§4.1 → §4.2) called with a past date instead of today. The UI
lets the user pick a past date (recent-days list, or free date entry) and
plays it the same way, through the same engine.

### 4.4 Valid-guess list

Separate from the answer: Wordle validates a *guess* against a much
larger "allowed guesses" list (~13,000 words) that NYT does not expose
as an API. This is bundled locally (`data/valid-guesses.txt`) regardless
of where the answer comes from.

## 5. Input method

Primary: an on-screen clickable keyboard (one `Button` per letter, plus
Enter/Backspace) drawn in the pane. Mouse clicks reach a `Button`
regardless of current keyboard focus, so this never fights with typing
a prompt to Claude.

Secondary: when the pane itself has keyboard focus (user pressed
Ctrl+X then Tab, or clicked into the pane), physical keyboard letter
keys, Enter, and Backspace also drive the same guess-entry logic as the
on-screen keyboard — not a separate input path, just another way to
trigger the same letter/submit/delete actions.

## 6. Stats

Tracked and persisted via `$.store`: current streak, max streak, win %,
and guess-count distribution (how many wins took 1 guess, 2 guesses,
…6). Only completions of **today's live daily puzzle** count toward
stats — playing an archived past date (§4.3) is practice and never
touches streak/win%/distribution. This mirrors how the real Wordle treats
its archive/practice modes.

## 7. Persistence model (`$.store` keys)

| Key | Holds |
|---|---|
| `word:<date>` | `{ solution, source: "live"\|"fallback" }` for that date, cached once resolved |
| `board:<date>` | in-progress/finished guesses for that date's puzzle, so closing and reopening the pane doesn't lose progress |
| `stats` | `{ currentStreak, maxStreak, wins, played, distribution: [n1..n6] }` — today's puzzle only |
| `config:autoOpen` | boolean, toggled by `/wordle config auto-open on\|off` |

## 8. Confirmed mods-platform capabilities this design relies on

(From `code.claude.com/docs/en/plugins/mods/*`, read 2026-10-07.)

- A pane (`$.ui.open`/`$.ui.close`) can hold `Box`, `Text`, `Button`,
  `Input`, `Select` — enough for the board, keyboard, and archive picker.
- `turn.start` / `turn.complete` hooks give exact start/end of a turn.
- `$.store` persists across sessions; `$.state` persists for a session
  and auto-redraws subscribers.
- A pane opened by the mod itself (not by direct user action) is subject
  to the width gate in §2 — this is a platform rule, confirmed from docs,
  not a bug to work around.
- `Raster` (colored-cell grid) is terminal-only — confirmed reason for
  the emoji-tile decision in §1.

## 9. Explicitly out of scope (for this build)

- Matching NYT's *actual* site pixel-for-pixel; this is a mod-native
  pane UI, not a web clone.
- Multiplayer / sharing results with others.
- Any word source other than NYT-live + offline-fallback (no third-party
  mirror APIs) — simpler surface area, one fewer external dependency.

# Claude Wordle mod — the build pipeline

The flow in one line: scaffold the plugin, build the word source, build
the game rules, build the UI, wire it to Claude's turn lifecycle, add
stats and the archive, then test and polish.

Reference (every stage, read-only): `../docs/spec/2026-10-07-wordle-mod-design.md`

| Stage | Job | Input | Output (real paths, repo root) | Human check |
|---|---|---|---|---|
| `01_scaffold` | Minimal loadable plugin + `/wordle` command | spec §1, §2 | `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.js`, `types/index.d.ts`, `.gitignore` | `/wordle` opens and closes an empty pane in a terminal session |
| `02_word_source` | Resolve a date to a word, live + fallback | spec §4 | `hooks/lib/word-source.js`, `data/fallback-answers.txt`, `data/valid-guesses.txt` | Resolving 2026-10-07 and 2024-01-01 returns `prove`/`mural`; forcing a network failure returns a tagged fallback word instead of throwing |
| `03_game_engine` | Score a guess against an answer | spec §3, 02's valid-guess list | `hooks/lib/game-engine.js` | Hand-check scoring against known tricky cases (double letters, e.g. guess `ALLOY` vs answer `ATOLL`) |
| `04_interface` | Draw the board, on-screen keyboard, warning indicator | spec §1, §5; 03's engine | `hooks/lib/board-view.js` (pure `renderBoard`), plus state/handlers/render hook in `hooks/register.js` | Play one full game by mouse clicks only, in both the terminal and the Desktop app Code tab; typed keys also work once the pane has focus |
| `05_lifecycle_integration` | Wire `/wordle`, auto-open config flag, turn hooks | spec §2; 01's command, 04's pane | additions to `hooks/register.js` (or a new `hooks/lib/lifecycle.js`) | With the flag on, pane auto-opens on `turn.start` and stays open past `turn.complete`; with it off, it doesn't auto-open |
| `06_stats_and_archive` | Streak/win%/distribution; replay past dates | spec §4.3, §6, §7; 02, 03, 04 | `hooks/lib/stats.js`, `hooks/lib/archive.js`; archive picker in `hooks/lib/board-view.js` (view) with its handlers in `hooks/register.js` | Finish today's puzzle → stats update; finish an archived date → stats unchanged |
| `07_testing_polish` | Automated tests, README, manual QA pass | all prior stages | `hooks/__tests__/*`, `README.md` | Test suite green; following `README.md` from a clean checkout successfully loads the mod |
| `08_ui_redesign` | Redraw the pane as the arcade "Claude night" reference; look only, no rule changes | all prior stages; `docs/ui-ref/wordle-ui-final.png` | `hooks/lib/arcade.js`, `hooks/lib/board-view.js`, `hooks/register.js`, `types/index.d.ts`, `hooks/__tests__/arcade.test.ts`, `README.md`, `VERIFY.md` | At ~100 columns the pane matches the reference in the terminal and the Desktop app; it degrades cleanly at ~60; the win celebration still plays and hands back to the new board |

Factory (stable, every stage): `../docs/spec/2026-10-07-wordle-mod-design.md`
Product (grows stage by stage): `.claude-plugin/`, `hooks/`, `data/`, `types/` at repo root — not a separate `output/`, because the deliverable *is* the plugin source; a stage's contract names the exact files it adds or changes there.

Status is whatever exists: a stage is COMPLETE when every file in its
Output column exists at that path AND its human check has actually been
run and passed — a file existing with a failing human check is
IN PROGRESS, not done.

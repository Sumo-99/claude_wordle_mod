# 11_opening_splash — "Chomp & grade" opening splash

One job: play a short arcade attract screen each time the Wordle pane
opens (`/wordle`, and auto-open on `turn.start`), then hand off to today's
game or, when today is finished, the Pick a game screen. Gameplay, the
engine, the word source, stats, the played-today set and the win
celebration are untouched.

## Inputs
- Working: stage `10`'s `hooks/register.js`, `hooks/lib/board-view.js`, `hooks/lib/arcade.js` (PALETTE)
- The 5×7 half-block font: `blockTitle` from stage 08's `hooks/lib/arcade.js` (commit `e475239`; stage 09 dropped it with the big title). It comes back unchanged.
- Model: `hooks/lib/fireworks.js` (`celebrationRows`) and how `board-view.js` draws `celebrationScreen`
- Reference: `../../../docs/ui-ref/wordle-splash-AB.png` (six keyframes, t = 0.5, 1.2, 2.0, 2.8, 3.1, 3.6 s)

Do NOT edit: `game-engine.js`, `word-source.js`, `stats.js`, `fireworks.js`, `lifecycle.js`, `picker.js`, `archive.js`.

## The picture (base 78 × 11, centred in a bigger pane, never stretched)
| Row | Holds |
|---|---|
| 0, 10 | `╔═╗ ║ ╚═╝` double-line border, walls color |
| 1 | HUD: `1UP 00000` left (label title color, value text color), `HI-SCORE nnnnn` centred and dim, `STAGE DD MON` right |
| 3–6 | WORDLE in the block font, 35 × 4, centred |
| 8 | `READY!` (present, bold, blinks every 300 ms), or `✓ ✓ ✓ ✓ ✓ ✓` (correct) during the grade |
| 9 | dim `DAILY PUZZLE · ` (or `PICK YOUR NEXT GAME · ` when today is finished) and the skip Button `1: PRESS ANY KEY TO SKIP` |

## Timeline (100 ms frames; frame f shows the moment t = f × 100 ms)
| Frames | t | Phase |
|---|---|---|
| 0–24 | 0.0–2.4 s | **Chomp**: the eater moves at a steady speed from 2 columns left of the title to 2 past it. Behind it, title pixels in their score colors (W correct, O present, R correct, D miss `#5a524a`, L present, E correct); ahead, the `•` pellet row on title row 2 (index 1) with `●` at both ends. The eater is 2 columns (`▐` on all 4 title rows, `█` on the middle two) in the color of the letter it is in (present before the first) |
| 25 | 2.5 s | the scored title, pellets gone |
| 26–29 | 2.6–2.9 s | **Grade**: letter i turns correct at frame 26 + ⌊4i/6⌋; `✓ ✓ ✓ ✓ ✓ ✓` on row 8 |
| 30–31 | 3.0–3.1 s | **Flash**: every title pixel `#fff4e6` (3.15 s falls inside frame 31) |
| 32–39 | 3.2–3.9 s | **Settle**: terracotta title, READY! blinking, row 9 line |
| 40 | 4.0 s | **Hand-off**: today unfinished → today's game; finished → the picker |

- **Auto-open** (`turn.start`, and only when the pane wasn't already open): 20 frames, chomp at double speed in frames 0–13, no grade or flash, settle 14–19.
- **Reduced motion** (`config:reduceMotion`, as the celebration): 10 frames of the settled picture, READY! steady. Wins over auto-open.

## Rules (decided; tests pin them)
- `splashRows(frame, screen, opts)` in `hooks/lib/splash.js` is pure and deterministic; every row is exactly the frame's width.
- **Skip**: any key, a click, or hotkey `1` ends it at once and hands off. The click and `1` are the row 9 Button (before the settle it reads `1: SKIP`, so there is something to click). Typed keys land in a key-catcher Input (key `splash-key`, drawn zero rows tall so the picture is unchanged) that has the focus while the splash runs; the letter that skips is never put in the guess.
- **Narrow** (< 41 columns): a plain bold `W O R D L E` replaces the block title; its letters appear left to right in the score colors over the chomp, then the same grade, flash and settle. The HUD drops HI-SCORE, then STAGE, when it doesn't fit; row 9 drops its prefix.
- **Short** (< 11 rows): drop the HUD row, then row 9, then the blank rows, then the border. The title and READY! always show (5 rows at the least).
- **One per open**: the splash starts on the pane's first draw after an open, so a pane that waits unplaced plays it when it appears. Redraws and resizes never restart it; a new `/wordle` does. Closing the pane ends it with no hand-off.
- The splash reads the store (HI-SCORE, whether today is finished) and never writes it.

## Outputs
- `hooks/lib/splash.js` (new), `hooks/lib/arcade.js` (`blockTitle` back), `hooks/lib/board-view.js` (`splashScreen`), `hooks/register.js` (splash state, timer, skip, hand-off), `types/index.d.ts`
- `hooks/__tests__/splash.test.ts` (the existing suites pass unedited)
- `README.md`, `VERIFY.md` (Stage 11 checklist), `docs/ui-ref/wordle-splash-AB.png`

## Human check
`claude --plugin-dir .`, then run the "Stage 11" list in `VERIFY.md`: `/wordle` with today unplayed and finished, skip by key and by click, auto-open's short version, reduced motion, a ~40-column and a ~8-row pane, a resize mid-splash, and the Desktop app.

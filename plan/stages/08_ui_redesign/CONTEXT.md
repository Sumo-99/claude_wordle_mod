# 08_ui_redesign — the arcade "Claude night" pane

> **Layout superseded by `../09_compact_layout/`.** The palette, behavior and platform findings below still stand; the tall layout (3-row tiles, block title, double walls, density tiers) was replaced by a compact one.

> **Layout superseded by `../09_compact_layout/`.** The palette and the
> platform findings below still hold; the block-letter title, the 5×3 tiles,
> the double-line key frames and the density tiers were replaced by the
> compact ~12-row layout.

One job: redraw the Wordle pane to match `docs/ui-ref/wordle-ui-final.png`
(the source of truth; `docs/ui-ref/wordle-key-styles.png` option 5 shows the
key style alone). This changes how the pane LOOKS, never how the game plays:
the game engine, word source, stats, archive and the win celebration
(`hooks/lib/fireworks.js`) are untouched, and every control the old pane had
is still reachable.

## Inputs
- Working: the whole plugin as stages `01`–`07` left it, plus the post-07
  celebration and UX fixes already on `main`
- Reference: `../../../docs/ui-ref/wordle-ui-final.png`, `../../../docs/ui-ref/wordle-key-styles.png` (option 5),
  `../../../docs/spec/2026-10-07-wordle-mod-design.md` §1 (amended by this stage: raw hex, no legend)

Do NOT load: `hooks/lib/game-engine.js`, `word-source.js`, `stats.js`,
`archive.js` or `fireworks.js` for editing — they are read-only here. If the
new look seems to need a rule change, it is out of scope.

## Platform findings this stage builds on (checked against the mod API types)
- **A Button's label can't be colored.** `ButtonProps` has no `color` (only
  `dimColor` and a hover override). So a key is a `Box` with
  `borderStyle: 'double'` and a `borderColor` by state, holding a `plain`
  Button; only the frame carries the color, the letter stays text-colored.
  For the same reason the `◀ ▶`, `▶ TODAY` and `▾` controls are text-colored.
- **A `plain` Button with a `hotkey` draws `q: Q`.** A letter-only key can't
  carry a hotkey. Decision (the person's): letter keys have no per-letter
  hotkey; `⏎` keeps `1` and `⌫` keeps `2` and draw one column wider (`1: ⏎`).
- **Hotkeys can't replace the Guess input.** A hotkey is one letter or digit
  and only fires while the pane has focus outside an Input; physical
  Backspace can never be one. So the Guess `Input` stays, one line, labelled
  `TYPE ›`, `autoFocus`: physical letters, Backspace and Enter work as before.
- **Desktop**: Box is a flex div, Text a styled span, Button a native button
  even when `plain`. Hex colors are accepted everywhere. Whether a `double`
  border paints as `║` glyphs on Desktop is not specified, and the test kit
  sees only the tree, never the paint — so Desktop fidelity is a human check.
  No `Raster`.

## Process
1. `hooks/lib/arcade.js` (new, pure): the palette, the 5×7 `WORDLE` bitmap
   packed into `▀▄█`, `gameScore` (100 × guesses left on a win), `hiScore`
   (from the stats distribution: the fewest-guess win), `stageLabel`
   (`27 SEP`), `stepStage` (◀ ▶ through the last 14 days), `livesText`,
   `tileLook` and `keyLook` (colors by state).
2. `hooks/lib/board-view.js`: rewrite `renderBoard` top to bottom as the
   reference — score header, title (plain bold `WORDLE` under 70 columns),
   `── PRACTICE STAGE ──` on practice days, then the board panel and the
   controls panel side by side in `double` walls (stacked below ~88
   columns). Keep `keyStates`, `ENTER_KEY`, `BACKSPACE_KEY`, `FALLBACK_NOTE`
   and the celebration screen as they are. Remove the legend, the
   `Guess 1/6 · …` status line, the `Play another day` block, the Day
   `Select`, every `[ ]` button and the separate stats pane.
3. `hooks/register.js`: the stats pane and its `ui.close` bookkeeping go; the
   `▾` beside the stats row opens an inline details block (played, the 1–6
   distribution, **Clear stats**). Add handlers for `◀`/`▶`/`▶ TODAY` and a
   small `DATE…` control that reveals the typed-date field.
4. Update `types/index.d.ts` (`isStatsOpen` now means the inline details;
   new `isDateEntryOpen`) and `hooks/__tests__/board.test.ts`, and add
   `hooks/__tests__/arcade.test.ts`.
5. Update `README.md` and `VERIFY.md` (new controls, this stage's check list),
   and amend spec §1.

## Outputs
- `hooks/lib/arcade.js`
- `hooks/lib/board-view.js` (rewritten `renderBoard`; `renderStats` removed)
- `hooks/register.js` (stats pane removed; stage stepping, details, date entry)
- `types/index.d.ts`
- `hooks/__tests__/arcade.test.ts`, `hooks/__tests__/board.test.ts`
- `README.md`, `VERIFY.md`, spec §1 amendment

## Human check
Run `claude --plugin-dir .`, open `/wordle` in a terminal about 100 columns
wide and compare it side by side with `docs/ui-ref/wordle-ui-final.png`:
header, block title, the two walled panels, tile shapes and colors, the
key frames, misses turning into a dim `·`, the stats and stage rows. Play a
game by typing and by clicking; step days with `◀ ▶`, jump back with
`▶ TODAY`; win once and confirm the celebration plays and hands back to the
new board. Narrow the terminal to about 60 columns: the title becomes plain
`WORDLE` and the controls panel drops under the board, nothing overlaps.
Repeat in the Desktop app's Code tab and note anything that paints
differently. The full list is in `VERIFY.md` under "Stage 08".

# 04_interface — draw the board and keyboard

One job: render the game state from stage `03` into the pane, as emoji
tiles plus a clickable on-screen keyboard, identically on the terminal
and the Desktop app. This stage makes the game playable by mouse; typed
input reuses the same control callbacks, not a parallel path.

## Inputs
- Working: `../03_game_engine/` output (`createGame`, `submitGuess`, `scoreGuess`)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §1 (emoji tiles, not `Raster`), §5 (input method), §4.2 (warning indicator for fallback words)

Do NOT load: §2 (turn hooks / auto-open) or §6 (stats) — this stage
draws one game's state; it doesn't decide when the pane opens or update
streaks. Those are stages `05` and `06`.

## Process
1. Write `hooks/lib/board-view.js` exporting a `ui.render` hook (filtered to `{ component: 'Pane' }`, matching the `wordle` pane id) that:
   - Draws the guesses-so-far as rows of `Text` tiles: 🟩/🟨/⬜ per `scoreGuess` result (plus the letter itself, since emoji-only is not colorblind-friendly — letter inside or beside each tile).
   - Draws a QWERTY-layout row of `Button`s below the board, one per letter, each `onPress` appending that letter to the current guess (held in module state or `$.state`); a `Button` for Backspace and one for Enter (submits via `submitGuess`).
   - If the active word's record has `source: 'fallback'` (from stage `02`), draws a small warning `Button`/marker whose `onPress` shows the explanation via `$.ui.toast`.
   - Redraws (`$.ui.invalidate('ui.render')`) after every control press, following the same render-cycle pattern as the mods docs' own examples.
2. Confirm the same tree renders correctly on `e.surface === 'terminal'` and `'desktop'` — no `Raster`, no surface-specific branch needed, by construction (plain `Text`/`Button`/`Box` only).
3. Wire physical-keyboard input: give the pane `focus: true` on open (already set in stage `01`); because `Input`-style typing isn't the goal here (§5 — only letters/Enter/Backspace matter, not free text), handle this via each letter `Button`'s own `hotkey` prop (one lowercase letter each) rather than a separate `Input` field — a button's hotkey fires the same `onPress` whether clicked or typed, which is exactly "same action, two triggers" from the spec.

## Outputs
- `hooks/lib/board-view.js`

## Human check
Run `claude --plugin-dir .`, open `/wordle`, and play one full game
(win or lose) using only mouse clicks on the on-screen keyboard — confirm
tile colors match expectations after each guess. Repeat in the Desktop
app's Code tab. Then, with the pane focused, play a guess using the
physical keyboard instead of clicking, and confirm it behaves
identically. If the active word is a fallback word, confirm the warning
marker appears and pressing it shows the explanation.

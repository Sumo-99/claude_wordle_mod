# 04_interface — draw the board and keyboard

One job: render the game state from stage `03` into the pane — colored,
underlined letters plus a clickable on-screen keyboard and a color legend —
identically on the terminal and the Desktop app. This stage makes the game
playable by mouse; typed input reuses the same control callbacks, not a
parallel path.

## Inputs
- Working: `../03_game_engine/` output (`createGame`, `submitGuess`, `scoreGuess`) and `../02_word_source/` output (`resolveWord`, `isValidGuess`)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §1 (colored letters, not `Raster`), §5 (input method), §4.2 (warning indicator for fallback words)

Do NOT load: §2 (turn hooks / auto-open) or §6 (stats) — this stage
draws one game's state; it doesn't decide when the pane opens or update
streaks. Those are stages `05` and `06`.

## Platform constraints this stage works around
- A plugin has **one** hooks module (`hooks.json` `modules` takes one entry), and the engine's `$` is followed only into functions declared in that same file — never across an import. So everything that touches `$` lives in `hooks/register.js`; `hooks/lib/*` stays pure and takes closures (the `io` pattern from stage `02`).
- A `Button` `hotkey` is one digit or one lowercase letter — never the Backspace key. So the physical Backspace is handled by an `Input` field (below), and the on-screen Enter/Backspace buttons keep fallback hotkeys **`1`** and **`2`** (all 26 letters belong to the letter keys).

## Process
1. Write `hooks/lib/board-view.js` exporting `renderBoard({ h, Box, Text, Button }, { game, draft, puzzle }, on)` — a **pure** function returning the pane tree (no `$`). `on` is `{ letter(ch), enter(), backspace(), input(text), fallbackInfo() }`. It draws:
   - **Board**: six rows of five letters. A scored letter is bold, **colored and underlined** by result: green → theme key `success`, yellow → `warning`, gray → `inactive`. Typed-but-unsubmitted letters are bold and plain; empty cells are a dim `·`. No emoji tiles — color plus underline carries the meaning, and the underline keeps an absent (gray) letter distinct from an unplayed one.
   - **Keyboard**: three QWERTY rows of `Button`s, one per letter (`hotkey` = the letter), with Enter (`hotkey` `1`, primary) and Backspace `⌫` (`hotkey` `2`) on the bottom row. Letters ruled out by a gray result are `dimColor`.
   - **Legend**: a small block placed in the same row as the keyboard, to its right and bottom-aligned (`Box` row, `alignItems: 'flex-end'`), one line per color — a sample letter styled like a board letter, then its meaning: green "right letter, right place", yellow "right letter, wrong place", gray "letter not in the word".
   - **Typing field**: while the game is in play, an auto-focused `Input` (`Guess:`) whose `value` is `draft`. It edits the draft natively, so physical **Backspace deletes the last typed character**, **Enter submits**, and letters type in; `onInput` reduces the text to lowercase letters, max five. The on-screen keys and hotkeys feed the same `draft`, so there is still one guess-entry path.
   - **Fallback warning**: if `puzzle.source === 'fallback'`, a small `⚠ offline puzzle` `Button` whose `on.fallbackInfo` shows the explanation toast.
   - A status line (guess n/6, solved, or the revealed word) and a "Loading…" placeholder while `game` is null.
2. In `hooks/register.js` (the one hooks module) add:
   - `$.state` atoms `game`, `draft`, `puzzle`, declared in `types/index.d.ts`.
   - A `ui.render` hook on `{ component: 'Pane' }` filtered to `e.requestId === 'wordle'`, passing `renderBoard` the resolved `Box`/`Text`/`Button`, the atom values, and handlers. Writing an atom redraws the pane — no manual `$.ui.invalidate`.
   - A render hook never writes state, so the first draw schedules the day's puzzle load with `$.clock.after(0, …)`, which resolves the word via `resolveWord` and writes the atoms.
   - Handlers: `letter` appends to `draft`; `backspace` trims it; `input` sets it from the typing field; `enter` checks `isValidGuess`, calls `submitGuess` (passing a sync predicate — the engine does no I/O), clears `draft`, and toasts "Not enough letters" / "Not in word list" / the win-or-loss line. A rejected word stays in `draft` until backspaced.
   - Nothing is persisted yet; saving boards (`board:<date>`) is stage `06`.
3. Confirm the same tree renders on `e.surface === 'terminal'` and `'desktop'` — no `Raster`, no surface-specific branch (plain `Box`/`Text`/`Button` only). `hooks/__tests__/board.test.ts` mounts the pane on both surfaces and plays a game through the on-screen keys.

## Outputs
- `hooks/lib/board-view.js`
- Changes to `hooks/register.js` (state, handlers, render hook; the stage `01` placeholder render is gone), `types/index.d.ts` (state keys), and `hooks/__tests__/board.test.ts`

## Human check
Run `claude --plugin-dir .`, open `/wordle`, and play one full game
(win or lose) using only mouse clicks on the on-screen keyboard — confirm
each scored letter's color and underline match the legend after every
guess, and the legend sits at the bottom right beside the keyboard.
Repeat in the Desktop app's Code tab. Then, with the pane focused, play a
guess with the physical keyboard (type letters, Backspace to delete the
last one, Enter to submit) and confirm it behaves identically; also check
that the on-screen keys still add to what you typed. If the active word is a fallback word,
confirm the warning marker appears and pressing it shows the explanation.

# 09_compact_layout — the Claude night pane, in about 12 rows

One job: rebuild the pane's LAYOUT to match panel 1 ("Filled chips") of
`docs/ui-ref/wordle-compact-options.png` — about 12 rows tall, side by side at
78 columns. Stage `08` got the colors and style right but is 38 rows tall
side by side and 63 stacked (so a ~78-column pane always stacked). Palette,
engine, word source, stats, archive, lifecycle and the win celebration
(`fireworks.js`) are untouched.

## Inputs
- Working: stage `08`'s `hooks/lib/board-view.js`, `hooks/lib/arcade.js`, `hooks/register.js`
- Reference: `../../../docs/ui-ref/wordle-compact-options.png` (panel 1 only; panels 2 and 3 are the rejected alternatives), `../08_ui_redesign/CONTEXT.md` for the platform findings that still hold

Do NOT load: `game-engine.js`, `word-source.js`, `stats.js`, `archive.js`, `fireworks.js`, `lifecycle.js` for editing.

## Platform findings that shape this layout (carried from stage 08, plus one new)
- A Button's label can't be colored, so a key is a 3×1 `Box` with a background
  fill holding a plain Button. A found letter therefore keeps the default text
  color on its green or amber chip (the reference shows a dark letter); only
  the chip carries the state.
- A plain Button with a hotkey draws `1: label`, and the prefix can't be an
  icon. The digit hotkeys `1` / `2` were therefore dropped: the hint line shows
  `⏎ ENTER` and `⌫ DELETE`, and the ⏎ and ⌫ chips are ordinary clickable Buttons.
- Physical Backspace can't be a hotkey, so the one-line `TYPE` field stays.
  The reference has no field; it takes the blank row between the status row
  and the keyboard, so the height is unchanged.
- **New:** the Pane's size is under `e.props` in this build (`bodyColumns`,
  `scroll.bodyRows`), not on `e`.

## Process
1. `hooks/lib/arcade.js`: drop the block-letter font and `blockTitle` (the
   title is now a badge); add the faint divider color; `keyLook` returns a
   chip fill instead of a border.
2. `hooks/lib/board-view.js`: replace `renderBoard`'s layout with one compact
   layout (no density tiers): a one-line header (WORDLE badge, practice
   line, ⚠ OFFLINE, 1UP / HI / STAGE), one `round` frame with the board
   (3×1 tiles, 6 rows, no blank rows) and the controls separated by a faint
   vertical line, and a hint line under it carrying `▾ MORE`, `▶ TODAY` and
   `DATE…`. Side by side from 75 columns; narrower, the controls stack under
   the board. `▾ MORE` and `DATE…` open one extra row each under the hint line.
3. `hooks/register.js`: stop passing `layout.rows`.
4. Update `hooks/__tests__/board.test.ts` and `arcade.test.ts` to the new
   structure, and add a height test (the pane is 12 rows at 78 columns).
5. Update `README.md`, add a "Stage 09" list to `VERIFY.md`, and note in
   `plan/stages/08_ui_redesign/CONTEXT.md` that the layout is superseded.

## Outputs
- `hooks/lib/arcade.js`, `hooks/lib/board-view.js`, `hooks/register.js`
- `hooks/__tests__/board.test.ts`, `hooks/__tests__/arcade.test.ts`
- `README.md`, `VERIFY.md`

## Human check
Run `claude --plugin-dir .`, open `/wordle` in a pane about 78 columns wide
and compare it with panel 1 of `docs/ui-ref/wordle-compact-options.png`: the
pane is about 12 rows and side by side. Play a game (type, click the chips,
the `⏎ ENTER` / `⌫ DELETE` hint buttons), step days with `◀ ▶`, open `▾ MORE` and `DATE…`, win once and
confirm the celebration hands back to the compact board. Repeat in the
Desktop app's Code tab and at about 60 columns (the controls stack). The full
list is in `VERIFY.md` under "Stage 09".

## Addendum: width tiers and height-aware stacking (experiment)
Ported from the `width-experiment` prototype, then extended by height. All in
`hooks/lib/board-view.js` (pure) with the mode kept in `register.js`:
- `boardMetrics(columns, isStacked)`: side by side at the widest tier that fits
  (75 / 85 / 99 columns: 3- or 5-column tiles and chips), centred; the compact
  tier is `min(columns, COMPACT_WIDTH)` (78) wide, its controls taking the extra;
  stacked, the full body width with the widest cells that fit. Side by side the
  footer never wraps (its right margin shrinks), so compact is always 12 rows.
- No size request on open (a fixed `columns` narrowed wide docks; `rows` caps
  the inline room so it can't grow). A dock narrower than 75 is asked once,
  from its first draw, for 78 columns.
- `isStackedLayout(columns, bodyRows, wasStacked, openRows)`: the pane always
  opens compact (`openRows`, the body rows at its first draw, recorded in state
  and reset by each open). It stacks only once the room has grown:
  `bodyRows >= max(stackAt(columns), openRows + 1)`; once stacked, it stays
  until `STACK_GAP` (2) rows below that. Too narrow for side by side is always
  stacked, and that stacking doesn't count toward the gap.
- `stackAt(columns) = stackedRows(columns) + 2`, where `stackedRows` adds the
  parts the tree draws (header, frame borders, board, controls, footer) and lets
  the header and footer take a second row when their widest content (a practice
  stage, `▶ TODAY`, `▴ DATE…`) doesn't fit: 20 rows at 75–84 columns (STACK_AT
  22), 19 from 85 (STACK_AT 21). Checked live: 19 and 20 rows on screen.
- A draw can't write `$.state`, so the render hook draws the mode it computes
  and records it in the `isStacked` atom with `$.clock.after(0)`; the next draw
  reads it back for the gap. Session state, never the store.
- A short pane: inline the room is about a third of the terminal (8 rows at 30,
  11 at 40), so side by side the layout fits `bodyRows` with `compactFit`: 12,
  then 11 (no blank rows around the board), 10 (no gap above stats), 9 (no
  header), 8 (header, no frame border), 7 (neither). The footer bar is always
  drawn. A 24-row terminal gives 6 rows, less than the board: it scrolls.

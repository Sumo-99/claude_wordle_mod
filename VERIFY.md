# Human verification checklist

The repo rule (`CLAUDE.md`): a stage isn't done until a person has run its
human check. This file tracks what's been checked and what's still open.
Tick a box when you've seen it pass; add a note under anything that fails.

*Status note: everything not listed as an issue after your first pass was closed on your say-so. Still open: the stats panel items (Stage 06) and the Backspace/Enter focus-fix re-checks below.*

*Stage 08 note: the pane was redrawn (arcade "Claude night" look). Older items below still describe the behavior to check, but some name controls that have changed: **Guess:** is now **TYPE:**, the **Day:** list is now **◀ ▶** / **▶ TODAY** / **DATE…**, the separate stats window is now **▾ MORE** under the STREAK row, **Del** is now **⌫**, letter keys have no hotkey of their own, and status lines read `GUESS 2 OF 6`, `SOLVED IN 2/6`, `THE WORD WAS …`. The legend is gone. The new checks are in "Stage 08" at the end.*

Setup for every check:

```bash
claude --plugin-dir .      # from the repo root
claude plugin validate .   # should print "Validation passed"
claude plugin test .       # automated suite; should be all green
```

## Stage 01 — scaffold
- [x] `/wordle` opens a pane; Esc closes it. *(The placeholder text from stage 01 was replaced by the real board in stage 04, so you'll see the board instead.)*
- [x] `claude plugin validate .` reports no errors (only the harmless `CLAUDE.md` warning).

## Stage 02 — word source
- [x] Demo script showed `prove` / `mural` live, a `fallback` word on forced failure, and no second fetch for a cached date. *(Reviewed from the script output.)*
- [x] Optional end-to-end: go offline, open `/wordle`, confirm the **⚠ offline puzzle** marker appears and pressing it toasts "Couldn't reach the live word — showing an offline puzzle instead."

## Stage 03 — game engine
- [x] Scoring table reviewed (`alloy`/`atoll`, `speed`/`abide`, `eerie`/`where`, `robot`/`floor`, `level`/`hello`).
- [x] Cross-check at least two of those against the NYT site or a published scoring explainer.
- [x] A game reaches "lost" only after the 6th wrong guess, never earlier (play it in the pane).

## Stage 04 — interface
- [x] Played a game with mouse clicks only, terminal; letters colored + underlined; legend at the bottom right; physical Backspace deletes the last letter.
- [x] Same in the **Desktop app's Code tab**.
- [x] Focus: after clicking an on-screen key you can keep typing without clicking the Guess field again. *(Confirmed.)*
- [x] Repeated letters work (e.g. `LLAMA`, `MOCHA`-style double letters are allowed, as in real Wordle). *(The old wording of this item meant something else: that ONE physical keypress should never type TWO letters. It doesn't.)*
- [x] Colors: green, yellow and gray are distinguishable in your theme (gray = the theme's `inactive`).
- [x] An invalid word shows "Not in word list" and stays in the field until backspaced; a short word shows "Not enough letters".

## Keyboard focus fix (Backspace / Enter after clicking an on-screen key)
What you found: clicking the on-screen **⌫** key didn't remove the last letter (only the **2** hotkey did), the physical Backspace did nothing after clicking a key, and the physical Enter key sometimes pressed Backspace instead of submitting. Cause: clicking a key leaves the focus ring on that **button**, so Enter re-pressed it. Fix: every on-screen key press now hands the keyboard back to the Guess field, and the delete key's label is plain text (**Del**, not ⌫, in case the wide glyph was eating the click).
- [ ] Click a few letters, then click **Del**: the last letter is removed.
- [ ] Click a few letters, then press the physical **Backspace**: the last letter is removed.
- [ ] Click **Del** (or any key), then press the physical **Enter** with a full valid word in the field: the word is **submitted** (Enter does what the on-screen Enter / the `1` hotkey does), it never deletes a letter.
- [ ] Type with the physical keyboard only, no clicks: letters, Backspace and Enter all work.
- [ ] Mixed: type `MOC`, click `H` and `A`, press physical Enter: submits MOCHA. (Re-check the 5 Oct MOCHA case on a practice date.)
- [ ] The on-screen Enter and the `1`/`2` hotkeys still work.
- [ ] The hint under the board now reads "type a word, Backspace to delete, Enter to guess".
If Del-by-click still fails, or Enter still deletes sometimes, tell me which surface (terminal / Desktop) and exactly what you pressed in what order. (The automated tests can't see focus moves, so this one is purely a live check.)

## Rejected guesses keep their letters
*Fix confirmed live by you for the two main cases; the other boxes below are still open.*
Real Wordle (checked against its original source code): a too-short word or a non-word shakes the row and shows a toast, **the typed letters stay**, and the guess doesn't count.
Cause of our bug, found from a live diagnostic log: pressing Enter empties the Guess field itself, and the field only takes the value we give it when that value *changes*. After a rejected guess ours didn't change, so the field stayed empty while the draft lived on unseen, and your next keystroke replaced it. Fix: after a rejected Enter, and when a typed letter is trimmed (a 6th letter, a non-letter), the field is redrawn empty for ~60 ms and then with the draft, so it takes it.
- [x] Type `MOCH` (4 letters), press Enter: toast "Not enough letters", and `MOCH` is **still in the Guess field** (and in the board row). Type `A`, press Enter: it submits `MOCHA`.
- [x] Type `QXZVJ` (a real non-word — note `MOCHS` IS in the official allowed-guess list, so it's accepted), press Enter: toast "Not in word list", the word **stays**. Press Backspace once: it becomes `QXZV`; edit and Enter.
- [ ] `Guess 1/6` is unchanged after a rejected guess (it cost nothing).
- [ ] Type 6+ letters quickly: the field never shows more than 5 letters.
- [ ] Same checks when the letters came from the on-screen keys, and when mixed with typing.
- [ ] A deliberate clear (select all + delete) still empties the field and the row.

## Reset history command (`/wordle config reset-history`)
Where the history lives: the plugin's `$.store` — `board:<date>` (each saved game), `word:<date>` (cached answers), `stats`, `config:autoOpen`. This command clears the first two.
- [ ] Play a guess or two, then run `/wordle config reset-history`: it reports how many saved games it would delete and tells you to add `confirm`; nothing is deleted yet (the board is unchanged).
- [ ] Run `/wordle config reset-history confirm`: it reports what it cleared; the open pane restarts on a fresh, empty board for today.
- [ ] Past days you'd played are blank again (pick one from the Day list), and a finished puzzle can be replayed.
- [ ] Your **stats** are untouched (open the Stats pane) and `/wordle config auto-open` still shows your setting.
- [ ] Run it again: "No saved games to clear."
- [ ] Anything but exactly `confirm` (e.g. `yes`) just prints the usage line.

## Win celebration (added after stage 07)
- [ ] Win a puzzle: red opens out **from the centre** to fill the whole pane (bright red middle, dark red edges, slowly turning rays), with 2–3 rings and a red/gold burst at the start. **WORDDDD...** pops in letter by letter (the extra Ds bounce), the screen gives a small shake, then **you solved it!** slides up with a pulsing glow. About **3 seconds**, then the finished board comes back (with "Solved in N/6").
- [ ] While it plays you see no board, keyboard, or Guess field. If the red doesn't fill the pane (a gap at the bottom or right) or isn't centred, tell me your terminal size and which surface.
- [ ] Win again (a practice date) and press `1` or click **continue** on the bottom row: the board comes back at once.
- [ ] `/wordle config reduce-motion on`, then win a practice date: no rings, sparks or shake, the red just fades in with the words. `/wordle config reduce-motion off` restores the full version.
- [ ] **The 5 Oct / MOCHA bug**: pick 2026-10-05 in the Day list, type MOCHA, press Enter. After the celebration the winning row shows all five letters M O C H A. If a letter is missing, tell me exactly when it disappears (before the celebration starts, during it, or after).
- [ ] The animation does not play on a loss, on a wrong guess, or when you reopen an already-finished board; it does play for a practice-day win.
- [ ] Looks right in both the terminal and the Desktop app and doesn't flicker or make the pane jump in size when it starts and ends.

## UX fixes (V1, V2, V3, V11 from the UX report)
- [x] **Keyboard colours (V1)**: after a guess, keys for green letters and yellow letters get a green / yellow background behind the key; gray letters fade. A letter found green stays green even if a later guess used it in the wrong spot. Check the background actually renders behind the key (terminal and Desktop app) and that green vs yellow is distinguishable in your theme. If the background doesn't show, tell me and I'll add a glyph marker instead.
- [x] **Offline word (V2)**: go offline, open `/wordle` (⚠ offline puzzle). Reconnect, close and reopen the pane (or pick another day and come back) *before guessing*: it now switches to the real word and the ⚠ marker disappears. If you had already made a guess on the offline word, that game keeps its offline word and the ⚠ stays, so your progress isn't lost.
- [x] **End of game (V3)**: after a win/loss the status line ends with "Pick another day below to keep playing", the on-screen keys all fade, and the Day list is right there.
- [x] **New day (V11)**: leave the pane open past midnight (or change your clock), then do anything in the pane: a yellow "A new day has started — <old date> is now practice…" line appears with a **▶ Play today's puzzle** button. Finishing the old puzzle does not change your stats. The button loads the new day's fresh puzzle and the warning goes away.

## Stage 05 — lifecycle integration
- [x] `/wordle config auto-open on`, then send Claude a prompt that takes a few seconds: the pane opens by itself while Claude generates and **stays open** after the response finishes.
- [x] `/wordle config auto-open off`, send another prompt: the pane does **not** open on its own.
- [x] `/wordle` typed manually opens the pane immediately in both cases.
- [x] `/wordle config auto-open` (no value) reports the current setting; `/wordle config auto-open maybe` prints the usage line.
- [x] Narrow terminal (< 144 columns) with auto-open on: the pane waits rather than opening (a platform rule, not a bug).

## Stage 06 — stats and archive
Both stages 05 and 06 are on branch `remote-build-stages-05-07`.
- [ ] The main pane has a **Stats** button in its header; pressing it opens a separate **Wordle stats** pane, and the button now reads **Hide stats** (press again to close). Closing the stats pane with ✕/Esc and pressing the button again reopens it.
- [ ] **Clear stats** sits at the stats pane's top right, dim until you hover/focus it. First press changes it to **Press again to clear** (and it disarms itself after ~5 s); a second press resets streak, max, played, win % and the bars to zero and toasts "Stats cleared." Your saved boards are kept (a finished puzzle stays finished).
- [ ] Finish today's puzzle (win or lose): the stats pane (`Streak · Max · Played · Win %` and the 1–6 bars) updates live.
- [ ] Pick a past day from the **Day:** list, play it to completion: a yellow "Practice puzzle" banner shows and the stats pane is **unchanged**.
- [x] Type an arbitrary date in **Or a date:** and press Enter: a past date starts that puzzle; a future date, a pre-2021-06-19 date, or garbage shows a toast and changes nothing.
- [x] Switch back to today (the `(today)` entry in the list): your earlier board is shown (finished or in progress), **not** a blank one.
- [ ] Close and reopen the pane, and restart Claude Code: stats and each date's saved board are still there.
- [x] Focus: typing letters still goes to the **Guess:** field, and the date field only takes keys once you click into it.
- [ ] Two panes: with both open, check each is usable (tab titles, sizing) in the terminal and the Desktop app, and that the stats pane doesn't steal the keyboard from the Guess field.
- [x] Layout: the main pane (board, keyboard, legend, archive picker) still reads well at your terminal height.

## Known open issues (not fixed yet — nothing to verify, just don't be surprised)
From `report.md` (the UX playthrough): V6 streak doesn't reset after a missed day (needs your rule decision); V4 no notice on open that the puzzle is offline besides the ⚠ button; V5 a typed date older than 14 days leaves the Day picker showing today; V7 rapid extra Enters toast "Not enough letters"; V8 a missing word-list file leaves "Loading…" forever; polish: V9 Clear-stats timer, V10 draft lost on date switch, V12 cryptic "Enter = 1" hint, V13 losses not shown in stats, V14 impossible-date error wording, V15 `/wordle` says "opened" when already open.

## Stage 07 — testing and polish
- [x] `claude plugin test .` is all green (29 tests at the time of writing) and `claude plugin validate .` passes.
- [x] From a clean `git clone` in another directory, following only `README.md` gets `/wordle` working. (Spot-check the README's claims too: the 1/2 hotkeys, the Stats button, the 14-day list, the 144-column note.)

## Stage 08 — UI redesign (arcade "Claude night")
Reference: `docs/ui-ref/wordle-ui-final.png` (keys: `docs/ui-ref/wordle-key-styles.png`, option 5). Look only: rules, word source, stats, archive and celebration are unchanged.

What the API allows, and what was decided (details in `plan/stages/08_ui_redesign/CONTEXT.md`):
- A Button's label can't be colored, so a key's state shows on its **double-line frame only**; the letter stays text-colored. The same goes for `◀ ▶`, `▶ TODAY` and `▾ MORE` (text-colored, not orange).
- A `plain` Button with a hotkey draws as `q: Q`, so **letter keys have no hotkey** (your choice); ⏎ and ⌫ keep `1` / `2` and are one column wider (`1: ⏎`).
- Physical Backspace can't be a hotkey, so the typing field stays: one line, **TYPE:**.
- Desktop draws Box as a div, Text as a span, Button as a **native button** even when plain; whether a `double` border paints as `║` glyphs there isn't documented. That's what the Desktop items below are for.

Terminal, about 100 columns (compare side by side with the reference):
- [ ] Header: `1UP` / `HI-SCORE` / `STAGE` labels in orange over white values (`00000`, `00000`, `08 OCT`).
- [ ] The block-letter **WORDLE** title, 4 rows, centered, orange.
- [ ] Two panels in orange double-line walls on a slightly lighter background than the pane: board on the left, controls on the right.
- [ ] Tiles: 5×3 pixel-rounded (`▗▄▄▄▖` / solid middle / `▝▀▀▀▘`). Green and amber tiles have dark letters; misses are dark with dim letters; the typing row is dark with white letters and an orange `▌` cursor in the next empty tile; rows ahead are `•` pellets, with `●` in the last row's corners.
- [ ] Keys: double-line frames, gray when untried, green/amber once found, ⏎ always orange; a known miss is a dim `·` in the key's place (no frame).
- [ ] Status row: `READY!` (amber) only before guess 1; `GUESS N OF 6`; `LIVES ◆ ◆ ◆ ◆ ◇ ◇` (◇ = guesses used). A rejected word costs no life.
- [ ] Orange divider, then `STREAK` (pink), `BEST` (blue), `WIN%` (amber) labels with white two-digit values.
- [ ] `STAGE ◀ 08 OCT` (no ▶ on today), `DATE…`; hint `TYPE TO PLAY · ESC TO EXIT` (dim).
- [ ] No legend, no `Guess 1/6 · …` line, no `Play another day` block, no `[ bracket ]` buttons anywhere.

Playing:
- [ ] Type a guess with the physical keyboard (letters, Backspace, Enter): it fills the active tile row as you type.
- [ ] Click letters, ⌫ and ⏎ on the on-screen keyboard; then keep typing without clicking the field.
- [ ] `1` and `2` press ⏎ / ⌫ when the focus is on the pane rather than in the field (Tab off the field first).
- [ ] An invalid word: "Not in word list", the letters stay. A short word: "Not enough letters".
- [ ] After a loss: `THE WORD WAS …` in amber, keys fade, hint becomes `◀ ▶ PICK ANOTHER STAGE · ESC TO EXIT`.

Stats, stages, dates:
- [ ] `▾ MORE` opens PLAYED/WON, the 1–6 bars and `CLEAR STATS` under the stats row; `▴ LESS` closes it. `CLEAR STATS` needs two presses (the first reads `PRESS AGAIN TO CLEAR` and disarms after ~5 s).
- [ ] `◀` steps one day back (`── PRACTICE STAGE ──` appears under the title, pink); `▶` steps forward; `◀` stops after 14 days; `▶ TODAY` jumps back and resumes today's board.
- [ ] `DATE…` opens a date field; a bad or future date toasts and the field stays open; a good one loads that day and closes the field.
- [ ] Win today: 1UP shows 100 × guesses left (e.g. `00400` for a 2-guess win) and HI-SCORE picks it up. Win a practice day: 1UP shows its score, HI-SCORE doesn't change.
- [ ] Offline (⚠ OFFLINE PUZZLE under the status row) and the new-day line (`── A NEW DAY HAS STARTED · … IS NOW PRACTICE ──`) still appear when they should.

Celebration:
- [ ] Win a puzzle: the red celebration plays as before, then hands back to the **new** board (`SOLVED IN N/6`, colored tiles).
- [ ] The red now fills the pane's width, and in an ordinary-height terminal (about 100×60) the **`1: continue`** row is visible on its bottom row, not cut off. Docked (fullscreen, 110+ columns) it also shows.

Sizes:
- [ ] ~100 columns in a tall pane (docked fullscreen ≥110 columns, or a very tall terminal): the full reference layout.
- [ ] ~100 columns, ordinary height: the blank rows between tile rows go first, then tiles flatten to one row and the title/header to one line; nothing overlaps.
- [ ] ~60 columns: plain **WORDLE**, controls panel under the board, header on one line; nothing overlaps or wraps mid-word.

Desktop app (Code tab), same pane:
- [ ] Double-line walls and key frames: do they draw as `║ ═` glyphs, a CSS double border, or not at all? Are the frame colors right?
- [ ] Panel and pane background colors show.
- [ ] Half-block title and tiles join up (no gaps between rows of `▀▄`).
- [ ] Keys are native buttons inside the frames: note how they look and whether clicks still land.
- [ ] Anything that renders differently from the terminal: note it here.

# Human verification checklist

The repo rule (`CLAUDE.md`): a stage isn't done until a person has run its
human check. This file tracks what's been checked and what's still open.
Tick a box when you've seen it pass; add a note under anything that fails.

*Status note: everything not listed as an issue after your first pass was closed on your say-so. Still open: the stats panel items (Stage 06) and the Backspace/Enter focus-fix re-checks below.*

*Stage 08 note: the pane was redrawn (arcade "Claude night" look). Older items below still describe the behavior to check, but some name controls that have changed: **Guess:** is now **TYPE:**, the **Day:** list is now **◀ ▶** / **▶ TODAY** / **DATE…**, the separate stats window is now **▾ MORE** under the STREAK row, **Del** is now **⌫**, letter keys have no hotkey of their own, and status lines read `GUESS 2 OF 6`, `SOLVED IN 2/6`, `THE WORD WAS …`. The legend is gone. The new checks are in "Stage 08" at the end. Stage 09 then made the layout compact (about 12 rows); where the two differ, **Stage 09** wins (e.g. `HI-SCORE` is now `HI`, the offline marker is `⚠ OFFLINE` in the header, `⏎ ENTER` / `⌫ DELETE` replace the digit hotkeys on the hint line, and the block-letter title is a badge).*

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
- [ ] ~~Win again and press `1` to skip~~ (stage 10 removed the skip: the celebration always plays to the end).
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
- [ ] The red now fills the pane's width, and in an ordinary-height terminal (about 100×60) the **`1: continue`** row is visible on its bottom row, not cut off. Docked (fullscreen, 110+ columns) it also shows. (Stage 10 removed that row: the celebration has no skip now.)

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

## Stage 09 — compact layout (panel 1 "Filled chips")
Reference: panel 1 of `docs/ui-ref/wordle-compact-options.png`. Same palette and behavior as stage 08; only the layout changed.

What the API allows, and what was decided (details in `plan/stages/09_compact_layout/CONTEXT.md`):
- A Button's label can't be colored, so a key chip's state shows on its **fill only**; a found letter keeps the default text color on its green/amber chip (the reference shows a dark letter).
- A plain Button with a hotkey draws `1: label`, which can't be replaced by an icon, so the digit hotkeys `1` / `2` were dropped: the hint line shows `⏎ ENTER` / `⌫ DELETE` and the ⏎ / ⌫ chips are plain clickable keys.
- The `TYPE:` field stays (physical Backspace can't be a hotkey). It sits where the reference has a blank row, so the pane is no taller for it.

Terminal, pane about 78 columns (compare with panel 1):
- [ ] The pane is about **12 rows**: one header row, a rounded frame, one hint row. No blank rows between tile rows.
- [ ] Header: the orange **WORDLE** badge (dark spaced letters) with `▐ ▌` caps; `PRACTICE STAGE` (pink) only on practice days; right side `1UP 00000   HI 00000   STAGE 08 OCT` (orange labels, white values).
- [ ] The frame is thin and rounded, orange, with a faint vertical line between board and controls.
- [ ] Board: 3×1 tiles (` C `), 6 rows, a gap of one column. Green/amber tiles have dark letters, misses dark with a dim letter, the typing row white letters with an orange `▌` cursor, pellets (`•`, `●` in the last row's corners) ahead.
- [ ] Controls: `READY! GUESS 1 OF 6 LIVES ◆ ◆ ◆ ◆ ◆ ◆`, the `TYPE:` field, three rows of key chips (⏎ is orange), then `STREAK 00  BEST 00  WIN% 00  STAGE ◀ 08 OCT`.
- [ ] Chips turn green/amber as letters are found; a known miss is a dim `·` in the key's place.
- [ ] Hint line: `TYPE TO PLAY · ⏎ ENTER · ⌫ DELETE · ESC TO EXIT` on the left (the two are clickable); `DATE…   ▾ MORE` on the right, a few columns in from the edge (with `▶ TODAY` first on a practice day). There are no digit hotkeys.
- [ ] `▾ MORE` opens a big rounded **STATS** container under the hint line (`PLAYED n · WON n`, `CLEAR STATS`, 1–6 bars; `CLEAR STATS` needs two presses); `DATE…` opens a **PICK A STAGE** container with a **Last 14 days** list (pick one to play it; the container then closes) and an **Or a date** field. The compact frame above does not move or change; you scroll down to the container. Only one container is open at a time: opening one closes the other, and `▴ LESS` / `▴ DATE…` close it.
- [ ] `◀ ▶` step through 14 days; `▶ TODAY` jumps back.
- [ ] Game over: `SOLVED IN N/6` (green) or `THE WORD WAS …` (amber) replaces the guess count, the field's row goes blank, the hint becomes `◀ ▶ PICK ANOTHER STAGE · ESC TO EXIT`.
- [ ] Win: the celebration plays, then hands back to the compact board.
- [ ] About 60 columns: the controls stack under the board (about 20 rows) and nothing overlaps.

Playing (as in stage 08): typing, Backspace, Enter, clicking chips and the `⏎ ENTER` / `⌫ DELETE` hint buttons, rejected words keeping their letters. (The `1` / `2` hotkeys are gone; the win screen's `1` to skip is unchanged.)

Desktop app (Code tab), same pane:
- [ ] The `round` frame, the vertical divider and the filled chips draw correctly (a native button sits inside each chip: note how it looks and that clicks land).
- [ ] The 12-row height holds; note any difference from the terminal.

## Stage 10 — Pick a game screen and replay flow
Reference: `docs/ui-ref/wordle-picker.png`. Same frame, header and palette as stage 09; gameplay, stats and the celebration are unchanged. Contract: `plan/stages/10_game_picker/CONTEXT.md`.

What was decided: the countdown redraws **every second** (the pane is a dozen rows, so that is cheap), from a timer that runs only while the picker is the screen. A plain Button's label can't be colored, so `1: play` / `2: play` keep the default text color on the card fills (the reference shows dark text on the orange).

Setup: a fresh store, or `/wordle config reset-history confirm` (it clears saved boards, cached words and the played-today set).

- [ ] **Today's win**: with today unfinished the pane opens on the game. Win it and don't touch anything. The whole celebration plays: there is no `1: continue` on it, and pressing `1` doesn't cut it short. When it ends, the picker opens by itself, with header `TODAY SOLVED N/6` and `1UP` showing the score. Press `1` right away: a random game starts (the keyboard is on RANDOM GAME, not Claude's prompt).
- [ ] **Today's loss** (reset history first): six wrong guesses show `THE WORD WAS …` and CONTINUE, no celebration. About 3 seconds later the picker opens by itself (or sooner with CONTINUE). The picker header reads `TODAY LOST · WORD` in amber. Close and reopen `/wordle`: it opens the picker, not the board.
- [ ] **Layout** (compare with the reference): about 12 rows at 78 columns; two cards side by side (orange RANDOM GAME with `⚄`, dark PICK A DATE with a date dropdown), pixel-rounded corners (`▗▄▄▖` / `▝▀▀▘`); `STREAK / BEST / WIN%` left, `NEXT DAILY IN HH:MM:SS` right in amber, ticking each second. At about 60 columns the cards stack.
- [ ] **Three random games in a row**: press RANDOM GAME (or `1`), finish it (win or lose), and let the picker come back by itself. Repeat three times. The three dates differ, none is today, and the `N left` count drops by one each time.
- [ ] **Date dropdown**: after those games, the dropdown on PICK A DATE starts on yesterday (or the newest date not played) and lists the 14 newest dates you haven't finished today, newest first. Dates you finished today never appear, and the caption reads `played today are left out`. Picking a date only selects it; `2` (or clicking play) plays it. Older dates are behind `DATE…`.
- [ ] **A rejected typed date**: `DATE…`, then try today's date, a date next week, `2021-06-18`, and a date you finished today. Each shows its own one-line message, the field stays open, and no game starts. A valid date plays and closes the field.
- [ ] **Leave a game halfway and resume it**: start a random game, make one guess, then leave it (`▶ TODAY` on its footer, then CONTINUE). Its date is still unplayed: it can come up from RANDOM or the dropdown, and opening it shows your guess.
- [ ] **Replay**: pick a date you finished on an earlier day (or one finished before today): it starts a fresh empty board.
- [ ] **↺ TODAY'S BOARD** on the picker reopens today's finished board, read-only (no typing field), with `⏎ CONTINUE` back to the picker.
- [ ] **Stats**: after the practice games above, `STREAK / BEST / WIN%` are unchanged (only today's daily counts).
- [ ] **Offline**: with the network off, a random or picked date opens an `⚠ OFFLINE` puzzle on the game screen's header.
- [ ] **Day rollover** (fake the clock: set the system clock to 23:59:50 on the day you played, or run the pane with a test clock): the countdown reaches 00:00:00, the header turns to `TODAY NOT FINISHED`, the `N left` count returns to the whole pool, and the played-today set is empty (`played-today` in the store shows the new day).
- [ ] **Every game played**: (hard to reach by hand; the automated test covers it) RANDOM GAME says *You've played every game today!* and the count is whole again.
- [ ] Desktop app (Code tab): the card blocks, the fills and `1: play` / `2: play` draw correctly; note any difference from the terminal.

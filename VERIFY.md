# Human verification checklist

The repo rule (`CLAUDE.md`): a stage isn't done until a person has run its
human check. This file tracks what's been checked and what's still open.
Tick a box when you've seen it pass; add a note under anything that fails.

Setup for every check:

```bash
claude --plugin-dir .      # from the repo root
claude plugin validate .   # should print "Validation passed"
claude plugin test .       # automated suite; should be all green
```

## Stage 01 — scaffold
- [ ] `/wordle` opens a pane; Esc closes it. *(The placeholder text from stage 01 was replaced by the real board in stage 04, so you'll see the board instead.)*
- [ ] `claude plugin validate .` reports no errors (only the harmless `CLAUDE.md` warning).

## Stage 02 — word source
- [x] Demo script showed `prove` / `mural` live, a `fallback` word on forced failure, and no second fetch for a cached date. *(Reviewed from the script output.)*
- [ ] Optional end-to-end: go offline, open `/wordle`, confirm the **⚠ offline puzzle** marker appears and pressing it toasts "Couldn't reach the live word — showing an offline puzzle instead."

## Stage 03 — game engine
- [x] Scoring table reviewed (`alloy`/`atoll`, `speed`/`abide`, `eerie`/`where`, `robot`/`floor`, `level`/`hello`).
- [ ] Cross-check at least two of those against the NYT site or a published scoring explainer.
- [ ] A game reaches "lost" only after the 6th wrong guess, never earlier (play it in the pane).

## Stage 04 — interface
- [x] Played a game with mouse clicks only, terminal; letters colored + underlined; legend at the bottom right; physical Backspace deletes the last letter.
- [ ] Same in the **Desktop app's Code tab**.
- [ ] Typing with the physical keyboard (letters, Backspace, Enter) behaves the same as clicking.
- [ ] Focus: after clicking an on-screen key, can you keep typing, or must you click back into the "Guess:" field? Note which.
- [ ] No double letters: one keypress never types a letter twice.
- [ ] Colors: green, yellow and gray are distinguishable in your theme (gray = the theme's `inactive`).
- [ ] An invalid word shows "Not in word list" and stays in the field until backspaced; a short word shows "Not enough letters".

## Win fireworks (added after stage 07)
- [ ] Win a puzzle: the whole game pane goes **gray and blank**, fireworks burst in the centre with a rainbow **H O O R A Y !**, it lasts about **3 seconds**, then the finished board comes back (with "Solved in N/6").
- [ ] While it plays you see no board, keyboard, or Guess field — nothing is clipped, covered or cut off. If the gray doesn't fill the pane (a gap at the bottom or right), or the fireworks aren't centred, tell me your terminal size and which surface.
- [ ] Gray backdrop is readable: spark colours stand out against it in your theme (light and dark).
- [ ] **The 5 Oct / MOCHA bug**: pick 2026-10-05 in the Day list, type MOCHA, press Enter. After the celebration the winning row shows all five letters M O C H A. If a letter is missing, tell me exactly when it disappears (before the celebration starts, during it, or after).
- [ ] The animation does not play on a loss, on a wrong guess, or when you reopen an already-finished board; it does play for a practice-day win.
- [ ] Looks right in both the terminal and the Desktop app and doesn't flicker or make the pane jump in size when it starts and ends.

## UX fixes (V1, V2, V3, V11 from the UX report)
- [ ] **Keyboard colours (V1)**: after a guess, keys for green letters and yellow letters get a green / yellow background behind the key; gray letters fade. A letter found green stays green even if a later guess used it in the wrong spot. Check the background actually renders behind the key (terminal and Desktop app) and that green vs yellow is distinguishable in your theme. If the background doesn't show, tell me and I'll add a glyph marker instead.
- [ ] **Offline word (V2)**: go offline, open `/wordle` (⚠ offline puzzle). Reconnect, close and reopen the pane (or pick another day and come back) *before guessing*: it now switches to the real word and the ⚠ marker disappears. If you had already made a guess on the offline word, that game keeps its offline word and the ⚠ stays, so your progress isn't lost.
- [ ] **End of game (V3)**: after a win/loss the status line ends with "Pick another day below to keep playing", the on-screen keys all fade, and the Day list is right there.
- [ ] **New day (V11)**: leave the pane open past midnight (or change your clock), then do anything in the pane: a yellow "A new day has started — <old date> is now practice…" line appears with a **▶ Play today's puzzle** button. Finishing the old puzzle does not change your stats. The button loads the new day's fresh puzzle and the warning goes away.

## Stage 05 — lifecycle integration
- [ ] `/wordle config auto-open on`, then send Claude a prompt that takes a few seconds: the pane opens by itself while Claude generates and **stays open** after the response finishes.
- [ ] `/wordle config auto-open off`, send another prompt: the pane does **not** open on its own.
- [ ] `/wordle` typed manually opens the pane immediately in both cases.
- [ ] `/wordle config auto-open` (no value) reports the current setting; `/wordle config auto-open maybe` prints the usage line.
- [ ] Narrow terminal (< 144 columns) with auto-open on: the pane waits rather than opening (a platform rule, not a bug).

## Stage 06 — stats and archive
Both stages 05 and 06 are on branch `remote-build-stages-05-07`.
- [ ] The main pane has a **Stats** button in its header; pressing it opens a separate **Wordle stats** pane, and the button now reads **Hide stats** (press again to close). Closing the stats pane with ✕/Esc and pressing the button again reopens it.
- [ ] **Clear stats** sits at the stats pane's top right, dim until you hover/focus it. First press changes it to **Press again to clear** (and it disarms itself after ~5 s); a second press resets streak, max, played, win % and the bars to zero and toasts "Stats cleared." Your saved boards are kept (a finished puzzle stays finished).
- [ ] Finish today's puzzle (win or lose): the stats pane (`Streak · Max · Played · Win %` and the 1–6 bars) updates live.
- [ ] Pick a past day from the **Day:** list, play it to completion: a yellow "Practice puzzle" banner shows and the stats pane is **unchanged**.
- [ ] Type an arbitrary date in **Or a date:** and press Enter: a past date starts that puzzle; a future date, a pre-2021-06-19 date, or garbage shows a toast and changes nothing.
- [ ] Switch back to today (the `(today)` entry in the list): your earlier board is shown (finished or in progress), **not** a blank one.
- [ ] Close and reopen the pane, and restart Claude Code: stats and each date's saved board are still there.
- [ ] Focus: typing letters still goes to the **Guess:** field, and the date field only takes keys once you click into it.
- [ ] Two panes: with both open, check each is usable (tab titles, sizing) in the terminal and the Desktop app, and that the stats pane doesn't steal the keyboard from the Guess field.
- [ ] Layout: the main pane (board, keyboard, legend, archive picker) still reads well at your terminal height.

## Known open issues (not fixed yet — nothing to verify, just don't be surprised)
From `report.md` (the UX playthrough): V6 streak doesn't reset after a missed day (needs your rule decision); V4 no notice on open that the puzzle is offline besides the ⚠ button; V5 a typed date older than 14 days leaves the Day picker showing today; V7 rapid extra Enters toast "Not enough letters"; V8 a missing word-list file leaves "Loading…" forever; polish: V9 Clear-stats timer, V10 draft lost on date switch, V12 cryptic "Enter = 1" hint, V13 losses not shown in stats, V14 impossible-date error wording, V15 `/wordle` says "opened" when already open.

## Stage 07 — testing and polish
- [ ] `claude plugin test .` is all green (29 tests at the time of writing) and `claude plugin validate .` passes.
- [ ] From a clean `git clone` in another directory, following only `README.md` gets `/wordle` working. (Spot-check the README's claims too: the 1/2 hotkeys, the Stats button, the 14-day list, the 144-column note.)

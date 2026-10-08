# Human verification checklist

The repo rule (`CLAUDE.md`): a stage isn't done until a person has run its
human check. This file tracks what's been checked and what's still open.
Tick a box when you've seen it pass; add a note under anything that fails.

*Status note: everything not listed as an issue after your first pass was closed on your say-so. Still open: the stats panel items (Stage 06) and the Backspace/Enter focus-fix re-checks below.*

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

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

## Stage 05 — lifecycle integration (branch `stage-05-lifecycle-integration`)
- [ ] `/wordle config auto-open on`, then send Claude a prompt that takes a few seconds: the pane opens by itself while Claude generates and **stays open** after the response finishes.
- [ ] `/wordle config auto-open off`, send another prompt: the pane does **not** open on its own.
- [ ] `/wordle` typed manually opens the pane immediately in both cases.
- [ ] `/wordle config auto-open` (no value) reports the current setting; `/wordle config auto-open maybe` prints the usage line.
- [ ] Narrow terminal (< 144 columns) with auto-open on: the pane waits rather than opening (a platform rule, not a bug).

## Stage 06 — stats and archive
Branch `stage-06-stats-and-archive`.
- [ ] Finish today's puzzle (win or lose): the readout (`Streak · Max · Played · Win %` and the 1–6 bars) updates.
- [ ] Pick a past day from the **Day:** list, play it to completion: a yellow "Practice puzzle" banner shows and the stats readout is **unchanged**.
- [ ] Type an arbitrary date in **Or a date:** and press Enter: a past date starts that puzzle; a future date, a pre-2021-06-19 date, or garbage shows a toast and changes nothing.
- [ ] Switch back to today (the `(today)` entry in the list): your earlier board is shown (finished or in progress), **not** a blank one.
- [ ] Close and reopen the pane, and restart Claude Code: stats and each date's saved board are still there.
- [ ] Focus: typing letters still goes to the **Guess:** field, and the date field only takes keys once you click into it.
- [ ] Layout: the pane still reads well at your terminal height (it now holds board, keyboard, legend, stats and the archive picker). If it's cramped, tell me and I'll move the archive/stats behind a toggle.

## Stage 07 — testing and polish
- [ ] Full test suite green.
- [ ] From a clean `git clone` in another directory, following only `README.md` gets `/wordle` working.

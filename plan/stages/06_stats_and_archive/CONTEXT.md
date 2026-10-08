# 06_stats_and_archive — streaks and past puzzles

One job: track stats for the live daily puzzle only, and let the user
replay any past date for practice without touching those stats. Both
features lean on `02_word_source` already being date-parameterized —
neither needs new fetch logic, only new UI and a stats store.

## Inputs
- Working: `../02_word_source/` output (`resolveWord(io, dateStr)` — already takes any date), `../03_game_engine/` output, `../04_interface/` output (the pane to extend: `renderBoard` in `board-view.js`, and the `game`/`draft`/`puzzle` atoms and handlers in `register.js`)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §4.3 (archive), §6 (stats), §7 (`stats` and `board:<date>` store keys)

Do NOT load: §2/§5 — the trigger model and input method are already
built; this stage only adds what happens *after* a game completes, and
one new picker control.

## Process
1. Write `hooks/lib/stats.js` exporting `recordCompletion(io, { won, guessCount })` (`io` as in stage `02`: `$` can't cross an import, so `register.js` passes `io.store`) which reads `io.store.get('stats')` (defaulting to `{ currentStreak: 0, maxStreak: 0, wins: 0, played: 0, distribution: [0,0,0,0,0,0] }`), updates it (streak resets to 0 on a loss, increments and maxes on a win, `distribution[guessCount - 1]++` on a win), and writes it back.
2. In the `enter` handler in `register.js` (from stage `04`), call `recordCompletion` **only when the active date is today's date** — an archived-date game reaching `'won'`/`'lost'` must skip this call entirely.
3. Stage `04` holds a single game in the `game`/`draft`/`puzzle` atoms, always for today. Generalize it so the active date can change: persist each date's game under `board:<date>` and load it when that date becomes active. Then add an archive picker to the pane: a `Select` (or a short list of `Button`s) of the last ~14 days, plus a free-text `Input` for an arbitrary `YYYY-MM-DD`. Stage `04`'s guess `Input` is `autoFocus` (letters typed there become guesses), so give the date `Input` no `autoFocus` and keep it visibly separate from the guess field. Selecting a date calls `resolveWord(io, thatDate)` and starts a fresh `createGame` against it, stored under `board:<date>` (so switching back to today later resumes where it was left).
4. Add a small stats readout (`Text`) in the pane — current streak, win %, the distribution bars — pulling from `io.store.get('stats')`.

## Outputs
- `hooks/lib/stats.js`
- Additions to `hooks/lib/board-view.js` (the archive picker and stats readout views) and `hooks/register.js` (their handlers).

## Human check
Finish today's puzzle (win or lose) and confirm the stats readout
updates accordingly. Then pick a past date from the archive, play it to
completion, and confirm the stats readout is unchanged from before that
archived game. Confirm switching back to today resumes (or shows
completed) rather than starting a fresh blank board.

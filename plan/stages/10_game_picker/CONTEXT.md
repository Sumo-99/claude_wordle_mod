# 10_game_picker — "Pick a game" screen and the replay flow

One job: add a **Pick a game** screen to the pane and the flow around it, in
the stage 09 frame (same header, palette and compact layout rules; none of
those change). Gameplay, the engine, the word source, stats and the win
celebration are untouched.

## Inputs
- Working: stage `09`'s `hooks/lib/board-view.js`, `hooks/lib/arcade.js`, `hooks/register.js`, `hooks/lib/archive.js`
- Reference: `../../../docs/ui-ref/wordle-picker.png` (the picker); `../09_compact_layout/CONTEXT.md` for the frame and the platform findings that still hold

Do NOT edit: `game-engine.js`, `word-source.js`, `stats.js`, `fireworks.js`, `lifecycle.js`.

## Flow
1. Opening the pane: today's puzzle unfinished → the game, as before; finished (won or lost) → the picker.
2. A game ends (today or practice, won or lost) and the picker opens on its own, with no press needed. A win plays the whole celebration first, which can't be skipped, and the picker opens when it ends. A loss shows `THE WORD WAS X` on the finished board for 3 seconds, with a `⏎ CONTINUE` control (hotkey `1`) to go sooner. When the picker opens, the keyboard moves to RANDOM GAME. (Changed after a live run: a finished board that waited for CONTINUE looked stuck, because the pane had lost the keyboard and `1` went to Claude's prompt.)
3. `↺ TODAY'S BOARD` on the picker reopens today's board (finished = read-only), with CONTINUE back to the picker.

## Rules (decided; tests pin them)
- **Pool**: every date from 2021-06-19 to yesterday. Today is never in it.
- **Played today**: dates whose game ended (won or lost) on the current calendar day, stored as `{ day: 'YYYY-MM-DD', dates: [...] }` under `$.store` key `played-today`. A date joins only when its game ends, never by opening it. When `day` isn't today the set is empty and is overwritten. No win/loss history in it.
- **RANDOM GAME**: uniform pick from pool minus played-today, the random source injectable (`randomDate(today, played, rng)`; in the pane, a number under the store key `config:random` fixes the pick). Nothing left → "You've played every game today!" and the set is cleared.
- **Date dropdown** (replaced the ◀ ▶ stepper after a live look, to match the stage 09 drawer's dropdown): lists the 14 newest pool dates not played today, newest first, starting on the newest; played-today dates are never offered. A pick only selects it; `2` plays it. Older dates go through DATE….
- **Typed date** (DATE…): rejects today, future, before 2021-06-19 and played-today, each with a one-line toast; the field stays open.
- **Replay/resume**: opening a past date from the picker whose saved board is unfinished resumes it; whose saved board is finished starts a fresh board that replaces it. Today's saved game is never touched by the picker.
- **Stats**: only today's daily counts; random and picked games are practice.
- **Countdown**: `NEXT DAILY IN HH:MM:SS` redraws every second, from a timer that runs only while the picker is the screen.

## Outputs
- `hooks/lib/picker.js` (pure rules + countdown), `hooks/lib/arcade.js` (one palette entry, `cardKey` #34302b), `hooks/lib/board-view.js` (picker screen, CONTINUE control), `hooks/register.js` (view state, handlers, played-today marking), `types/index.d.ts`
- `hooks/__tests__/picker.test.ts` (the existing suites pass unedited)
- `README.md`, `VERIFY.md` (Stage 10 checklist)

## Human check
`claude --plugin-dir .`, open `/wordle`, and run the "Stage 10" list in `VERIFY.md`: finish today with a win and with a loss, three random games in a row with no repeats, step dates past played ones, type a rejected date, leave a game halfway and resume it, reopen today's board, and a day rollover with a faked clock.

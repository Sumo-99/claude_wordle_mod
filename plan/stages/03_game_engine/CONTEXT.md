# 03_game_engine — score a guess

One job: pure Wordle scoring logic. Given a guess and an answer, return
the per-letter green/yellow/gray result, plus win/loss state across a
run of guesses. No UI, no word-fetching, no persistence — this stage is
math, testable without a session.

## Inputs
- Working: `../02_word_source/` output (`hooks/lib/word-source.js`'s `isValidGuess`) — used to reject illegal guesses before scoring, not to fetch answers
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §3 (game rules)

Do NOT load: §4.1–§4.3 (how the answer was resolved is irrelevant here —
this stage only ever sees a 5-letter answer string, never a date).

## Process
1. Write `hooks/lib/game-engine.js` exporting:
   - `scoreGuess(guess, answer)` → array of 5 `'green' | 'yellow' | 'gray'`. Two passes: mark exact-position matches green first and remove them from both strings' available pools, then mark remaining guess letters yellow if present in the answer's remaining pool (consuming one copy each), else gray. This is what makes double letters (e.g. guessing `ALLOY` against answer `ATOLL`) score correctly.
   - `createGame(answer)` → `{ answer, guesses: [], status: 'playing' | 'won' | 'lost' }` plus `submitGuess(game, guess)` that validates length and `isValidGuess`, appends a scored guess, and flips `status` to `'won'` (all green) or `'lost'` (6th guess used without winning).
2. Keep every function pure — no `$`, no I/O. The pane (stage `04`) calls these; this module never calls anything else.

## Outputs
- `hooks/lib/game-engine.js`

## Human check
By hand, verify `scoreGuess('allow', 'atoll')` style double-letter cases
against a known-correct Wordle scoring table (e.g. check a couple of
cases against a reference like the NYT site or a published scoring
explainer) — these are exactly the cases naive implementations get
wrong. Confirm a game reaches `'lost'` only after the 6th incorrect
guess, never earlier.

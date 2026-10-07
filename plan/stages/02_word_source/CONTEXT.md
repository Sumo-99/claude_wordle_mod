# 02_word_source — resolve a date to a word

One job: given a date, return the Wordle answer for that date — live
from NYT when reachable, from a deterministic offline fallback when not
— plus the bundled list a guess is checked against. No UI, no game
scoring: this stage is pure data, callable and testable on its own.

## Inputs
- Working: `../01_scaffold/` output (`hooks/register.js` exists, so this stage's module has somewhere to be required from — it doesn't need to be wired in yet)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §4 (word source, all of it), §7 (the `word:<date>` store key)

Do NOT load: §5 (input), §6 (stats) — this stage doesn't render anything
or touch streaks.

## Process
1. Write `data/fallback-answers.txt` — a plain list of valid 5-letter answer words, one per line (a few hundred is enough; this is the offline fallback pool, not the full guess-validation list).
2. Write `data/valid-guesses.txt` — the larger (~13k word) guess-legality list, one word per line.
3. Write `hooks/lib/word-source.js` exporting `resolveWord($, dateStr)`:
   - Check `$.store.get('word:' + dateStr)`; return it if present.
   - Else `fetch` `https://www.nytimes.com/svc/wordle/v2/${dateStr}.json` with a ~3s timeout. On success, `{ solution, source: 'live' }`.
   - On any failure (timeout, non-200, missing `solution` field): compute `index = daysSinceEpoch(dateStr) % fallbackList.length` against the loaded `fallback-answers.txt`, return `{ solution, source: 'fallback' }`.
   - Either way, `$.store.set('word:' + dateStr, result)` before returning, so the next call for that date is free.
   - Also export `isValidGuess(word)`, a simple lookup against `valid-guesses.txt` (lowercased, trimmed).

## Outputs
- `hooks/lib/word-source.js`
- `data/fallback-answers.txt`
- `data/valid-guesses.txt`

## Human check
In a scratch script or the mod's test harness, call `resolveWord($, '2026-10-07')` and confirm it returns `{ solution: 'prove', source: 'live' }`, and `resolveWord($, '2024-01-01')` returns `{ solution: 'mural', source: 'live' }`. Then force a failure (e.g. point the fetch at an invalid host, or stub the network call to reject) and confirm it returns a fallback result with `source: 'fallback'` instead of throwing. Confirm a second call for the same date doesn't hit the network again (check `$.store`).

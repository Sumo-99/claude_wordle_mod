# 07_testing_polish — tests, docs, final pass

One job: lock in correctness with automated tests, and make the repo
usable by someone who wasn't in this conversation — a README that gets
a fresh checkout running, nothing more.

## Inputs
- Working: every prior stage's output (the whole plugin as it stands)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` (all of it — this stage checks the build against the whole spec, not one section)

Do NOT load: nothing is off-limits here — this is the integration stage.

## Process
1. Using the mods test harness (`code.claude.com/docs/en/plugins/mods/test`), write tests under `hooks/__tests__/` (the harness runs `*.test.ts`; stages `02`–`04` already added `word-source.test.ts`, `game-engine.test.ts` and `board.test.ts` — review them for gaps rather than rewriting, and add only what's missing):
   - `word-source.test.ts` (exists): known-date resolutions, fallback-on-failure, cache behavior (from `02`'s human check, now automated).
   - `game-engine.test.ts` (exists): the double-letter scoring cases and win/loss edges (from `03`'s human check, now automated).
   - `lifecycle.test.ts` (new): `turn.start` opens the pane when the flag is on and doesn't when it's off; nothing closes it on `turn.complete` (from `05`'s human check, now automated).
   - `stats.test.ts` (new): a completion updates stats; an archived-date completion doesn't (from `06`'s human check, now automated).
2. Write `README.md` at repo root: what the mod does, how to load it (`claude --plugin-dir .`), the `/wordle` and `/wordle config` commands, and a one-line pointer to `docs/spec/` for anyone who wants the full design rationale.
3. Run `claude plugin validate .` one more time against the finished plugin and resolve anything it flags.

## Built as
All stage tests already existed except the board's fallback marker; this stage added that (`board.test.ts`: marker present on a fallback puzzle, absent on a live one) and the README. The human check below still applies.

## Outputs
- `hooks/__tests__/word-source.test.ts`, `game-engine.test.ts`, `board.test.ts` (already present)
- `hooks/__tests__/lifecycle.test.ts`
- `hooks/__tests__/stats.test.ts`
- `README.md`

## Human check
Run the full test suite and confirm everything is green. Then, from a
clean `git clone` of the repo in a different directory, follow only
`README.md` and confirm `/wordle` works without consulting this
conversation or `docs/spec/` for anything beyond what the README says.

# 01_scaffold — a loadable mod with one command

One job: get a minimal, loadable plugin registered with Claude Code,
with a `/wordle` command that opens and closes an empty pane. No game
logic, no board — this stage proves the plumbing, nothing else.

## Inputs
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §1 (target surfaces), §2 (trigger model — just the `/wordle` command part; the auto-open flag and turn hooks are stage `05`, not here)

Do NOT load: §3–§9 of the spec. This stage doesn't touch game rules,
word source, stats, or the archive.

## Process
1. Write `.claude-plugin/plugin.json` — name `wordle-mod`, version `0.1.0`, description, author.
2. Write `hooks/hooks.json` pointing at `./register.js`.
3. Write `hooks/register.js`:
   - `session.start`: register the `/wordle` command (`$.command.register`).
   - `command.run` (filtered to `wordle`): `$.ui.open({ id: 'wordle', title: 'Wordle', focus: true, closeOnEscape: true })`.
   - `ui.render` (filtered to `{ component: 'Pane' }`, `e.requestId === 'wordle'`): return a placeholder `Text` ("Wordle — coming soon") in a `Box`. Real board rendering is stage `04`.
4. Write `types/index.d.ts` with an empty `PluginState` shape for `wordle-mod` (stages `05`/`06` add real keys as they introduce them — don't invent speculative keys now).

## Outputs
- `.claude-plugin/plugin.json`
- `hooks/hooks.json`
- `hooks/register.js`
- `types/index.d.ts`

## Human check
Run `claude --plugin-dir .` in a terminal at the repo root. Type
`/wordle`. Confirm a pane opens showing the placeholder text, and that
Esc closes it. Run `claude plugin validate .` and confirm it reports no
errors.

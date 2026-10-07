# 05_lifecycle_integration — hook it to Claude's turns

One job: make the pane's appearance follow the config flag and Claude's
turn lifecycle, per spec §2 — without touching how the board itself is
drawn (that's `04`, already done) or ever auto-closing it.

## Inputs
- Working: `../01_scaffold/` output (`hooks/register.js`, the `/wordle` command), `../04_interface/` output (the pane to open)
- Reference: `../../../docs/spec/2026-10-07-wordle-mod-design.md` §2 (trigger model, in full), §7 (`config:autoOpen` store key)

Do NOT load: §3/§4/§6 — this stage doesn't change game rules, word
resolution, or stats; it only decides *when the pane is shown*.

## Process
1. Add a `wordle config` sub-command (or a second registered command, `wordle-config`) that reads an argument (`auto-open on|off`) and writes `$.store.set('config:autoOpen', true|false)`.
2. Add a `turn.start` hook: read `$.store.get('config:autoOpen')`; if true, `$.ui.open({ id: 'wordle', ... })` the same way `/wordle` does (same pane id, so stage `04`'s `ui.render` hook draws it either way) — but withOUT `focus: true` here, per the mods platform rule that an auto-opened pane (not from direct user action) is subject to the width gate and shouldn't steal focus from a user who's about to type their next prompt.
3. Do **not** add a `turn.complete` hook that closes the pane. Confirm no such hook exists anywhere in the codebase after this stage — that absence is the deliverable as much as any file.
4. Confirm `/wordle` run directly by the user still passes `focus: true` and opens regardless of terminal width (that path is untouched by this stage).

## Outputs
- Additions to `hooks/register.js` (or a new `hooks/lib/lifecycle.js` required from it): the config sub-command and the `turn.start` hook.

## Human check
Run `/wordle config auto-open on`. Send Claude a prompt that takes a
few seconds. Confirm the pane opens on its own while Claude is
generating, and is still open after the response finishes (no
auto-close). Run `/wordle config auto-open off`, send another prompt,
confirm the pane does *not* open on its own, and that `/wordle` typed
manually still opens it immediately either way.

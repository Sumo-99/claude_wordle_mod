# Claude Wordle mod

A Claude Code mod: play a Wordle-style game in a pane while Claude
generates a response. The design is settled (`docs/spec/`); what's left
is building it stage by stage.

Built on ICM: folders carry sequencing, hierarchy carries context, files
carry state. The structure is the documentation — if something needs
explaining, the explanation goes in that folder's `CONTEXT.md`, not in
your head.

## Where things live

| Folder | What it holds |
|---|---|
| `.claude-plugin/`, `hooks/`, `data/`, `types/` | the actual plugin — the product, grows stage by stage |
| `docs/spec/` | the design spec — stable, read by every stage |
| `plan/` | the implementation plan: one contract per build stage |

## Route by what just happened

| If | Go to | Then stop at |
|---|---|---|
| starting implementation, or resuming | `plan/CONTEXT.md` | the first stage whose outputs don't all exist yet |
| mid-stage | `plan/stages/NN_name/CONTEXT.md` | its human check passes |
| asked for build status | `plan/CONTEXT.md`'s table, checked against the real paths | report what exists, what doesn't |
| need *why*, not *what* | `docs/spec/2026-10-07-wordle-mod-design.md` | — |

## The one rule

Nothing moves to the next stage until a person has run that stage's
human check and confirmed it passes.

# Claude Wordle mod

A [Claude Code mod](https://code.claude.com/docs/en/plugins/mods) that lets
you play Wordle in a pane while Claude is busy generating a response. It
works in the terminal CLI and in the Code tab of the Claude Desktop app.

## Load it

From a clone of this repo:

```bash
claude --plugin-dir .
```

Then type `/wordle`.

## Commands

| Command | What it does |
|---|---|
| `/wordle` | Opens the Wordle pane (always available, even while Claude is working). |
| `/wordle config auto-open on` | Also open the pane automatically whenever Claude starts a turn. |
| `/wordle config auto-open off` | Turn that off (the default). |
| `/wordle config auto-open` | Show the current setting. |
| `/wordle config reset-history` | Say how many saved games would be deleted. Add `confirm` to delete every saved game and cached word (stats and settings are kept; **Clear stats** resets those). |

The pane never closes on its own. Close it with its ✕ or Esc. An
auto-opened pane doesn't take the keyboard from your prompt, and the
platform only seats it in terminals at least 144 columns wide; `/wordle`
typed by you has no width limit.

## Playing

You get six guesses at the day's five-letter word. After each guess every
letter is colored **and underlined**:

- **green**: right letter, right place
- **yellow**: right letter, wrong place
- **gray**: letter not in the word

A legend beside the keyboard repeats this.

Solve the puzzle and the board gives way to a 3-second firework celebration on a gray screen, then comes back.

To enter a guess, either type into the **Guess:** field (Backspace deletes
the last letter, Enter submits) or click the on-screen keyboard. The
on-screen keys also have hotkeys: each letter is its own key, **1** is
Enter and **2** is Backspace.

### Stats

Press **Stats** in the header to open a separate stats window: current
streak, max streak, games played, win %, and how many wins took 1–6
guesses. Only today's puzzle counts. **Clear stats** (top right of that
window; press twice to confirm) resets the history to zero without touching
your saved boards.

### Practice: past puzzles

Pick any of the last 14 days from the **Day:** list, or type any date
(`YYYY-MM-DD`, from 2021-06-19 on) into **Or a date:**. Past puzzles are
practice: they never change your stats. Your board for each date is saved,
so switching back to today resumes where you left off.

### Offline

The day's word comes from the NYT's unofficial Wordle endpoint. If it
can't be reached, the mod falls back to a deterministic offline word and
shows a **⚠ offline puzzle** marker; press it to see why. The endpoint is
undocumented and can change without notice, which is exactly what the
fallback is for.

## Development

```bash
claude plugin validate .   # check the manifest and hooks module
claude plugin test .       # run hooks/__tests__/*.test.ts
```

Layout:

- `.claude-plugin/`, `hooks/`, `data/`, `types/`: the plugin.
  `hooks/register.js` is the single hooks module and the only place that
  touches the engine's `$`; `hooks/lib/` is pure logic it calls.
- `docs/spec/`: the design and the reasons behind it.
- `plan/`: the staged build plan this was built from, one contract per
  stage. `VERIFY.md` lists the manual checks.

The valid-guess and fallback-answer word lists in `data/` come from
public Wordle word lists (the original answers and allowed-guesses sets).

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
| `/wordle config reset-history` | Say how many saved games would be deleted. Add `confirm` to delete every saved game and cached word (stats and settings are kept; **CLEAR STATS** under **▾ MORE** resets those). |

The pane never closes on its own. Close it with its ✕ or Esc. An
auto-opened pane doesn't take the keyboard from your prompt, and the
platform only seats it in terminals at least 144 columns wide; `/wordle`
typed by you has no width limit.

## Playing

You get six guesses at the day's five-letter word. The pane is drawn as an
arcade cabinet ("Claude night"): a score header, a block-letter **WORDLE**
title, and two walled panels, the board on the left and the controls on the
right.

After each guess every tile is filled by its result:

- **green**: right letter, right place
- **amber**: right letter, wrong place
- **dark** with a dim letter: letter not in the word

Rows you haven't reached are pellets (`•`, with `●` power pellets in the last
row's corners); the row you are typing shows your letters and a `▌` cursor.

The keyboard mirrors what you've learned: a key's double-line frame turns
green or amber once that letter is found, and a letter that is known to be a
miss is eaten: its key disappears, leaving a dim `·`.

### Controls

| Control | What it does |
|---|---|
| **TYPE:** field | Type your guess (it has the keyboard when the pane opens). Backspace deletes the last letter, Enter submits. |
| On-screen keys | Click a letter to add it. **⏎** submits, **⌫** deletes. |
| `1` / `2` | Hotkeys for ⏎ and ⌫ (when the focus is on the pane, not in the field). Letter keys have no hotkey of their own: type into the field instead. |
| **▾ MORE** | Beside the STREAK/BEST/WIN% row: opens games played, the 1–6 guess distribution, and **CLEAR STATS** (press twice to confirm). **▴ LESS** closes it. |
| **◀ ▶** | Beside the STAGE date: step back and forward through the last 14 days. |
| **▶ TODAY** | Jump back to today's puzzle (shown on any other day). |
| **DATE…** | Opens a field for any date (`YYYY-MM-DD`, from 2021-06-19 on). |
| Esc | Close the pane. |

Above the board: **1UP** is this puzzle's score (100 for every guess left
when you solve it, 0 otherwise), **HI-SCORE** is the best score in your
stats, and **STAGE** is the puzzle's date. **LIVES** shows ◆ for each guess
left and ◇ for each used; **READY!** shows until your first guess.

Solve the puzzle and the board gives way to a 3-second red celebration — it opens out from the centre with shockwaves, a red-and-gold burst, a turning sunburst and **WORDDDD... / you solved it!** — then comes back (press `1` or click *continue* to skip). `/wordle config reduce-motion on` swaps it for a plain fade.

### Stats

**STREAK** (current streak), **BEST** (longest streak) and **WIN%** sit in
the controls panel. Only today's puzzle counts. **▾ MORE** shows games
played, wins and how many wins took 1–6 guesses, and **CLEAR STATS** resets
the history to zero without touching your saved boards.

### Practice: past puzzles

Any day other than today is a **practice stage** (`── PRACTICE STAGE ──`
under the title): it never changes your stats. Step to one with **◀ ▶** or
type a date behind **DATE…**. Your board for each date is saved, so
**▶ TODAY** resumes where you left off.

### Pane size

The layout adapts to the room the pane has. From about 90 columns the two
panels sit side by side; narrower, the controls drop under the board, and
below about 70 columns the title is a plain **WORDLE**. In a short pane the
blank rows go first, then the tiles, title and header flatten to one row
each. An inline pane gets roughly a third of the terminal's height, so the
full layout shows in a docked pane (fullscreen, 110+ columns) or a very tall
terminal; otherwise the pane scrolls with the arrow keys.

### Offline

The day's word comes from the NYT's unofficial Wordle endpoint. If it
can't be reached, the mod falls back to a deterministic offline word and
shows a **⚠ OFFLINE PUZZLE** marker in the controls panel; press it to see why. The endpoint is
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

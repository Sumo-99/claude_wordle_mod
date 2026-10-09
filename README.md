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

## Opening splash

Every time the pane opens it plays a short arcade attract screen, "Chomp &
grade", then hands off: to today's game, or to the Pick a game screen when
today is already finished. In a double-line frame (78 × 11, centred in a
bigger pane), under a `1UP 00000 · HI-SCORE · STAGE` line:

1. **Chomp** (0–2.5 s): an eater runs left to right across a row of pellets,
   and behind it the block-letter **WORDLE** appears as scored tiles: W green,
   O amber, R green, D gray, L amber, E green. The eater takes the color of the
   letter it is in.
2. **Grade** (2.6–3.0 s): a green wave turns every letter green, with
   `✓ ✓ ✓ ✓ ✓ ✓` underneath.
3. **Flash** (3.0–3.15 s), then **settle** (to 4.0 s): the title turns
   terracotta, **READY!** blinks, and `DAILY PUZZLE · PRESS ANY KEY TO SKIP`
   (or `PICK YOUR NEXT GAME · …`) shows.

Any key, a click on the skip line, or `1` skips it straight to the hand-off.
The key you press to skip never lands in your guess. When auto-open brings
the pane up, a 2-second cut plays instead (a faster chomp, no grade or flash),
and only when the pane wasn't already open: a pane you're playing in is never
interrupted. `/wordle config reduce-motion on` replaces it with the settled
picture for 1 second. In a pane narrower than 41 columns the title is a plain
`W O R D L E`; in a short one the score line and then the skip line give way
first. Resizing never restarts it, and it never changes your games or stats.

## Playing

You get six guesses at the day's five-letter word. The pane is a compact
arcade cabinet ("Claude night"), about 12 rows tall: a one-line header
(the **WORDLE** badge and your score), then one framed panel with the board
on the left and the controls on the right, and a hint line underneath.

After each guess every tile is filled by its result:

- **green**: right letter, right place
- **amber**: right letter, wrong place
- **dark** with a dim letter: letter not in the word

Rows you haven't reached are pellets (`•`, with `●` power pellets in the last
row's corners); the row you are typing shows your letters and a `▌` cursor.

The keyboard mirrors what you've learned: a key's chip turns green or amber
once that letter is found, and a letter that is known to be a miss is eaten:
its key disappears, leaving a dim `·`.

### Controls

| Control | What it does |
|---|---|
| **TYPE:** field | Type your guess (it has the keyboard when the pane opens). Backspace deletes the last letter, Enter submits. |
| On-screen keys | Click a letter to add it. **⏎** submits, **⌫** deletes. |
| `⏎ ENTER` / `⌫ DELETE` | The hint line names the two keys; click them like the chips. There are no digit hotkeys any more (a hotkey would draw a `1:` in front of the icon) and letter keys have none either: type into the field instead. |
| **◀ ▶** | Beside `STAGE` in the stats row: step back and forward through the last 14 days. |
| **▶ TODAY** | Under the frame on any other day: jump back to today's puzzle. |
| **DATE…** | Under the frame, left of ▾ MORE: opens a big **PICK A STAGE** container below the compact layout (scroll down to it) with a list of the last 14 days and a field for any other date (`YYYY-MM-DD`, from 2021-06-19 on). Picking a day plays it and closes the container. |
| **▾ MORE** | Under the frame: opens a big **STATS** container below the compact layout: games played, the 1–6 guess distribution as bars, and **CLEAR STATS** (press twice to confirm). **▴ LESS** closes it. Only one of the two containers is open at a time: opening one closes the other. |
| Esc | Close the pane. |

In the header, **1UP** is this puzzle's score (100 for every guess left when
you solve it, 0 otherwise), **HI** is the best score in your stats, and
**STAGE** is the puzzle's date. **LIVES** shows ◆ for each guess left and ◇
for each used; **READY!** shows until your first guess.

Solve the puzzle and the board gives way to a 3-second red celebration — it opens out from the centre with shockwaves, a red-and-gold burst, a turning sunburst and **WORDDDD... / you solved it!** — and it always plays to the end (there is no skip). Then the Pick a game screen opens. `/wordle config reduce-motion on` swaps it for a plain fade (and the opening splash for its 1-second still).

### Pick a game

Open the pane with today's puzzle finished (won or lost) and, after the
splash, it opens the **Pick a game** screen instead of the board. The same screen follows every
finished game, today's or practice, and it opens by itself. A win plays the
whole celebration first. A loss shows `THE WORD WAS …` for 3 seconds (with
**⏎ CONTINUE**, hotkey `1`, to go sooner). The keyboard lands on RANDOM GAME,
so `1` and `2` work right away.

The picker is the same compact frame (about 12 rows; the two cards stack
when the pane is too narrow for them):

- header: the badge, `TODAY SOLVED 4/6` (or `TODAY LOST · CRANE`), then `1UP` and `HI`
- **⚄ RANDOM GAME** (hotkey `1`): a random date from 2021-06-19 to yesterday,
  never today and never one you finished today. Under it, how many are left.
  Played everything? It says *You've played every game today!* and starts the set over.
- **PICK A DATE** (hotkey `2` plays the date shown): **◀ ▶** step through the same range, jumping
  over dates you finished today (the caption names what the last step skipped). It starts on yesterday,
  or the newest date you haven't played today.
- `STREAK`, `BEST`, `WIN%`, and **NEXT DAILY IN HH:MM:SS** (it redraws every second, from a timer that
  only runs while the picker is showing)
- footer: **↺ TODAY'S BOARD** reopens today's board (a finished one is read-only, with CONTINUE back),
  **DATE…** opens a typed-date field (today, future dates, dates before 2021-06-19 and dates you
  finished today are rejected with a message), `ESC TO EXIT`.

A date counts as played today only when its game ends, won or lost; one you
leave halfway stays available and resumes where you left off. A past date you
finished on an earlier day starts over with a fresh board. Random and picked
games are practice and never touch your stats. The played-today set lives in the
store as `{ day, dates }` and empties itself when the date changes.
`config:random` (a number from 0 to under 1, set in the store) fixes
RANDOM GAME's pick for repeatable testing; it is normally unset.

### Stats

**STREAK** (current streak), **BEST** (longest streak) and **WIN%** sit in
the controls panel, next to the stage. Only today's puzzle counts. **▾ MORE**
shows games played, wins and how many wins took 1–6 guesses, and **CLEAR
STATS** resets the history to zero without touching your saved boards.

### Practice: past puzzles

Any day other than today is a **practice stage** (**PRACTICE STAGE** beside
the badge): it never changes your stats. Step to one with **◀ ▶** or
type a date behind **DATE…**. Your board for each date is saved, so
**▶ TODAY** resumes where you left off.

### Pane size

The pane opens in the compact layout, about 12 rows tall: the controls sit
beside the board from 75 columns (78 wide when there's room), and wider panes
get bigger tiles and keys (from 85 and 99 columns). The footer always stays
on one row there; its right margin shrinks before it would wrap. In a pane
narrower than 75 columns the controls stack under the board (about 20 rows).
Docked, a dock too narrow for the compact layout is asked once for 78
columns; a wider dock is left as it is.

Inline, Claude Code gives the pane about a third of the terminal's height, so
in a short terminal the compact layout gives way to keep the footer bar
(DATE…, ▾ MORE) in view: first the blank rows around the board, then the one
above the stats row, then the header, then the frame's border, down to 7 rows
(a terminal of about 27 rows). Below that the board alone is taller than the
pane, and the pane scrolls.

It opens compact whatever the height. Make the terminal taller after that and
once the pane has the height for the stacked layout (its rows plus two: about
21 to 22 body rows), it stacks, board on top, with the biggest tiles and keys
that fit. Once stacked it stays stacked until the height drops two rows below
that, so it doesn't flicker on the edge.
**▾ MORE** and **DATE…** each open a big framed container underneath, which can take as much room as it needs (scroll down to it); the compact layout above stays as it is.

### Offline

The day's word comes from the NYT's unofficial Wordle endpoint. If it
can't be reached, the mod falls back to a deterministic offline word and
shows a **⚠ OFFLINE** marker in the header; press it to see why. The endpoint is
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

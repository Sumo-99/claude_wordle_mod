import { recentDates } from './archive.js'
import { fireworkRows, HEIGHT, WIDTH } from './fireworks.js'
import { WORD_LENGTH } from './game-engine.js'
import { winPercent } from './stats.js'

export const FALLBACK_NOTE = "Couldn't reach the live word — showing an offline puzzle instead."

const MAX_GUESSES = 6
// Theme keys, so the colors follow the person's theme. Every scored letter is
// also underlined, which keeps a gray (absent) letter distinct from an unplayed
// one and gives color-blind players a second cue besides the legend.
const SCORE_COLOR = { green: 'success', yellow: 'warning', gray: 'inactive' }
const LEGEND = [
  ['green', 'right letter, right place'],
  ['yellow', 'right letter, wrong place'],
  ['gray', 'letter not in the word'],
]
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

// A hotkey is one digit or one lowercase letter, so Enter and Backspace sit on
// digits: all 26 letters belong to the letter keys.
export const ENTER_KEY = '1'
export const BACKSPACE_KEY = '2'

/** Letters ruled out so far: gray everywhere they appear. */
const ruledOut = game => {
  const seen = new Set()
  const kept = new Set()
  for (const { word, score } of game.guesses) {
    ;[...word].forEach((ch, i) => {
      seen.add(ch)
      if (score[i] !== 'gray') kept.add(ch)
    })
  }

  return new Set([...seen].filter(ch => !kept.has(ch)))
}

/** One row of five letters: scored letters colored and underlined, typed ones plain. */
const letterRow = (h, Box, Text, game, draft, r) => {
  const played = game.guesses[r]
  const isActive = r === game.guesses.length && game.status === 'playing'
  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => {
    if (played) {
      return h(Text, { key: i, bold: true, underline: true, color: SCORE_COLOR[played.score[i]] }, played.word[i].toUpperCase())
    }
    if (isActive && draft[i]) return h(Text, { key: i, bold: true }, draft[i].toUpperCase())

    return h(Text, { key: i, dimColor: true }, '·')
  })

  return h(Box, { key: `row${r}`, flexDirection: 'row', gap: 1 }, ...cells)
}

const legend = (h, Box, Text) =>
  h(
    Box,
    { flexDirection: 'column' },
    h(Text, { dimColor: true }, 'Legend'),
    ...LEGEND.map(([score, meaning]) =>
      h(
        Box,
        { key: `legend-${score}`, flexDirection: 'row', gap: 1 },
        h(Text, { bold: true, underline: true, color: SCORE_COLOR[score] }, 'A'),
        h(Text, null, meaning),
      ),
    ),
  )

const BACKDROP = 'gray'

/**
 * The win screen: while it runs it REPLACES the board. A gray backdrop fills the
 * pane and the fireworks are centered on it; when the frames run out the board
 * comes back. `screen` is `{ columns, rows }`, the room the pane has.
 */
const celebrationScreen = (h, Box, Text, frame, screen) =>
  h(
    Box,
    {
      key: 'fireworks',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: Math.max(WIDTH, screen.columns),
      height: Math.max(HEIGHT, screen.rows),
      backgroundColor: BACKDROP,
    },
    ...fireworkRows(frame).map((runs, y) =>
      h(
        Box,
        { key: `fw${y}`, flexDirection: 'row' },
        ...runs.map((run, i) => h(Text, { key: i, color: run.color, bold: run.bold, backgroundColor: BACKDROP }, run.text)),
      ),
    ),
  )

const BAR_WIDTH = 10

/** The stats readout: streaks, win %, and the guess-count distribution as bars. */
const statsBlock = (h, Box, Text, stats) => {
  const most = Math.max(1, ...stats.distribution)
  const bars = stats.distribution.map((n, i) => {
    const width = n === 0 ? 0 : Math.max(1, Math.round((n / most) * BAR_WIDTH))

    return h(Text, { key: `dist${i}`, dimColor: n === 0 }, `${i + 1} ${'█'.repeat(width)} ${n}`)
  })

  return h(
    Box,
    { flexDirection: 'column' },
    h(
      Text,
      { bold: true },
      `Streak ${stats.currentStreak} · Max ${stats.maxStreak} · Played ${stats.played} · Win ${winPercent(stats)}%`,
    ),
    ...bars,
  )
}

/** The stats pane's tree: its own window, opened by the main pane's toggle. */
export const renderStats = ({ h, Box, Text, Button }, { stats, isConfirmingClear }, on) =>
  h(
    Box,
    { flexDirection: 'column', gap: 1 },
    // title left, the clear control top right; the button is dim until the pointer
    // or focus is on it, and the first press only arms it
    h(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      h(Text, { bold: true }, 'Wordle stats'),
      h(Button, {
        key: 'clear-stats',
        label: isConfirmingClear ? 'Press again to clear' : 'Clear stats',
        dimColor: !isConfirmingClear,
        onPress: () => on.clearStats(),
      }),
    ),
    statsBlock(h, Box, Text, stats),
  )

/** The archive picker: a Select of recent days plus a free-entry date field. */
const archiveBlock = (h, Box, Text, Select, Input, { puzzle, today }, on) => {
  const dates = recentDates(today)
  const options = dates.map(date => ({ value: date, label: date === today ? `${date} (today)` : date }))

  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, { dimColor: true }, 'Play another day (practice — not counted in stats)'),
    h(Select, {
      key: 'archive-pick',
      label: 'Day: ',
      options,
      value: puzzle && dates.includes(puzzle.date) ? puzzle.date : today,
      onSelect: value => on.pickDate(value),
    }),
    // no autoFocus: the guess field owns the keyboard, letters here would be lost guesses
    h(Input, {
      key: 'archive-date',
      label: 'Or a date: ',
      placeholder: 'YYYY-MM-DD',
      submitLabel: 'play',
      onSubmit: text => on.pickDate(text),
    }),
  )
}

const statusLine = game =>
  game.status === 'won'
    ? `Solved in ${game.guesses.length}/${MAX_GUESSES} 🎉`
    : game.status === 'lost'
      ? `The word was ${game.answer.toUpperCase()}`
      : `Guess ${game.guesses.length + 1}/${MAX_GUESSES} · Enter = ${ENTER_KEY}, ⌫ = ${BACKSPACE_KEY}`

/**
 * The pane's tree for one game state. Pure: the caller supplies the element
 * factory `h`, the surface's `Box`/`Text`/`Button`, and the press callbacks, so
 * this file never touches the engine's `$`.
 *
 * @param ui `{ h, Box, Text, Button, Input, Select }`
 * @param view `{ game, draft, puzzle, today, isStatsOpen, celebrationFrame, screen }`; `celebrationFrame` >= 0 shows the win screen instead of the board; `screen` is `{ columns, rows }`; `game` null means still loading
 * @param on `{ letter(ch), enter(), backspace(), input(text), pickDate(date), toggleStats(), fallbackInfo() }`
 */
export const renderBoard = ({ h, Box, Text, Button, Input, Select }, { game, draft, puzzle, today, isStatsOpen, celebrationFrame, screen }, on) => {
  if (celebrationFrame >= 0) return celebrationScreen(h, Box, Text, celebrationFrame, screen)
  if (!game) return h(Box, { flexDirection: 'column' }, h(Text, null, 'Loading today’s puzzle…'))

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => letterRow(h, Box, Text, game, draft, r))

  const gray = ruledOut(game)
  const keyboard = KEY_ROWS.map((row, i) => {
    const keys = [...row].map(ch =>
      h(Button, { key: `k-${ch}`, label: ch.toUpperCase(), hotkey: ch, dimColor: gray.has(ch), onPress: () => on.letter(ch) }),
    )
    if (i === 2) {
      keys.unshift(h(Button, { key: 'enter', label: 'Enter', hotkey: ENTER_KEY, variant: 'primary', onPress: () => on.enter() }))
      keys.push(h(Button, { key: 'back', label: '⌫', hotkey: BACKSPACE_KEY, onPress: () => on.backspace() }))
    }

    return h(Box, { key: `krow${i}`, flexDirection: 'row', gap: 1 }, ...keys)
  })

  return h(
    Box,
    { flexDirection: 'column', gap: 1 },
    h(
      Box,
      { flexDirection: 'row', gap: 1 },
      h(Text, { bold: true }, 'Wordle'),
      puzzle && h(Text, { dimColor: true }, puzzle.date),
      h(Button, { key: 'stats-toggle', label: isStatsOpen ? 'Hide stats' : 'Stats', onPress: () => on.toggleStats() }),
    ),
    puzzle && !puzzle.isToday && h(Text, { color: 'warning' }, 'Practice puzzle — this game does not count toward your stats'),
    puzzle?.source === 'fallback' &&
      h(Button, { key: 'fallback-warning', label: '⚠ offline puzzle', onPress: () => on.fallbackInfo() }),
    h(Box, { flexDirection: 'column' }, ...rows),
    h(Text, { dimColor: true }, statusLine(game)),
    // The typing surface: the field edits `draft` natively (Backspace deletes the
    // last letter, Enter submits); the on-screen keys feed the same draft.
    game.status === 'playing' &&
      h(Input, {
        key: 'guess',
        label: 'Guess: ',
        placeholder: 'type a word',
        value: draft,
        autoFocus: true,
        submitLabel: 'guess',
        onInput: text => on.input(text),
        onSubmit: () => on.enter(),
      }),
    // keyboard and legend side by side, the legend toward the right
    h(Box, { flexDirection: 'row', gap: 4, alignItems: 'flex-end' }, h(Box, { flexDirection: 'column' }, ...keyboard), legend(h, Box, Text)),
    archiveBlock(h, Box, Text, Select, Input, { puzzle, today }, on),
  )
}

import { recentDates } from './archive.js'
import { gameScore, hiScore, keyLook, livesText, pad, PALETTE, stageLabel, stepStage, tileLook } from './arcade.js'
import { celebrationRows, MIN_COLUMNS, MIN_ROWS } from './fireworks.js'
import { MAX_GUESSES, WORD_LENGTH } from './game-engine.js'
import { winPercent } from './stats.js'

export const FALLBACK_NOTE = "Couldn't reach the live word — showing an offline puzzle instead."

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

// A hotkey is one digit or one lowercase letter, so Enter and Backspace sit on
// digits. The letter keys carry none: a `plain` Button with a hotkey draws as
// `q: Q`, too wide for a 5-column key, and the Guess field takes typed letters.
export const ENTER_KEY = '1'
export const BACKSPACE_KEY = '2'

const RANK = { gray: 1, yellow: 2, green: 3 }

/**
 * What the guesses have taught about each letter: the best result it has had.
 * Green beats yellow beats gray, so a letter found in the right place stays
 * green on the keyboard even if a later guess used it in the wrong spot.
 */
export const keyStates = game => {
  const states = {}
  for (const { word, score } of game.guesses) {
    ;[...word].forEach((ch, i) => {
      if (!states[ch] || RANK[score[i]] > RANK[states[ch]]) states[ch] = score[i]
    })
  }

  return states
}

// The skip control, drawn plain (`1: continue`) on the bottom row of the red.
const SKIP_LABEL = 'continue'
const SKIP_TEXT = `${ENTER_KEY}: ${SKIP_LABEL}`

/** The runs covering columns [from, to) of a row, cut at the ends. */
const sliceRuns = (runs, from, to) => {
  const out = []
  let x = 0
  for (const run of runs) {
    const text = run.text.slice(Math.max(0, from - x), Math.max(0, to - x))
    if (text) out.push({ ...run, text })
    x += run.text.length
  }

  return out
}

/**
 * The win screen: while it runs it REPLACES the board. Every cell of the pane is
 * painted by `celebrationRows` (a red radial gradient with a turning sunburst,
 * opening out from the centre, the burst and the words on top), and the bottom
 * row holds a control that ends it early. When the frames run out the board
 * comes back. `screen` is `{ columns, rows }`, the room the pane has.
 */
const celebrationScreen = (h, Box, Text, Button, frame, screen, reducedMotion, on) => {
  const columns = Math.max(MIN_COLUMNS, screen.columns)
  const rows = celebrationRows(frame, { columns, rows: Math.max(MIN_ROWS, screen.rows) }, reducedMotion)
  const drawRow = (runs, y) =>
    h(
      Box,
      { key: `fw${y}`, flexDirection: 'row' },
      ...runs.map((run, i) => h(Text, { key: i, color: run.color, bold: run.bold, backgroundColor: run.backgroundColor }, run.text)),
    )
  // the skip control sits centred in the last row, the gradient carrying on either side of it
  const last = rows.pop()
  const from = Math.floor((columns - SKIP_TEXT.length) / 2)
  const isRed = last.some(run => run.backgroundColor)
  const skipRow = isRed
    ? h(
        Box,
        { key: 'fw-skip', flexDirection: 'row' },
        ...sliceRuns(last, 0, from).map((run, i) => h(Text, { key: `l${i}`, backgroundColor: run.backgroundColor }, run.text)),
        h(Button, { key: 'skip-celebration', label: SKIP_LABEL, hotkey: ENTER_KEY, plain: true, onPress: () => on.skipCelebration() }),
        ...sliceRuns(last, from + SKIP_TEXT.length, columns).map((run, i) =>
          h(Text, { key: `r${i}`, backgroundColor: run.backgroundColor }, run.text),
        ),
      )
    : drawRow(last, rows.length)

  return h(
    Box,
    { key: 'fireworks-wrap', flexDirection: 'column', alignItems: 'center' },
    h(Box, { key: 'fireworks', flexDirection: 'column', width: columns }, ...rows.map(drawRow), skipRow),
  )
}

// ---- the compact arcade board (docs/ui-ref/wordle-compact-options.png, panel 1) ----

const TILE = 3 // columns per tile and per key chip; both are one row tall
const BOARD_WIDTH = WORD_LENGTH * TILE + (WORD_LENGTH - 1)
const KEYBOARD_WIDTH = KEY_ROWS[0].length * (TILE + 1) - 1
const LEFT_PAD = 2
const LEFT_COL = BOARD_WIDTH + LEFT_PAD * 2
const RIGHT_PAD = 2
const RIGHT_COL = 45 + RIGHT_PAD * 2 // the widest right-hand row (stats and stage) plus its padding
const FRAME_PADDING = 1 // blank rows above and below the board inside the frame
/** From this many columns the controls sit beside the board; narrower, under it. */
export const SIDE_BY_SIDE_MIN = 2 + LEFT_COL + 1 + RIGHT_COL
const MAX_WIDTH = 78
const BAR_WIDTH = 24

/** One tile: 3 columns, one row, ` X ` on a fill. A letterless tile is just the fill. */
const tile = (h, Box, Text, key, fill, letter, color) =>
  h(Box, { key, width: TILE }, h(Text, { color, backgroundColor: fill, bold: true }, ` ${letter} `))

/** A spot with no tile yet: a pellet (`●`, a power pellet, in the last row's corners). */
const pellet = (h, Box, Text, key, glyph) =>
  h(Box, { key, width: TILE }, h(Text, { color: PALETTE.pellet }, ` ${glyph} `))

/** Row `r` of the board: scored tiles, the row being typed (with its ▌ cursor), or pellets. */
const tileRow = (h, Box, Text, game, draft, r) => {
  const played = game.guesses[r]
  const isActive = r === game.guesses.length && game.status === 'playing'
  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => {
    const key = `t${r}-${i}`
    if (played) {
      const look = tileLook(played.score[i])

      return tile(h, Box, Text, key, look.fill, played.word[i].toUpperCase(), look.letter)
    }
    if (isActive && draft[i]) return tile(h, Box, Text, key, PALETTE.active, draft[i].toUpperCase(), PALETTE.text)
    if (isActive && i === draft.length) return tile(h, Box, Text, key, PALETTE.active, '▌', PALETTE.accent)
    if (isActive) return tile(h, Box, Text, key, PALETTE.active, ' ', PALETTE.text)
    const isPower = r === MAX_GUESSES - 1 && (i === 0 || i === WORD_LENGTH - 1)

    return pellet(h, Box, Text, key, isPower ? '●' : '•')
  })

  return h(Box, { key: `row${r}`, flexDirection: 'row', gap: 1 }, ...cells)
}

/** A key chip: a filled 3×1 Box holding a plain Button (a Button's label can't be colored, only the chip). */
const chip = (h, Box, Button, boxKey, fill, button) =>
  h(Box, { key: boxKey, width: TILE, backgroundColor: fill, justifyContent: 'center' }, h(Button, { plain: true, ...button }))

/** The on-screen keyboard: chips colored by best known state; a known miss is just a dim · (an eaten pellet). */
const keyboard = (h, Box, Text, Button, game, on) => {
  const states = keyStates(game)
  const isOver = game.status !== 'playing'
  const rows = KEY_ROWS.map((row, i) => {
    const keys = [...row].map(ch => {
      const look = keyLook(states[ch])
      if (look.isEaten) {
        return h(Box, { key: `kx-${ch}`, width: TILE, justifyContent: 'center' }, h(Text, { color: PALETTE.dim }, '·'))
      }

      return chip(h, Box, Button, `kc-${ch}`, look.fill, { key: `k-${ch}`, label: ch.toUpperCase(), dimColor: isOver, onPress: () => on.letter(ch) })
    })
    if (i === 2) {
      keys.unshift(chip(h, Box, Button, 'kc-enter', PALETTE.accent, { key: 'enter', label: '⏎', dimColor: isOver, onPress: () => on.enter() }))
      keys.push(chip(h, Box, Button, 'kc-back', PALETTE.keyIdle, { key: 'back', label: '⌫', dimColor: isOver, onPress: () => on.backspace() }))
    }

    return h(Box, { key: `krow${i}`, flexDirection: 'row', gap: 1, justifyContent: i === 1 ? 'center' : 'flex-start', width: KEYBOARD_WIDTH }, ...keys)
  })

  return h(Box, { key: 'keyboard', flexDirection: 'column' }, ...rows)
}

/** READY! (before guess 1) · GUESS N OF 6 · LIVES ◆◆◆◇◇◇; once the game ends, how it ended. */
const statusRow = (h, Box, Text, game) => {
  const n = game.guesses.length
  const progress =
    game.status === 'won'
      ? h(Text, { key: 'progress', color: PALETTE.correct, bold: true }, `SOLVED IN ${n}/${MAX_GUESSES}`)
      : game.status === 'lost'
        ? h(Text, { key: 'progress', color: PALETTE.present, bold: true }, `THE WORD WAS ${game.answer.toUpperCase()}`)
        : h(Text, { key: 'progress', color: PALETTE.text, bold: true }, `GUESS ${n + 1} OF ${MAX_GUESSES}`)

  return h(
    Box,
    { key: 'status', flexDirection: 'row', gap: 3 },
    game.status === 'playing' && n === 0 && h(Text, { key: 'ready', color: PALETTE.ready, bold: true }, 'READY!'),
    progress,
    h(Box, { key: 'lives', flexDirection: 'row', gap: 1 }, h(Text, { color: PALETTE.lives, bold: true }, 'LIVES'), h(Text, { color: PALETTE.lives }, livesText(game))),
  )
}

const statPair = (h, Box, Text, key, label, color, value) =>
  h(Box, { key, flexDirection: 'row', gap: 1 }, h(Text, { color, bold: true }, label), h(Text, { color: PALETTE.text, bold: true }, value))

/** STREAK 04  BEST 09  WIN% 82  STAGE ◀ 27 SEP ▶ */
const statsStageRow = (h, Box, Text, Button, { stats, puzzle, today }, on) => {
  const date = puzzle?.date ?? today
  const prev = stepStage(date, today, -1)
  const next = stepStage(date, today, 1)
  const arrow = (key, glyph, target, dir) =>
    target ? h(Button, { key, label: glyph, plain: true, onPress: () => on.stepStage(dir) }) : h(Text, { key, color: PALETTE.dim }, ' ')

  return h(
    Box,
    { key: 'stats', flexDirection: 'row', gap: 2 },
    statPair(h, Box, Text, 'streak', 'STREAK', PALETTE.streak, pad(stats.currentStreak, 2)),
    statPair(h, Box, Text, 'best', 'BEST', PALETTE.best, pad(stats.maxStreak, 2)),
    statPair(h, Box, Text, 'win', 'WIN%', PALETTE.winPercent, pad(winPercent(stats), 2)),
    h(
      Box,
      { key: 'stage', flexDirection: 'row', gap: 1 },
      h(Text, { color: PALETTE.stage, bold: true }, 'STAGE'),
      arrow('stage-prev', '◀', prev, -1),
      h(Text, { color: PALETTE.text, bold: true }, stageLabel(date)),
      arrow('stage-next', '▶', next, 1),
    ),
  )
}

/** The right-hand column: status, typing field, keyboard, stats and stage, in the reference's 7 rows. */
const controls = (h, ui, view, on) => {
  const { Box, Text, Button, Input } = ui
  const { game, draft, isFieldBlanked } = view
  const isOver = game.status !== 'playing'

  return h(
    Box,
    { key: 'controls', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, paddingX: RIGHT_PAD },
    statusRow(h, Box, Text, game),
    // The typing surface: the field edits `draft` natively (Backspace deletes the last
    // letter, Enter submits); the chips feed the same draft. It sits where the reference
    // has a blank row, so the pane is no taller for it.
    isOver
      ? h(Box, { key: 'no-field', height: 1 })
      : h(Input, {
          key: 'guess',
          label: 'TYPE',
          placeholder: 'a five-letter word',
          // drawn empty for a moment to make the field take the draft again (see resyncField)
          value: isFieldBlanked ? '' : draft,
          autoFocus: true,
          submitLabel: 'guess',
          onInput: text => on.input(text),
          onSubmit: () => on.enter(),
        }),
    keyboard(h, Box, Text, Button, game, on),
    h(Text, { key: 'gap' }, ' '),
    statsStageRow(h, Box, Text, Button, view, on),
  )
}

/** The board column: six tile rows, nothing between them. */
const board = (h, Box, Text, game, draft) =>
  h(
    Box,
    { key: 'board', flexDirection: 'column', width: LEFT_COL, paddingX: LEFT_PAD, paddingY: FRAME_PADDING },
    ...Array.from({ length: MAX_GUESSES }, (_, r) => tileRow(h, Box, Text, game, draft, r)),
  )

/** The faint line between board and controls: one column of │, as tall as the frame's body. */
const divider = (h, Box, Text) =>
  h(
    Box,
    { key: 'divider', flexDirection: 'column', width: 1 },
    ...Array.from({ length: MAX_GUESSES + FRAME_PADDING * 2 }, (_, i) => h(Text, { key: `d${i}`, color: PALETTE.divider }, '│')),
  )

/** The WORDLE badge: bold spaced letters in the background color on a title-colored fill, ▐ ▌ in the accent color on each side. */
const badge = (h, Box, Text) =>
  h(
    Box,
    { key: 'badge', flexDirection: 'row' },
    h(Text, { color: PALETTE.accent }, '▐'),
    h(Text, { color: PALETTE.background, backgroundColor: PALETTE.title, bold: true }, ' W O R D L E '),
    h(Text, { color: PALETTE.accent }, '▌'),
  )

const headerCell = (h, Box, Text, key, label, value) =>
  h(Box, { key, flexDirection: 'row', gap: 1 }, h(Text, { color: PALETTE.title, bold: true }, label), h(Text, { color: PALETTE.text, bold: true }, value))

/** The text after the badge: a practice stage, or a puzzle the new day has turned into practice. */
const subtitle = (h, Text, puzzle, today) => {
  if (!puzzle || puzzle.date === today) return null
  // `isToday` is what the puzzle was when it loaded: if the day has since rolled
  // over, this is no longer today's puzzle even though it started as one
  if (puzzle.isToday) {
    return h(Text, { key: 'subtitle', color: PALETTE.present, bold: true }, `A NEW DAY HAS STARTED · ${stageLabel(puzzle.date)} IS NOW PRACTICE`)
  }

  return h(Text, { key: 'subtitle', color: PALETTE.subtitle, bold: true }, 'PRACTICE STAGE')
}

/**
 * A big on-demand container under the compact layout (▾ MORE, DATE…): its own round
 * frame, as wide as the one above. It may be as tall as it likes; the person scrolls to it.
 */
const drawer = (h, Box, Text, key, title, ...children) =>
  h(
    Box,
    { key, flexDirection: 'column', gap: 1, borderStyle: 'round', borderColor: PALETTE.walls, backgroundColor: PALETTE.panel, paddingX: 2, paddingY: 1 },
    h(Text, { color: PALETTE.title, bold: true }, title),
    ...children,
  )

/** ▾ MORE: games played, the 1–6 distribution as bars, and Clear stats. */
const statsDrawer = (h, Box, Text, Button, stats, isConfirmingClear, on) => {
  const most = Math.max(1, ...stats.distribution)
  const bars = stats.distribution.map((n, i) => {
    const width = n === 0 ? 0 : Math.max(1, Math.round((n / most) * BAR_WIDTH))

    return h(
      Box,
      { key: `dist${i}`, flexDirection: 'row', gap: 1 },
      h(Text, { color: PALETTE.dim }, String(i + 1)),
      h(Text, { color: PALETTE.correct }, width > 0 ? '█'.repeat(width) : ''),
      h(Text, { color: n === 0 ? PALETTE.dim : PALETTE.text, bold: n > 0 }, String(n)),
    )
  })

  return drawer(
    h,
    Box,
    Text,
    'stats-details',
    'STATS',
    h(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      h(Text, { color: PALETTE.text, bold: true }, `PLAYED ${stats.played} · WON ${stats.wins}`),
      // dim until the pointer or focus is on it; the first press only arms it
      h(Button, {
        key: 'clear-stats',
        label: isConfirmingClear ? 'PRESS AGAIN TO CLEAR' : 'CLEAR STATS',
        plain: true,
        dimColor: !isConfirmingClear,
        onPress: () => on.clearStats(),
      }),
    ),
    h(Box, { flexDirection: 'column' }, h(Text, { color: PALETTE.dim }, 'WINS BY GUESS'), ...bars),
  )
}

/** DATE…: pick one of the last 14 days from a list, or type any past date, to play it as a practice stage. */
const dateDrawer = (h, Box, Text, Input, Select, { puzzle, today }, on) => {
  const dates = recentDates(today)
  const options = dates.map(date => ({ value: date, label: date === today ? `${stageLabel(date)} · ${date} (today)` : `${stageLabel(date)} · ${date}` }))

  return drawer(
    h,
    Box,
    Text,
    'date-drawer',
    'PICK A STAGE',
    h(Select, {
      key: 'archive-pick',
      label: 'Last 14 days', // the Select draws its own colon after it
      options,
      value: puzzle && dates.includes(puzzle.date) ? puzzle.date : today,
      onSelect: value => on.pickDate(value),
    }),
    // no autoFocus: the guess field owns the keyboard, letters here would be lost guesses
    h(Input, { key: 'archive-date', label: 'Or a date', placeholder: 'YYYY-MM-DD', submitLabel: 'play', onSubmit: text => on.pickDate(text) }),
    h(Text, { color: PALETTE.dim }, 'ANY DAY FROM 2021-06-19 UP TO TODAY · PRACTICE STAGES DON’T COUNT TOWARD YOUR STATS'),
  )
}

/**
 * The pane's tree for one game state. Pure: the caller supplies the element
 * factory `h`, the surface's elements, and the press callbacks, so this file
 * never touches the engine's `$`.
 *
 * @param ui `{ h, Box, Text, Button, Input, Select }`
 * @param view `{ game, draft, puzzle, today, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen, isFieldBlanked, celebrationFrame, isMotionReduced, screen, layout }`; `celebrationFrame` >= 0 shows the win screen instead of the board; `screen` is `{ columns, rows }`, the win screen's size; `layout` is `{ columns }`, the pane body's width, which picks side by side or stacked; `game` null means still loading
 * @param on `{ letter(ch), enter(), backspace(), input(text), pickDate(date), stepStage(dir), toggleStats(), toggleDateEntry(), clearStats(), fallbackInfo(), skipCelebration() }`
 */
export const renderBoard = (ui, view, on) => {
  const { h, Box, Text, Button, Input, Select } = ui
  const { game, draft, puzzle, today, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen, celebrationFrame, isMotionReduced, screen, layout } = view
  if (celebrationFrame >= 0) return celebrationScreen(h, Box, Text, Button, celebrationFrame, screen, isMotionReduced, on)
  if (!game) {
    return h(Box, { flexDirection: 'column', backgroundColor: PALETTE.background }, h(Text, { color: PALETTE.dim }, 'LOADING TODAY’S STAGE…'))
  }

  const isSideBySide = layout.columns >= SIDE_BY_SIDE_MIN
  const width = Math.min(layout.columns, MAX_WIDTH)
  const isOver = game.status !== 'playing'
  const date = puzzle?.date ?? today

  return h(
    Box,
    { flexDirection: 'column', width, backgroundColor: PALETTE.background },
    h(
      Box,
      { key: 'header', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 2 },
      h(
        Box,
        { key: 'header-left', flexDirection: 'row', columnGap: 2 },
        badge(h, Box, Text),
        subtitle(h, Text, puzzle, today),
        puzzle?.source === 'fallback' && h(Button, { key: 'fallback-warning', label: '⚠ OFFLINE', plain: true, onPress: () => on.fallbackInfo() }),
      ),
      h(
        Box,
        { key: 'header-right', flexDirection: 'row', columnGap: 3 },
        headerCell(h, Box, Text, 'score', '1UP', pad(gameScore(game), 5)),
        headerCell(h, Box, Text, 'hi-score', 'HI', pad(hiScore(stats), 5)),
        headerCell(h, Box, Text, 'stage-date', 'STAGE', stageLabel(date)),
      ),
    ),
    h(
      Box,
      {
        key: 'frame',
        flexDirection: isSideBySide ? 'row' : 'column',
        alignItems: isSideBySide ? 'stretch' : 'center',
        borderStyle: 'round',
        borderColor: PALETTE.walls,
        backgroundColor: PALETTE.panel,
      },
      board(h, Box, Text, game, draft),
      isSideBySide && divider(h, Box, Text),
      controls(h, ui, view, on),
    ),
    h(
      Box,
      { key: 'footer', flexDirection: 'row', justifyContent: 'space-between' },
      h(
        Box,
        { key: 'hint', flexDirection: 'row' },
        isOver
          ? h(Text, { color: PALETTE.dim }, '◀ ▶ PICK ANOTHER STAGE · ESC TO EXIT')
          : [
              h(Text, { key: 'h0', color: PALETTE.dim }, 'TYPE TO PLAY · '),
              h(Button, { key: 'hotkey-enter', label: '⏎ ENTER', plain: true, dimColor: true, onPress: () => on.enter() }),
              h(Text, { key: 'h1', color: PALETTE.dim }, ' · '),
              h(Button, { key: 'hotkey-back', label: '⌫ DELETE', plain: true, dimColor: true, onPress: () => on.backspace() }),
              h(Text, { key: 'h2', color: PALETTE.dim }, ' · ESC TO EXIT'),
            ],
      ),
      h(
        Box,
        { key: 'footer-right', flexDirection: 'row', columnGap: 3, paddingRight: 6 },
        date !== today && h(Button, { key: 'play-today', label: '▶ TODAY', plain: true, onPress: () => on.pickDate(today) }),
        h(Button, { key: 'date-entry', label: isDateEntryOpen ? '▴ DATE…' : 'DATE…', plain: true, dimColor: true, onPress: () => on.toggleDateEntry() }),
        h(Button, { key: 'stats-toggle', label: isStatsOpen ? '▴ LESS' : '▾ MORE', plain: true, dimColor: true, onPress: () => on.toggleStats() }),
      ),
    ),
    isStatsOpen && statsDrawer(h, Box, Text, Button, stats, isConfirmingClear, on),
    isDateEntryOpen && dateDrawer(h, Box, Text, Input, Select, view, on),
  )
}

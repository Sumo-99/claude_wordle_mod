import { blockTitle, gameScore, hiScore, keyLook, livesText, pad, PALETTE, stageLabel, stepStage, tileLook } from './arcade.js'
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

// ---- the arcade board (docs/ui-ref/wordle-ui-final.png) ----

const TILE = 5 // columns per tile and per key; a tile is 3 rows tall
const WIDE_KEY = 6 // ⏎ and ⌫: their hotkey draws in front of the glyph (`1: ⏎`)
const BOARD_WIDTH = WORD_LENGTH * TILE + (WORD_LENGTH - 1)
const KEYBOARD_WIDTH = KEY_ROWS[0].length * TILE
const LEFT_PAD = 2
const RIGHT_PAD = 1
const LEFT_PANEL = BOARD_WIDTH + 2 + LEFT_PAD * 2 // + the double walls
const RIGHT_PANEL = KEYBOARD_WIDTH + 2 + RIGHT_PAD * 2
/** Below this many columns the controls panel drops under the board. */
export const SIDE_BY_SIDE_MIN = LEFT_PANEL + 1 + RIGHT_PANEL
/** Below this many columns the block-letter title becomes a plain bold WORDLE. */
export const BLOCK_TITLE_MIN = 70
const BAR_WIDTH = 10

/**
 * How much the pane's height lets the board spread out, from `scroll.bodyRows`
 * (unknown is roomy): `full` is the reference; `snug` drops the blank rows
 * (between tile rows, inside the walls, around the title); `tight` also
 * flattens each tile to its one middle row and the title and header to one row
 * each. The rows each needs, side by side and stacked, were measured live.
 */
const ROWS_NEEDED = { sideBySide: { full: 38, snug: 27 }, stacked: { full: 63, snug: 46 } }
export const densityFor = (rows, isSideBySide) => {
  const need = ROWS_NEEDED[isSideBySide ? 'sideBySide' : 'stacked']

  return rows == null || rows >= need.full ? 'full' : rows >= need.snug ? 'snug' : 'tight'
}

/**
 * One tile: 5 columns × 3 rows, pixel-rounded (▗▄▄▄▖ / a solid middle / ▝▀▀▀▘)
 * in `fill`, with `middle` (5 columns) drawn in `color` across the fill. A flat
 * tile (short panes) is the middle row alone.
 */
const tile = (h, Box, Text, isFlat, key, fill, middle, color) =>
  h(
    Box,
    { key, flexDirection: 'column', width: TILE },
    !isFlat && h(Text, { color: fill }, '▗▄▄▄▖'),
    h(Text, { color, backgroundColor: fill, bold: true }, middle),
    !isFlat && h(Text, { color: fill }, '▝▀▀▀▘'),
  )

/** A spot with no tile yet: a pellet in the middle row (`●`, a power pellet, in the last row's corners). */
const pellet = (h, Box, Text, isFlat, key, glyph) =>
  h(
    Box,
    { key, flexDirection: 'column', width: TILE },
    !isFlat && h(Text, null, ' '.repeat(TILE)),
    h(Text, { color: PALETTE.pellet }, `  ${glyph}  `),
    !isFlat && h(Text, null, ' '.repeat(TILE)),
  )

/** Row `r` of the board: scored tiles, the row being typed (with its ▌ cursor), or pellets. */
const tileRow = (h, Box, Text, isFlat, game, draft, r) => {
  const played = game.guesses[r]
  const isActive = r === game.guesses.length && game.status === 'playing'
  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => {
    const key = `t${r}-${i}`
    if (played) {
      const look = tileLook(played.score[i])

      return tile(h, Box, Text, isFlat, key, look.fill, `  ${played.word[i].toUpperCase()}  `, look.letter)
    }
    if (isActive && draft[i]) return tile(h, Box, Text, isFlat, key, PALETTE.active, `  ${draft[i].toUpperCase()}  `, PALETTE.text)
    if (isActive && i === draft.length) return tile(h, Box, Text, isFlat, key, PALETTE.active, '  ▌  ', PALETTE.accent)
    if (isActive) return tile(h, Box, Text, isFlat, key, PALETTE.active, ' '.repeat(TILE), PALETTE.text)
    const isPower = r === MAX_GUESSES - 1 && (i === 0 || i === WORD_LENGTH - 1)

    return pellet(h, Box, Text, isFlat, key, isPower ? '●' : '•')
  })

  return h(Box, { key: `row${r}`, flexDirection: 'row', gap: 1 }, ...cells)
}

/** A key in double-line walls; only the walls can be colored (a Button's label can't). */
const framedKey = (h, Box, Button, { boxKey, border, width = TILE }, button) =>
  h(
    Box,
    { key: boxKey, borderStyle: 'double', borderColor: border, width, height: 3, justifyContent: 'center' },
    h(Button, { plain: true, ...button }),
  )

/** The on-screen keyboard: framed keys by best known state; a known miss is just a dim · (an eaten pellet). */
const keyboard = (h, Box, Text, Button, game, on) => {
  const states = keyStates(game)
  const isOver = game.status !== 'playing'
  const rows = KEY_ROWS.map((row, i) => {
    const keys = [...row].map(ch => {
      const look = keyLook(states[ch])
      if (look.isEaten) {
        return h(
          Box,
          { key: `kx-${ch}`, width: TILE, height: 3, justifyContent: 'center', alignItems: 'center' },
          h(Text, { color: PALETTE.dim }, '·'),
        )
      }

      return framedKey(h, Box, Button, { boxKey: `kc-${ch}`, border: look.border }, {
        key: `k-${ch}`,
        label: ch.toUpperCase(),
        dimColor: isOver,
        onPress: () => on.letter(ch),
      })
    })
    if (i === 2) {
      keys.unshift(
        framedKey(h, Box, Button, { boxKey: 'kc-enter', border: PALETTE.accent, width: WIDE_KEY }, {
          key: 'enter',
          label: '⏎',
          hotkey: ENTER_KEY,
          dimColor: isOver,
          onPress: () => on.enter(),
        }),
      )
      keys.push(
        framedKey(h, Box, Button, { boxKey: 'kc-back', border: PALETTE.keyIdle, width: WIDE_KEY }, {
          key: 'back',
          label: '⌫',
          hotkey: BACKSPACE_KEY,
          dimColor: isOver,
          onPress: () => on.backspace(),
        }),
      )
    }

    return h(Box, { key: `krow${i}`, flexDirection: 'row', justifyContent: 'center' }, ...keys)
  })

  return h(Box, { key: 'keyboard', flexDirection: 'column', width: KEYBOARD_WIDTH }, ...rows)
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

/** STREAK 04   BEST 09   WIN% 82, and the control that opens the details. */
const statsRow = (h, Box, Text, Button, stats, isStatsOpen, on) =>
  h(
    Box,
    { key: 'stats', flexDirection: 'row', gap: 3 },
    statPair(h, Box, Text, 'streak', 'STREAK', PALETTE.streak, pad(stats.currentStreak, 2)),
    statPair(h, Box, Text, 'best', 'BEST', PALETTE.best, pad(stats.maxStreak, 2)),
    statPair(h, Box, Text, 'win', 'WIN%', PALETTE.winPercent, pad(winPercent(stats), 2)),
    h(Button, { key: 'stats-toggle', label: isStatsOpen ? '▴ LESS' : '▾ MORE', plain: true, dimColor: true, onPress: () => on.toggleStats() }),
  )

/** The details under the stats row: games played, the 1–6 distribution, and Clear stats. */
const statsDetails = (h, Box, Text, Button, stats, isConfirmingClear, on) => {
  const most = Math.max(1, ...stats.distribution)
  const bars = stats.distribution.map((n, i) => {
    const width = n === 0 ? 0 : Math.max(1, Math.round((n / most) * BAR_WIDTH))

    return h(
      Box,
      { key: `dist${i}`, flexDirection: 'row', gap: 1 },
      h(Text, { color: PALETTE.dim }, String(i + 1)),
      width > 0 && h(Text, { color: PALETTE.correct }, '█'.repeat(width)),
      h(Text, { color: n === 0 ? PALETTE.dim : PALETTE.text }, String(n)),
    )
  })

  return h(
    Box,
    { key: 'stats-details', flexDirection: 'column' },
    h(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      h(Text, { color: PALETTE.text }, `PLAYED ${stats.played} · WON ${stats.wins}`),
      // dim until the pointer or focus is on it; the first press only arms it
      h(Button, {
        key: 'clear-stats',
        label: isConfirmingClear ? 'PRESS AGAIN TO CLEAR' : 'CLEAR STATS',
        plain: true,
        dimColor: !isConfirmingClear,
        onPress: () => on.clearStats(),
      }),
    ),
    ...bars,
  )
}

/** STAGE ◀ 27 SEP ▶   ▶ TODAY   DATE…: step through the last 14 days, or type one. */
const stageRow = (h, Box, Text, Button, { puzzle, today }, on) => {
  const date = puzzle?.date ?? today
  const prev = stepStage(date, today, -1)
  const next = stepStage(date, today, 1)
  const arrow = (key, glyph, target, dir) =>
    target ? h(Button, { key, label: glyph, plain: true, onPress: () => on.stepStage(dir) }) : h(Text, { key, color: PALETTE.dim }, ' ')

  return h(
    Box,
    { key: 'stage', flexDirection: 'row', gap: 3 },
    h(
      Box,
      { key: 'stage-step', flexDirection: 'row', gap: 1 },
      h(Text, { color: PALETTE.stage, bold: true }, 'STAGE'),
      arrow('stage-prev', '◀', prev, -1),
      h(Text, { color: PALETTE.text, bold: true }, stageLabel(date)),
      arrow('stage-next', '▶', next, 1),
    ),
    date !== today && h(Button, { key: 'play-today', label: '▶ TODAY', plain: true, onPress: () => on.pickDate(today) }),
    h(Button, { key: 'date-entry', label: 'DATE…', plain: true, dimColor: true, onPress: () => on.toggleDateEntry() }),
  )
}

const divider = (h, Text) => h(Text, { key: 'divider', color: PALETTE.walls }, '─'.repeat(KEYBOARD_WIDTH))

/** The right-hand panel: status, typing field, keyboard, divider, stats, stage, hint. */
const controlsPanel = (h, ui, view, density, on) => {
  const { Box, Text, Button, Input } = ui
  const { game, draft, puzzle, isFieldBlanked, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen } = view
  const isOver = game.status !== 'playing'

  return h(
    Box,
    {
      key: 'controls',
      flexDirection: 'column',
      // roomy: a blank row between sections; short: the sections spread over the walls' height
      gap: density === 'full' ? 1 : 0,
      justifyContent: density === 'full' ? 'flex-start' : 'space-between',
      width: RIGHT_PANEL,
      borderStyle: 'double',
      borderColor: PALETTE.walls,
      backgroundColor: PALETTE.panel,
      paddingX: RIGHT_PAD,
      paddingY: density === 'full' ? 1 : 0,
    },
    statusRow(h, Box, Text, game),
    puzzle?.source === 'fallback' &&
      h(Button, { key: 'fallback-warning', label: '⚠ OFFLINE PUZZLE', plain: true, onPress: () => on.fallbackInfo() }),
    // The typing surface: the field edits `draft` natively (Backspace deletes the
    // last letter, Enter submits); the on-screen keys feed the same draft.
    !isOver &&
      h(Input, {
        key: 'guess',
        label: 'TYPE', // the field draws its own colon after it
        placeholder: 'a five-letter word',
        // drawn empty for a moment to make the field take the draft again (see resyncField)
        value: isFieldBlanked ? '' : draft,
        autoFocus: true,
        submitLabel: 'guess',
        onInput: text => on.input(text),
        onSubmit: () => on.enter(),
      }),
    keyboard(h, Box, Text, Button, game, on),
    divider(h, Text),
    statsRow(h, Box, Text, Button, stats, isStatsOpen, on),
    isStatsOpen && statsDetails(h, Box, Text, Button, stats, isConfirmingClear, on),
    stageRow(h, Box, Text, Button, view, on),
    // no autoFocus: the guess field owns the keyboard, letters here would be lost guesses
    isDateEntryOpen &&
      h(Input, {
        key: 'archive-date',
        label: 'DATE', // the field draws its own colon after it
        placeholder: 'YYYY-MM-DD',
        submitLabel: 'play',
        onSubmit: text => on.pickDate(text),
      }),
    h(
      Text,
      { key: 'hint', color: PALETTE.dim },
      isOver ? '◀ ▶ PICK ANOTHER STAGE · ESC TO EXIT' : 'TYPE TO PLAY · ESC TO EXIT',
    ),
  )
}

const boardPanel = (h, Box, Text, density, game, draft) =>
  h(
    Box,
    {
      key: 'board',
      flexDirection: 'column',
      // flat tiles leave room for the blank rows again; snug 3-row tiles can't spare them
      gap: density === 'snug' ? 0 : 1,
      justifyContent: 'center',
      width: LEFT_PANEL,
      borderStyle: 'double',
      borderColor: PALETTE.walls,
      backgroundColor: PALETTE.panel,
      paddingX: LEFT_PAD,
      paddingY: density === 'full' ? 1 : 0,
    },
    ...Array.from({ length: MAX_GUESSES }, (_, r) => tileRow(h, Box, Text, density === 'tight', game, draft, r)),
  )

const headerCell = (h, Box, Text, isFlat, key, label, value, align) =>
  h(
    Box,
    { key, flexDirection: isFlat ? 'row' : 'column', alignItems: align, gap: isFlat ? 1 : 0 },
    h(Text, { color: PALETTE.title, bold: true }, label),
    h(Text, { color: PALETTE.text, bold: true }, value),
  )

/** The line under the title: a practice stage, or a puzzle the new day has turned into practice. */
const subtitle = (h, Text, puzzle, today) => {
  if (!puzzle || puzzle.date === today) return null
  // `isToday` is what the puzzle was when it loaded: if the day has since rolled
  // over, this is no longer today's puzzle even though it started as one
  if (puzzle.isToday) {
    return h(Text, { key: 'subtitle', color: PALETTE.present, bold: true }, `── A NEW DAY HAS STARTED · ${stageLabel(puzzle.date)} IS NOW PRACTICE ──`)
  }

  return h(Text, { key: 'subtitle', color: PALETTE.subtitle, bold: true }, '── PRACTICE STAGE ──')
}

/**
 * The pane's tree for one game state. Pure: the caller supplies the element
 * factory `h`, the surface's elements, and the press callbacks, so this file
 * never touches the engine's `$`.
 *
 * @param ui `{ h, Box, Text, Button, Input }`
 * @param view `{ game, draft, puzzle, today, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen, isFieldBlanked, celebrationFrame, isMotionReduced, screen, layout }`; `celebrationFrame` >= 0 shows the win screen instead of the board; `screen` is `{ columns, rows }`, the win screen's size; `layout` is `{ columns, rows }`, the pane body's room (rows may be unknown), which picks the board's layout and density; `game` null means still loading
 * @param on `{ letter(ch), enter(), backspace(), input(text), pickDate(date), stepStage(dir), toggleStats(), toggleDateEntry(), clearStats(), fallbackInfo(), skipCelebration() }`
 */
export const renderBoard = (ui, view, on) => {
  const { h, Box, Text, Button } = ui
  const { game, draft, puzzle, today, stats, celebrationFrame, isMotionReduced, screen, layout } = view
  if (celebrationFrame >= 0) return celebrationScreen(h, Box, Text, Button, celebrationFrame, screen, isMotionReduced, on)
  if (!game) {
    return h(Box, { flexDirection: 'column', backgroundColor: PALETTE.background }, h(Text, { color: PALETTE.dim }, 'LOADING TODAY’S STAGE…'))
  }

  const isSideBySide = layout.columns >= SIDE_BY_SIDE_MIN
  const width = isSideBySide ? SIDE_BY_SIDE_MIN : Math.min(layout.columns, RIGHT_PANEL)
  const density = densityFor(layout.rows, isSideBySide)
  const space = density === 'full' ? 1 : 0
  const isTight = density === 'tight'
  const title =
    layout.columns >= BLOCK_TITLE_MIN && !isTight
      ? h(Box, { key: 'title', flexDirection: 'column' }, ...blockTitle().map((line, i) => h(Text, { key: `title${i}`, color: PALETTE.title }, line)))
      : h(Box, { key: 'title' }, h(Text, { color: PALETTE.title, bold: true }, 'WORDLE'))

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', backgroundColor: PALETTE.background, paddingY: space },
    h(
      Box,
      { key: 'header', flexDirection: 'row', justifyContent: 'space-between', width },
      headerCell(h, Box, Text, isTight, 'score', '1UP', pad(gameScore(game), 5), 'flex-start'),
      headerCell(h, Box, Text, isTight, 'hi-score', 'HI-SCORE', pad(hiScore(stats), 5), 'center'),
      headerCell(h, Box, Text, isTight, 'stage-date', 'STAGE', stageLabel(puzzle?.date ?? today), 'flex-end'),
    ),
    h(Box, { key: 'title-wrap', marginTop: space }, title),
    subtitle(h, Text, puzzle, today),
    h(
      Box,
      { key: 'panels', flexDirection: isSideBySide ? 'row' : 'column', alignItems: isSideBySide ? 'stretch' : 'center', gap: 1, marginTop: space },
      boardPanel(h, Box, Text, density, game, draft),
      controlsPanel(h, ui, view, density, on),
    ),
  )
}

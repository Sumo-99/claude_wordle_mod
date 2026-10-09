import { recentDates } from './archive.js'
import { gameScore, hiScore, keyLook, livesText, pad, PALETTE, stageLabel, stepStage, tileLook } from './arcade.js'
import { celebrationRows, MIN_COLUMNS, MIN_ROWS } from './fireworks.js'
import { MAX_GUESSES, WORD_LENGTH } from './game-engine.js'
import { formatCount, longDate, nextDailyIn, recentUnplayed, remaining } from './picker.js'
import { skipButton, splashLayout, splashRows } from './splash.js'
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

// The finished board's control: opens the picker (a lost board also opens it on its own after a moment).
const CONTINUE_LABEL = '⏎ CONTINUE'

/**
 * The win screen: while it runs it REPLACES the board. Every cell of the pane is
 * painted by `celebrationRows` (a red radial gradient with a turning sunburst,
 * opening out from the centre, the burst and the words on top). It has no control:
 * it always plays to the end, and then the picker opens. `screen` is
 * `{ columns, rows }`, the room the pane has.
 */
const celebrationScreen = (h, Box, Text, frame, screen, reducedMotion) => {
  const columns = Math.max(MIN_COLUMNS, screen.columns)
  const rows = celebrationRows(frame, { columns, rows: Math.max(MIN_ROWS, screen.rows) }, reducedMotion)
  const drawRow = (runs, y) =>
    h(
      Box,
      { key: `fw${y}`, flexDirection: 'row' },
      ...runs.map((run, i) => h(Text, { key: i, color: run.color, bold: run.bold, backgroundColor: run.backgroundColor }, run.text)),
    )

  return h(
    Box,
    { key: 'fireworks-wrap', flexDirection: 'column', alignItems: 'center' },
    h(Box, { key: 'fireworks', flexDirection: 'column', width: columns }, ...rows.map(drawRow)),
  )
}

/** The runs covering columns [from, to) of a row of runs. */
const sliceRuns = (runs, from, to) => {
  const out = []
  let x = 0
  for (const run of runs) {
    const chars = [...run.text]
    const text = chars.slice(Math.max(0, from - x), Math.max(0, to - x)).join('')
    if (text) out.push({ ...run, text })
    x += chars.length
  }

  return out
}

/**
 * The opening splash: while it runs it REPLACES the pane, as the win screen does.
 * `splashRows` paints the picture (centred; a bigger pane doesn't stretch it); the
 * skip line's `1: label` is a real Button (a click or `1` skips). Typed keys skip
 * too: they land in a key-catcher field drawn zero rows tall, so the picture keeps
 * its rows and the letter never reaches the guess. `splash` is `{ frame, opts }`.
 */
const splashScreen = (ui, splash, layout, on) => {
  const { h, Box, Text, Button, Input } = ui
  const screen = { columns: layout.columns, rows: layout.rows }
  const { columns } = splashLayout(screen)
  const skip = skipButton(splash.frame, screen, splash.opts)
  const drawRuns = (runs, prefix) =>
    runs.map((run, i) => h(Text, { key: `${prefix}${i}`, color: run.color, bold: run.bold, backgroundColor: run.backgroundColor }, run.text))
  const drawRow = (runs, y) => {
    if (skip?.row !== y) return h(Box, { key: `sp${y}`, flexDirection: 'row' }, ...drawRuns(runs, 'r'))
    const end = skip.column + skip.hotkey.length + 2 + skip.label.length

    return h(
      Box,
      { key: `sp${y}`, flexDirection: 'row', backgroundColor: PALETTE.background },
      ...drawRuns(sliceRuns(runs, 0, skip.column), 'a'),
      h(Button, { key: 'skip-splash', label: skip.label, hotkey: skip.hotkey, plain: true, dimColor: true, onPress: () => on.skipSplash() }),
      ...drawRuns(sliceRuns(runs, end, columns), 'b'),
    )
  }

  return h(
    Box,
    { key: 'splash-wrap', flexDirection: 'column', alignItems: 'center', width: layout.columns },
    h(Box, { key: 'splash', flexDirection: 'column', width: columns }, ...splashRows(splash.frame, screen, splash.opts).map(drawRow)),
    h(
      Box,
      { key: 'splash-keys', height: 0, overflow: 'hidden' },
      h(Input, { key: 'splash-key', value: '', autoFocus: true, submitLabel: 'skip', onInput: () => on.skipSplash(), onSubmit: () => on.skipSplash() }),
    ),
  )
}

// ---- the compact arcade board (docs/ui-ref/wordle-compact-options.png, panel 1) ----

const FRAME_PADDING = 1 // blank rows above and below the board inside the frame
const FRAME_BORDER = 2 // the round frame's two border columns (and its two border rows)
const DIVIDER = 1 // the faint │ between board and controls
const STATS_ROW = 45 // the widest right-hand row other than the keyboard (stats and stage)
const BAR_WIDTH = 24

/** The columns of the board and controls columns with `tile`- and `chip`-wide cells and `pad` either side. */
const sizesFor = (tile, chip, pad) => {
  const keyboard = KEY_ROWS[0].length * (chip + 1) - 1

  return { tile, chip, pad, keyboard, board: WORD_LENGTH * tile + (WORD_LENGTH - 1) + pad * 2, controls: Math.max(keyboard, STATS_ROW) + pad * 2 }
}
const sideBySideWidth = s => FRAME_BORDER + s.board + DIVIDER + s.controls

/** Side by side, widest first: 5-column tiles and chips (99 columns), 5-column tiles (85), all 3 (from 75). */
const SIDE_BY_SIDE = [sizesFor(5, 5, 2), sizesFor(5, 3, 2), sizesFor(3, 3, 2)]
/** From this many columns the controls sit beside the board; narrower, they stack under it. */
export const SIDE_BY_SIDE_MIN = sideBySideWidth(SIDE_BY_SIDE.at(-1))
/** The compact layout's width when there is room (the stage 09 reference): its controls take the extra columns. */
export const COMPACT_WIDTH = 78

/** Stacked: the controls take the widest chips and padding that fit `columns`, the board the widest tiles. */
const stackedSizes = columns => {
  const fits = s => FRAME_BORDER + s.controls <= columns
  const pad = [2, 1, 0].find(p => fits(sizesFor(3, 3, p))) ?? 0
  const chip = fits(sizesFor(3, 5, pad)) ? 5 : 3
  const tile = FRAME_BORDER + sizesFor(5, chip, pad).board <= columns ? 5 : 3

  return sizesFor(tile, chip, pad)
}

/**
 * The board's sizes for a pane body `columns` wide. Side by side (unless
 * `isStacked`): the widest layout that fits, drawn at its own width (centred;
 * the rest is margin). Stacked, or too narrow to sit side by side: board on
 * top, controls under it, at the full body width with the widest cells that fit.
 */
export const boardMetrics = (columns, isStacked = false) => {
  const side = !isStacked && SIDE_BY_SIDE.find(s => sideBySideWidth(s) <= columns)
  if (side === SIDE_BY_SIDE.at(-1)) return { ...side, isSideBySide: true, width: Math.min(columns, COMPACT_WIDTH) }
  if (side) return { ...side, isSideBySide: true, width: sideBySideWidth(side) }

  return { ...stackedSizes(columns), isSideBySide: false, width: columns }
}

// ---- height: the pane stacks when the body has the rows for it ----

// The text the header and footer rows hold at their widest (a practice stage with
// ▶ TODAY showing and DATE… open), so the stacked height doesn't change with the stage.
const BADGE_TEXT = ' W O R D L E '
const PRACTICE_TEXT = 'PRACTICE STAGE'
const HEADER_CELLS = [['1UP', '00000'], ['HI', '00000'], ['STAGE', '27 SEP']]
const HINT_PARTS = ['TYPE TO PLAY · ', '⏎ ENTER', ' · ', '⌫ DELETE', ' · ESC TO EXIT']
const FOOTER_BUTTONS = ['▶ TODAY', '▴ DATE…', '▾ MORE']
const HEADER_GAP = 2 // between the header's two halves, and between the badge and the practice line
const HEADER_CELL_GAP = 3
const FOOTER_GAP = 2 // between the hint and the footer's buttons
const FOOTER_BUTTON_GAP = 3
const FOOTER_RIGHT_PAD = 6

const sum = parts => parts.reduce((n, part) => n + part, 0)
const HEADER_WIDTH =
  1 + BADGE_TEXT.length + 1 + HEADER_GAP + PRACTICE_TEXT.length + HEADER_GAP +
  sum(HEADER_CELLS.map(([label, value]) => label.length + 1 + value.length)) + HEADER_CELL_GAP * (HEADER_CELLS.length - 1)
const FOOTER_WIDTH =
  sum(HINT_PARTS.map(part => part.length)) + FOOTER_GAP +
  sum(FOOTER_BUTTONS.map(label => label.length)) + FOOTER_BUTTON_GAP * (FOOTER_BUTTONS.length - 1) + FOOTER_RIGHT_PAD
/** A wrapping row of two halves: one row when it all fits, two when it doesn't. */
const wrappedRows = (width, columns) => (width <= columns ? 1 : 2)
const CONTROL_ROWS = 1 + 1 + KEY_ROWS.length + 1 + 1 // status, field, keyboard, gap, stats and stage

/**
 * How the compact layout gives way when the pane is short (inline it gets about a
 * third of the terminal): first the board's two spare rows, then the blank row above
 * the stats row, then the header, then the frame's border, so the board, the keyboard
 * and the footer bar (DATE…, ▾ MORE) always show. Fullest first. `boardSpare` is the
 * rows the fit keeps for the board beyond its six tile rows; they become gaps between
 * tile rows (see `boardRoom` and `gapRows`).
 */
const COMPACT_FITS = [
  { boardSpare: FRAME_PADDING * 2, hasGap: true, hasHeader: true, hasBorder: true },
  { boardSpare: 0, hasGap: true, hasHeader: true, hasBorder: true },
  { boardSpare: 0, hasGap: false, hasHeader: true, hasBorder: true },
  { boardSpare: 0, hasGap: false, hasHeader: false, hasBorder: true },
  { boardSpare: 0, hasGap: false, hasHeader: true, hasBorder: false },
  { boardSpare: 0, hasGap: false, hasHeader: false, hasBorder: false },
]
/** The frame's inside rows at the least: the taller of the board (with its spare rows) and the controls. */
const fitBodyRows = fit => Math.max(MAX_GUESSES + fit.boardSpare, CONTROL_ROWS - (fit.hasGap ? 0 : 1))
/** The stacked layout's board as its height is measured (the fullest fit's): six tile rows and two spare. */
const BOARD_ROWS = MAX_GUESSES + COMPACT_FITS[0].boardSpare
/** The tallest the board grows: a blank row between every two tile rows. */
const MAX_BOARD_ROWS = MAX_GUESSES * 2 - 1

/** How many rows the stacked layout takes in a body `columns` wide: header, frame (board over controls), footer. */
export const stackedRows = columns =>
  wrappedRows(HEADER_WIDTH, columns) + FRAME_BORDER + BOARD_ROWS + CONTROL_ROWS + wrappedRows(FOOTER_WIDTH, columns)

/**
 * The room the board gets in a pane body `bodyRows` tall, the rest of the layout
 * taking `aroundRows`: `body`, the rows the board's part of the frame takes (side by
 * side, also the controls' and the divider's), and `spare`, the rows of it beyond the
 * six tile rows (0–5), each one a gap between two tile rows. It grows a row at a time
 * with the pane, from the fit's own rows up to a gap between every two tile rows,
 * and no further: past that the pane keeps its compact height. Unknown rows: the fit's own.
 */
export const boardRoom = (least, bodyRows, aroundRows) => {
  const body = bodyRows == null ? least : Math.max(least, Math.min(Math.max(MAX_BOARD_ROWS, least), bodyRows - aroundRows))

  return { body, spare: Math.min(MAX_BOARD_ROWS, body) - MAX_GUESSES }
}

/**
 * Which tile rows get a blank row under them, given `spare` rows to place. Only two
 * filled rows next to each other can run together (a guess, or the row being typed;
 * pellet rows have no fill), so the gaps go where those meet, the newest first: the
 * last guess and the row being typed, then each guess and the one before it. Any
 * left over go under the rows still to come, top down. The count is the pane's,
 * never the game's: the board keeps its height as the guesses come in.
 */
export const gapRows = (game, spare) => {
  const filled = game.guesses.length + (game.status === 'playing' ? 1 : 0)
  const meeting = Array.from({ length: Math.max(0, filled - 1) }, (_, i) => filled - 2 - i)
  const ahead = Array.from({ length: MAX_GUESSES - 1 }, (_, r) => r).filter(r => !meeting.includes(r))

  return new Set([...meeting, ...ahead].slice(0, Math.max(0, spare)))
}
/** A fit's rows: header, frame border, frame body, footer. */
export const fitRows = fit => (fit.hasHeader ? 1 : 0) + (fit.hasBorder ? FRAME_BORDER : 0) + fitBodyRows(fit) + 1
/** The fullest compact layout that fits `bodyRows` (all of it while the rows are unknown). */
export const compactFit = bodyRows => COMPACT_FITS.find(fit => bodyRows == null || fitRows(fit) <= bodyRows) ?? COMPACT_FITS.at(-1)

/** The side-by-side layout's rows with room to spare: header, frame (the board beside the controls), footer. */
export const SIDE_BY_SIDE_ROWS = fitRows(COMPACT_FITS[0])

/** From this many body rows the pane stacks: the stacked layout's own height and two to spare. */
export const stackAt = columns => stackedRows(columns) + 2
/** Once stacked, the pane stays stacked until the body is this many rows short of the threshold. */
export const STACK_GAP = 2

/**
 * Whether the pane draws stacked. Too narrow to sit side by side: always.
 * Otherwise it opens compact, side by side, whatever its height (`openRows`,
 * the rows it opened with, is still unknown on the first draw), and stacks only
 * once the body has grown past those rows to `stackAt` or more (the width
 * fitting the stacked layout). A pane that `wasStacked` keeps stacking until
 * the body is `STACK_GAP` rows short of that, so it doesn't flicker on the edge.
 */
export const isStackedLayout = (columns, bodyRows, wasStacked = false, openRows = null) => {
  if (!boardMetrics(columns).isSideBySide) return true
  if (bodyRows == null || openRows == null) return false
  if (FRAME_BORDER + stackedSizes(columns).controls > columns) return false

  return bodyRows >= Math.max(stackAt(columns), openRows + 1) - (wasStacked ? STACK_GAP : 0)
}

/**
 * The footer's right margin: the full margin when it fits, less when it doesn't,
 * so side by side the footer stays one row (the compact layout's 12) whatever the
 * buttons say. Stacked, the footer wraps instead and keeps the full margin.
 */
const footerPad = (width, hintWidth, labels, isSideBySide) => {
  if (!isSideBySide) return FOOTER_RIGHT_PAD
  const used = hintWidth + FOOTER_GAP + sum(labels.map(label => label.length)) + FOOTER_BUTTON_GAP * (labels.length - 1)

  return Math.max(0, Math.min(FOOTER_RIGHT_PAD, width - used))
}

/** `glyph` centred in an odd `width`: ` X `, `  X  `. */
const centred = (glyph, width) => `${' '.repeat((width - 1) / 2)}${glyph}${' '.repeat((width - 1) / 2)}`

/** One tile: one row, the letter centred on a fill. A letterless tile is just the fill. */
const tile = (h, Box, Text, key, width, fill, letter, color) =>
  h(Box, { key, width }, h(Text, { color, backgroundColor: fill, bold: true }, centred(letter, width)))

/** A spot with no tile yet: a pellet (`●`, a power pellet, in the last row's corners). */
const pellet = (h, Box, Text, key, width, glyph) =>
  h(Box, { key, width }, h(Text, { color: PALETTE.pellet }, centred(glyph, width)))

/** Row `r` of the board: scored tiles, the row being typed (with its ▌ cursor), or pellets; `isGapped`: a blank row under it. */
const tileRow = (h, Box, Text, game, draft, r, width, isGapped) => {
  const played = game.guesses[r]
  const isActive = r === game.guesses.length && game.status === 'playing'
  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => {
    const key = `t${r}-${i}`
    if (played) {
      const look = tileLook(played.score[i])

      return tile(h, Box, Text, key, width, look.fill, played.word[i].toUpperCase(), look.letter)
    }
    if (isActive && draft[i]) return tile(h, Box, Text, key, width, PALETTE.active, draft[i].toUpperCase(), PALETTE.text)
    if (isActive && i === draft.length) return tile(h, Box, Text, key, width, PALETTE.active, '▌', PALETTE.accent)
    if (isActive) return tile(h, Box, Text, key, width, PALETTE.active, ' ', PALETTE.text)
    const isPower = r === MAX_GUESSES - 1 && (i === 0 || i === WORD_LENGTH - 1)

    return pellet(h, Box, Text, key, width, isPower ? '●' : '•')
  })

  return h(Box, { key: `row${r}`, flexDirection: 'row', gap: 1, ...(isGapped && { marginBottom: 1 }) }, ...cells)
}

/** A key chip: a filled `width`×1 Box holding a plain Button (a Button's label can't be colored, only the chip). */
const chip = (h, Box, Button, boxKey, width, fill, button) =>
  h(Box, { key: boxKey, width, backgroundColor: fill, justifyContent: 'center' }, h(Button, { plain: true, ...button }))

/** The on-screen keyboard: chips colored by best known state; a known miss is just a dim · (an eaten pellet). */
const keyboard = (h, Box, Text, Button, game, metrics, on) => {
  const states = keyStates(game)
  const isOver = game.status !== 'playing'
  const width = metrics.chip
  const rows = KEY_ROWS.map((row, i) => {
    const keys = [...row].map(ch => {
      const look = keyLook(states[ch])
      if (look.isEaten) {
        return h(Box, { key: `kx-${ch}`, width, justifyContent: 'center' }, h(Text, { color: PALETTE.dim }, '·'))
      }

      return chip(h, Box, Button, `kc-${ch}`, width, look.fill, { key: `k-${ch}`, label: ch.toUpperCase(), dimColor: isOver, onPress: () => on.letter(ch) })
    })
    if (i === 2) {
      keys.unshift(chip(h, Box, Button, 'kc-enter', width, PALETTE.accent, { key: 'enter', label: '⏎', dimColor: isOver, onPress: () => on.enter() }))
      keys.push(chip(h, Box, Button, 'kc-back', width, PALETTE.keyIdle, { key: 'back', label: '⌫', dimColor: isOver, onPress: () => on.backspace() }))
    }

    return h(Box, { key: `krow${i}`, flexDirection: 'row', gap: 1, justifyContent: i === 1 ? 'center' : 'flex-start', width: metrics.keyboard }, ...keys)
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
    { key: 'stats', flexDirection: 'row', flexWrap: 'wrap', columnGap: 2 },
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
const controls = (h, ui, view, metrics, fit, on) => {
  const { Box, Text, Button, Input } = ui
  const { game, draft, isFieldBlanked } = view
  const isOver = game.status !== 'playing'

  return h(
    Box,
    { key: 'controls', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, paddingX: metrics.pad },
    statusRow(h, Box, Text, game),
    // The typing surface: the field edits `draft` natively (Backspace deletes the last
    // letter, Enter submits); the chips feed the same draft. It sits where the reference
    // has a blank row, so the pane is no taller for it.
    isOver
      ? h(Box, { key: 'no-field', height: 1 }, h(Button, { key: 'continue', label: CONTINUE_LABEL, hotkey: ENTER_KEY, plain: true, onPress: () => on.continue() }))
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
    keyboard(h, Box, Text, Button, game, metrics, on),
    fit.hasGap && h(Text, { key: 'gap' }, ' '),
    statsStageRow(h, Box, Text, Button, view, on),
  )
}

/** The board column: six tile rows, with `spare` blank rows placed between them (see gapRows), centred. */
const board = (h, Box, Text, game, draft, metrics, spare) => {
  const gaps = gapRows(game, spare)

  return h(
    Box,
    { key: 'board', flexDirection: 'column', justifyContent: 'center', width: metrics.board, paddingX: metrics.pad },
    ...Array.from({ length: MAX_GUESSES }, (_, r) => tileRow(h, Box, Text, game, draft, r, metrics.tile, gaps.has(r))),
  )
}

/** The faint line between board and controls: one column of │, `rows` tall (the frame's body). */
const divider = (h, Box, Text, rows) =>
  h(
    Box,
    { key: 'divider', flexDirection: 'column', width: 1 },
    ...Array.from({ length: rows }, (_, i) => h(Text, { key: `d${i}`, color: PALETTE.divider }, '│')),
  )

/** The WORDLE badge: bold spaced letters in the background color on a title-colored fill, ▐ ▌ in the accent color on each side. */
const badge = (h, Box, Text) =>
  h(
    Box,
    { key: 'badge', flexDirection: 'row' },
    h(Text, { color: PALETTE.accent }, '▐'),
    h(Text, { color: PALETTE.background, backgroundColor: PALETTE.title, bold: true }, BADGE_TEXT),
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

  return h(Text, { key: 'subtitle', color: PALETTE.subtitle, bold: true }, PRACTICE_TEXT)
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

// ---- the Pick a game screen (docs/ui-ref/wordle-picker.png) ----

const CARD_MIN = 28 // the narrowest a card can be: ◀ 08 OCT 2026 ▶ 2: play
const CARD_MAX = 32
const CARD_GAP = 4

/** A pixel-rounded block: ▗▄▄▖ over `rows` on a `fill` over ▝▀▀▘. */
const card = (h, Box, Text, key, width, fill, ...rows) =>
  h(
    Box,
    { key, flexDirection: 'column', width },
    h(Text, { color: fill }, `▗${'▄'.repeat(width - 2)}▖`),
    ...rows.map((row, i) => h(Box, { key: `${key}-r${i}`, width, backgroundColor: fill, ...row.box }, ...row.children)),
    h(Text, { color: fill }, `▝${'▀'.repeat(width - 2)}▘`),
  )

/** The header's "TODAY …" piece: how today's daily ended. */
const todaySummary = (h, Text, game) => {
  if (game?.status === 'won') {
    return [h(Text, { key: 't0', color: PALETTE.title, bold: true }, 'TODAY'), h(Text, { key: 't1', color: PALETTE.correct, bold: true }, `SOLVED ${game.guesses.length}/${MAX_GUESSES}`)]
  }
  if (game?.status === 'lost') {
    return [h(Text, { key: 't0', color: PALETTE.title, bold: true }, 'TODAY'), h(Text, { key: 't1', color: PALETTE.present, bold: true }, `LOST · ${game.answer.toUpperCase()}`)]
  }

  return [h(Text, { key: 't0', color: PALETTE.title, bold: true }, 'TODAY'), h(Text, { key: 't1', color: PALETTE.dim, bold: true }, 'NOT FINISHED')]
}

/**
 * The Pick a game screen, about 12 rows in the game screen's frame: header, a
 * round frame (title, two cards with a caption under each, streak and countdown), footer.
 * `view.picker` is `{ todayGame, played, date, dir, now }`: today's saved board, the dates
 * finished today, the stepper's date (already moved past played ones) and the way it last moved, and the clock.
 */
const pickerScreen = (ui, view, on) => {
  const { h, Box, Text, Button, Input, Select } = ui
  const { today, stats, isDateEntryOpen, layout } = view
  const { todayGame, played, date, now } = view.picker
  const width = Math.min(layout.columns, COMPACT_WIDTH)
  const inner = width - FRAME_BORDER
  const isSideBySide = inner >= CARD_MIN * 2 + CARD_GAP
  const cardWidth = isSideBySide ? Math.min(CARD_MAX, Math.floor((inner - CARD_GAP) / 2)) : Math.min(inner, CARD_MAX)
  // the dropdown: the newest dates not finished today (an older one is behind DATE…)
  const dates = recentUnplayed(today, played)
  const options = (dates.length > 0 ? dates : [date]).map(d => ({ value: d, label: longDate(d) }))

  const random = card(h, Box, Text, 'card-random', cardWidth, PALETTE.accent,
    { box: { justifyContent: 'center' }, children: [h(Text, { key: 'dice', color: PALETTE.background, backgroundColor: PALETTE.accent, bold: true }, '⚄ RANDOM GAME')] },
    { box: { justifyContent: 'center' }, children: [h(Button, { key: 'random', label: 'play', hotkey: '1', plain: true, onPress: () => on.randomGame() })] },
  )
  const pick = card(h, Box, Text, 'card-pick', cardWidth, PALETTE.cardKey,
    { box: { paddingX: 2 }, children: [h(Text, { key: 'pick-title', color: PALETTE.text, bold: true }, 'PICK A DATE')] },
    {
      box: { paddingX: 2, columnGap: 1 },
      children: [
        h(Select, { key: 'pick-date', options, value: date, onSelect: value => on.choosePickerDate(value) }),
        h(Button, { key: 'pick-play', label: 'play', hotkey: '2', plain: true, onPress: () => on.playPicked() }),
      ],
    },
  )
  const left = remaining(today, played)
  const caption = (key, align, text) =>
    h(Box, { key, width: cardWidth, justifyContent: align }, h(Text, { color: PALETTE.dim }, text || ' '))
  const randomCaption = caption('caption-random', 'center', `${formatCount(left)} left · never today's`)
  const pickCaption = caption('caption-pick', 'center', played.length > 0 ? 'played today are left out' : 'older dates: DATE…')
  const cards = isSideBySide
    ? h(Box, { key: 'cards', flexDirection: 'column', alignItems: 'center' },
        h(Box, { key: 'cards-row', flexDirection: 'row', columnGap: CARD_GAP }, random, pick),
        h(Box, { key: 'captions-row', flexDirection: 'row', columnGap: CARD_GAP }, randomCaption, pickCaption))
    : h(Box, { key: 'cards', flexDirection: 'column', alignItems: 'center' }, random, randomCaption, pick, pickCaption)

  return h(
    Box,
    { key: 'pane', width: layout.columns, alignItems: 'center' },
    h(
      Box,
      { key: 'layout', flexDirection: 'column', width, backgroundColor: PALETTE.background },
      h(
        Box,
        { key: 'header', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: HEADER_GAP },
        h(Box, { key: 'header-left', flexDirection: 'row', columnGap: HEADER_GAP }, badge(h, Box, Text), h(Box, { key: 'today', flexDirection: 'row', gap: 1 }, ...todaySummary(h, Text, todayGame))),
        h(
          Box,
          { key: 'header-right', flexDirection: 'row', columnGap: HEADER_CELL_GAP },
          headerCell(h, Box, Text, 'score', '1UP', pad(gameScore(todayGame), 5)),
          headerCell(h, Box, Text, 'hi-score', 'HI', pad(hiScore(stats), 5)),
        ),
      ),
      h(
        Box,
        { key: 'frame', flexDirection: 'column', borderStyle: 'round', borderColor: PALETTE.walls, backgroundColor: PALETTE.panel },
        h(Box, { key: 'title', justifyContent: 'center' }, h(Text, { color: PALETTE.dim, bold: true }, 'PICK YOUR NEXT GAME')),
        h(Text, { key: 'gap' }, ' '),
        cards,
        h(
          Box,
          { key: 'stats', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', paddingX: 2 },
          h(
            Box,
            { key: 'stats-left', flexDirection: 'row', columnGap: 2 },
            statPair(h, Box, Text, 'streak', 'STREAK', PALETTE.streak, pad(stats.currentStreak, 2)),
            statPair(h, Box, Text, 'best', 'BEST', PALETTE.best, pad(stats.maxStreak, 2)),
            statPair(h, Box, Text, 'win', 'WIN%', PALETTE.winPercent, pad(winPercent(stats), 2)),
          ),
          h(Text, { key: 'countdown', color: PALETTE.present, bold: true }, `NEXT DAILY IN ${nextDailyIn(now)}`),
        ),
      ),
      h(
        Box,
        { key: 'footer', flexDirection: 'row' },
        h(Button, { key: 'todays-board', label: "↺ TODAY'S BOARD", plain: true, dimColor: true, onPress: () => on.openToday() }),
        h(Text, { key: 'f0', color: PALETTE.dim }, ' · '),
        h(Button, { key: 'date-entry', label: isDateEntryOpen ? '▴ DATE…' : 'DATE…', plain: true, dimColor: true, onPress: () => on.toggleDateEntry() }),
        h(Text, { key: 'f1', color: PALETTE.dim }, ' · ESC TO EXIT'),
      ),
      isDateEntryOpen &&
        drawer(
          h,
          Box,
          Text,
          'date-drawer',
          'PICK A DATE',
          h(Input, { key: 'archive-date', label: 'A date', placeholder: 'YYYY-MM-DD', submitLabel: 'play', onSubmit: text => on.pickDate(text) }),
          h(Text, { color: PALETTE.dim }, 'ANY DAY FROM 2021-06-19 UP TO YESTERDAY, NOT ONE YOU FINISHED TODAY · PRACTICE GAMES DON’T COUNT TOWARD YOUR STATS'),
        ),
    ),
  )
}

/**
 * The pane's tree for one game state. Pure: the caller supplies the element
 * factory `h`, the surface's elements, and the press callbacks, so this file
 * never touches the engine's `$`.
 *
 * @param ui `{ h, Box, Text, Button, Input, Select }`
 * @param view `{ game, draft, puzzle, today, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen, isFieldBlanked, celebrationFrame, isMotionReduced, screen, layout }`; `celebrationFrame` >= 0 shows the win screen instead of the board; `splash` (`{ frame, opts }`, see splash.js) shows the opening splash instead; `screen` is `{ columns, rows }`, the win screen's size; `layout` is `{ columns, rows, isStacked }`: the pane body's width, which sizes the tiles and chips, its rows (when known), which the compact layout fits (see `compactFit`), and whether to stack (see `isStackedLayout`); `game` null means still loading; `mode` 'picker' (with `picker` `{ todayGame, played, date, dir, now }`) draws the Pick a game screen instead of the board
 * @param on `{ letter(ch), enter(), backspace(), input(text), pickDate(date), stepStage(dir), toggleStats(), toggleDateEntry(), clearStats(), fallbackInfo(), continue(), choosePickerDate(date), randomGame(), playPicked(), openToday(), skipSplash() }`
 */
export const renderBoard = (ui, view, on) => {
  const { h, Box, Text, Button, Input, Select } = ui
  const { game, draft, puzzle, today, stats, isStatsOpen, isConfirmingClear, isDateEntryOpen, celebrationFrame, isMotionReduced, screen, layout } = view
  if (celebrationFrame >= 0) return celebrationScreen(h, Box, Text, celebrationFrame, screen, isMotionReduced)
  if (view.splash) return splashScreen(ui, view.splash, layout, on)
  if (view.mode === 'picker' && view.picker) return pickerScreen(ui, view, on)
  if (!game) {
    return h(Box, { flexDirection: 'column', backgroundColor: PALETTE.background }, h(Text, { color: PALETTE.dim }, 'LOADING TODAY’S STAGE…'))
  }

  const metrics = boardMetrics(layout.columns, layout.isStacked)
  const { isSideBySide, width } = metrics
  // side by side it fits the pane's rows (the footer bar always in view); stacked only comes with room to spare
  const fit = isSideBySide ? compactFit(layout.rows) : COMPACT_FITS[0]
  // the board's room grows with the pane's rows, a gap at a time: side by side it is the frame's
  // body (around it: header, border, footer); stacked it is the board's own rows (around it, the rest)
  const room = isSideBySide
    ? boardRoom(fitBodyRows(fit), layout.rows, (fit.hasHeader ? 1 : 0) + (fit.hasBorder ? FRAME_BORDER : 0) + 1)
    : boardRoom(BOARD_ROWS, layout.rows, stackedRows(layout.columns) - BOARD_ROWS)
  const isOver = game.status !== 'playing'
  const date = puzzle?.date ?? today
  const [typeToPlay, enterLabel, dot, deleteLabel, escToExit] = HINT_PARTS
  const overHint = 'CONTINUE TO PICK A GAME · ESC TO EXIT'
  const todayLabel = date !== today ? '▶ TODAY' : null
  const dateLabel = isDateEntryOpen ? '▴ DATE…' : 'DATE…'
  const statsLabel = isStatsOpen ? '▴ LESS' : '▾ MORE'
  const hintWidth = isOver ? overHint.length : sum(HINT_PARTS.map(part => part.length))
  const rightPad = footerPad(width, hintWidth, [todayLabel, dateLabel, statsLabel].filter(Boolean), isSideBySide)

  // the layout is drawn at its own width, centred in the body: spare columns are margin
  return h(
    Box,
    { key: 'pane', width: layout.columns, alignItems: 'center' },
    h(
      Box,
      { key: 'layout', flexDirection: 'column', width, backgroundColor: PALETTE.background },
      fit.hasHeader &&
        h(
          Box,
          { key: 'header', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: HEADER_GAP },
          h(
            Box,
            { key: 'header-left', flexDirection: 'row', columnGap: HEADER_GAP },
            badge(h, Box, Text),
            subtitle(h, Text, puzzle, today),
            puzzle?.source === 'fallback' && h(Button, { key: 'fallback-warning', label: '⚠ OFFLINE', plain: true, onPress: () => on.fallbackInfo() }),
          ),
          h(
            Box,
            { key: 'header-right', flexDirection: 'row', columnGap: HEADER_CELL_GAP },
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
          ...(fit.hasBorder && { borderStyle: 'round', borderColor: PALETTE.walls }),
          backgroundColor: PALETTE.panel,
        },
        board(h, Box, Text, game, draft, metrics, room.spare),
        isSideBySide && divider(h, Box, Text, room.body),
        controls(h, ui, view, metrics, fit, on),
      ),
      h(
        Box,
        { key: 'footer', flexDirection: 'row', flexWrap: isSideBySide ? 'nowrap' : 'wrap', justifyContent: 'space-between', columnGap: FOOTER_GAP },
        h(
          Box,
          { key: 'hint', flexDirection: 'row' },
          isOver
            ? h(Text, { color: PALETTE.dim }, overHint)
            : [
                h(Text, { key: 'h0', color: PALETTE.dim }, typeToPlay),
                h(Button, { key: 'hotkey-enter', label: enterLabel, plain: true, dimColor: true, onPress: () => on.enter() }),
                h(Text, { key: 'h1', color: PALETTE.dim }, dot),
                h(Button, { key: 'hotkey-back', label: deleteLabel, plain: true, dimColor: true, onPress: () => on.backspace() }),
                h(Text, { key: 'h2', color: PALETTE.dim }, escToExit),
              ],
        ),
        h(
          Box,
          { key: 'footer-right', flexDirection: 'row', columnGap: FOOTER_BUTTON_GAP, paddingRight: rightPad },
          todayLabel && h(Button, { key: 'play-today', label: todayLabel, plain: true, onPress: () => on.pickDate(today) }),
          h(Button, { key: 'date-entry', label: dateLabel, plain: true, dimColor: true, onPress: () => on.toggleDateEntry() }),
          h(Button, { key: 'stats-toggle', label: statsLabel, plain: true, dimColor: true, onPress: () => on.toggleStats() }),
        ),
      ),
      isStatsOpen && statsDrawer(h, Box, Text, Button, stats, isConfirmingClear, on),
      isDateEntryOpen && dateDrawer(h, Box, Text, Input, Select, view, on),
    ),
  )
}

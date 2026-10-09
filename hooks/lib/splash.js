import { blockTitle, pad, PALETTE, stageLabel } from './arcade.js'

// The opening splash, "Chomp & grade" (docs/ui-ref/wordle-splash-AB.png): an eater
// chomps a row of pellets and leaves the WORDLE title behind it as scored tiles, a
// green wave grades it solved, a white flash, then it settles terracotta with READY!.

export const FRAME_MS = 100

/** The picture's size when there is room; a bigger pane centres it, never stretches it. */
export const BASE_COLUMNS = 78
export const BASE_ROWS = 11
/** Below this many columns the block title gives way to a plain `W O R D L E`. */
export const BLOCK_MIN_COLUMNS = 41
/** The narrowest the picture is drawn; a narrower pane clips it. */
export const MIN_COLUMNS = 20

// Raw hex where the palette has no entry, as fireworks.js does.
export const MISS_COLOR = '#5a524a'
export const FLASH_COLOR = '#fff4e6'
/** Each title letter's score as the eater reveals it: W correct, O present, R correct, D miss, L present, E correct. */
export const LETTER_COLORS = [PALETTE.correct, PALETTE.present, PALETTE.correct, MISS_COLOR, PALETTE.present, PALETTE.correct]

const WORD = 'WORDLE'
const LETTER_STEP = 6 // a 5-column glyph and the column after it
const TITLE_WIDTH = WORD.length * LETTER_STEP - 1 // 35
const PELLET_ROW = 1 // title row 2: the pellets run through the middle of the letters
const PELLET_STEP = 3
const EATER_FROM = -2 // two columns left of the title …
const EATER_TO = TITLE_WIDTH + 2 // … to two past it
const BLINK_FRAMES = 3 // READY! blinks every 300 ms
const HUD_PAD = 2
const CHECKS = Array(WORD.length).fill('✓').join(' ')
const SKIP_HOTKEY = '1'
const SKIP_LABEL = 'PRESS ANY KEY TO SKIP'
const SKIP_SHORT = 'SKIP'

/**
 * Each version's timeline, in frames. The full one (from /wordle): chomp 0–24,
 * the scored title alone at 25, the grade 26–29, the flash 30–31 (3.0–3.15 s,
 * 3.15 s falling inside frame 31), the settle 32–39. Auto-open plays a 2 s cut:
 * chomp at double speed, no grade or flash. Reduced motion holds the settled picture 1 s.
 */
const TIMELINES = {
  full: { frames: 40, chompTo: 25, gradeFrom: 26, flashFrom: 30, settleFrom: 32, blinks: true },
  short: { frames: 20, chompTo: 14, gradeFrom: null, flashFrom: null, settleFrom: 14, blinks: true },
  reduced: { frames: 10, chompTo: 0, gradeFrom: null, flashFrom: null, settleFrom: 0, blinks: false },
}

/** Which version plays: reduced motion wins, then auto-open's short one. */
export const splashVariant = (opts = {}) => (opts.reducedMotion ? 'reduced' : opts.isAutoOpen ? 'short' : 'full')

/** How many 100 ms frames the version `opts` asks for lasts: 40, 20 or 10. */
export const splashFrames = (opts = {}) => TIMELINES[splashVariant(opts)].frames

/** What the picture is doing at `frame`: 'chomp', 'scored', 'grade', 'flash' or 'settle'. */
export const splashPhase = (frame, opts = {}) => {
  const t = TIMELINES[splashVariant(opts)]
  if (frame < t.chompTo) return 'chomp'
  if (frame >= t.settleFrom) return 'settle'
  if (t.flashFrom != null && frame >= t.flashFrom) return 'flash'
  if (t.gradeFrom != null && frame >= t.gradeFrom) return 'grade'

  return 'scored'
}

/** The eater's column during the chomp, in title columns (0 = the W's first column): a steady pace. */
export const eaterColumn = (frame, opts = {}) => {
  const { chompTo } = TIMELINES[splashVariant(opts)]

  return EATER_FROM + Math.round(((EATER_TO - EATER_FROM) * frame) / Math.max(1, chompTo - 1))
}

/** The letter (0–5) a title column belongs to, the gap after it counting as its own; -1 before the W. */
const letterAt = column => (column < 0 ? -1 : Math.min(WORD.length - 1, Math.floor(column / LETTER_STEP)))

/** The eater's color: the letter it is in, present before the first. */
export const eaterColor = (frame, opts = {}) => {
  const i = letterAt(eaterColumn(frame, opts))

  return i < 0 ? PALETTE.present : LETTER_COLORS[i]
}

/** Letter `i`'s color at `frame` once it is revealed. */
const letterColor = (i, frame, phase, timeline) => {
  if (phase === 'settle') return PALETTE.title
  if (phase === 'flash') return FLASH_COLOR
  // the wave: letter i turns correct in turn over the grade's four frames
  if (phase === 'grade' && frame >= timeline.gradeFrom + Math.floor((4 * i) / WORD.length)) return PALETTE.correct

  return LETTER_COLORS[i]
}

/**
 * Which rows the picture has in `rows` of room, top to bottom. Short of the base
 * 11 (8 with the plain title) it drops the HUD, then the skip line, then the blank
 * rows, then the border; the title and READY! always stay.
 */
const rowPlan = (rows, titleRows) => {
  const plan = ['top', 'hud', 'gap-top', ...Array.from({ length: titleRows }, (_, i) => `title${i}`), 'gap-mid', 'ready', 'skip', 'bottom']
  const least = titleRows + 1
  const want = Math.max(least, rows ?? plan.length)
  for (const drop of ['hud', 'skip', 'gap-top', 'gap-mid', 'border']) {
    if (plan.length <= want) break
    if (drop === 'border') plan.splice(0, plan.length, ...plan.filter(kind => kind !== 'top' && kind !== 'bottom'))
    else plan.splice(plan.indexOf(drop), 1)
  }

  return plan
}

/** The picture's width and rows for a pane body of `screen` `{ columns, rows }`. */
export const splashLayout = screen => {
  const columns = Math.min(BASE_COLUMNS, Math.max(MIN_COLUMNS, screen?.columns ?? BASE_COLUMNS))
  const isBlock = columns >= BLOCK_MIN_COLUMNS

  return { columns, isBlock, plan: rowPlan(screen?.rows, isBlock ? 4 : 1) }
}

/** The skip line's text: the prefix, and the label of the Button that skips (drawn `1: label`). */
const skipText = (frame, inner, opts) => {
  if (splashPhase(frame, opts) !== 'settle') return { prefix: '', label: SKIP_SHORT }
  const prefix = opts.isTodayDone ? 'PICK YOUR NEXT GAME · ' : 'DAILY PUZZLE · '
  const button = `${SKIP_HOTKEY}: ${SKIP_LABEL}`
  if (prefix.length + button.length <= inner - 2) return { prefix, label: SKIP_LABEL }

  return { prefix: '', label: button.length <= inner - 2 ? SKIP_LABEL : SKIP_SHORT }
}

/**
 * Where the skip Button goes on `splashRows`' picture at `frame`: its row, its
 * first column and its label (it draws as `1: label`). Null when the pane is too
 * short for the skip line.
 */
export const skipButton = (frame, screen, opts = {}) => {
  const layout = splashLayout(screen)
  const row = layout.plan.indexOf('skip')
  if (row < 0) return null
  const inner = layout.columns - 2
  const { prefix, label } = skipText(frame, inner, opts)
  const width = prefix.length + SKIP_HOTKEY.length + 2 + label.length

  return { row, column: 1 + Math.floor((inner - width) / 2) + prefix.length, label, hotkey: SKIP_HOTKEY }
}

/**
 * One frame of the opening splash as rows of runs, `{ text, color?, backgroundColor, bold? }`,
 * every row exactly the picture's width (78 columns when there is room; see
 * `splashLayout`). Every cell carries the background color, so the dark picture
 * holds whatever the person's theme.
 *
 * Pure: the same arguments always draw the same picture. A frame past the end
 * draws the last one.
 *
 * @param frame 0 … splashFrames(opts) - 1
 * @param screen `{ columns, rows? }`, the pane body's room
 * @param opts `{ hiScore, date: 'YYYY-MM-DD', isTodayDone, reducedMotion, isAutoOpen }`
 */
export const splashRows = (frame, screen, opts = {}) => {
  const timeline = TIMELINES[splashVariant(opts)]
  frame = Math.min(timeline.frames - 1, Math.max(0, frame))
  const phase = splashPhase(frame, opts)
  const { columns: W, isBlock, plan } = splashLayout(screen)
  const inner = W - 2
  const blank = () => Array.from({ length: W }, () => ({ ch: ' ' }))
  const grid = plan.map(blank)
  const put = (y, x, ch, color, bold) => {
    if (y < 0 || x < 1 || x > inner) return // inside the walls only
    grid[y][x] = { ch, color, bold }
  }
  const write = (y, x, text, color, bold) => [...text].forEach((ch, i) => put(y, x + i, ch, color, bold))
  const rowOf = kind => plan.indexOf(kind)

  // --- the double-line walls
  const top = rowOf('top')
  if (top >= 0) {
    const bottom = rowOf('bottom')
    grid[top] = [...`╔${'═'.repeat(inner)}╗`].map(ch => ({ ch, color: PALETTE.walls }))
    grid[bottom] = [...`╚${'═'.repeat(inner)}╝`].map(ch => ({ ch, color: PALETTE.walls }))
    for (let y = top + 1; y < bottom; y++) {
      grid[y][0] = { ch: '║', color: PALETTE.walls }
      grid[y][W - 1] = { ch: '║', color: PALETTE.walls }
    }
  }

  // --- the HUD: 1UP left, HI-SCORE centred and dim, STAGE right; the centre then the right give way
  const hud = rowOf('hud')
  if (hud >= 0) {
    const score = ['1UP', '00000']
    const stage = ['STAGE', stageLabel(opts.date ?? '2026-01-01')]
    const hi = `HI-SCORE ${pad(opts.hiScore ?? 0, 5)}`
    const left = 1 + HUD_PAD
    const leftEnd = left + score.join(' ').length
    const right = 1 + inner - HUD_PAD - stage.join(' ').length
    const hiAt = 1 + Math.floor((inner - hi.length) / 2)
    const hasStage = right > leftEnd
    write(hud, left, score[0], PALETTE.title, true)
    write(hud, left + score[0].length + 1, score[1], PALETTE.text, true)
    if (hasStage) {
      write(hud, right, stage[0], PALETTE.title, true)
      write(hud, right + stage[0].length + 1, stage[1], PALETTE.text, true)
    }
    if (hiAt > leftEnd && hiAt + hi.length < (hasStage ? right : 1 + inner - HUD_PAD)) write(hud, hiAt, hi, PALETTE.dim, true)
  }

  // --- the title
  const titleTop = rowOf('title0')
  if (isBlock) {
    const glyphRows = blockTitle(WORD)
    const left = 1 + Math.floor((inner - TITLE_WIDTH) / 2)
    const eater = phase === 'chomp' ? eaterColumn(frame, opts) : null
    glyphRows.forEach((glyphRow, r) => {
      ;[...glyphRow].forEach((ch, x) => {
        const isRevealed = eater == null || x < eater
        if (ch !== ' ' && isRevealed) put(titleTop + r, left + x, ch, letterColor(letterAt(x), frame, phase, timeline))
      })
    })
    if (eater != null) {
      // the pellets still ahead of it, ● at both ends, up to two columns short of the right wall
      const last = inner - HUD_PAD - left
      const ends = [0, last - (last % PELLET_STEP)]
      for (let x = 0; x <= ends[1]; x += PELLET_STEP) {
        if (x >= eater + 2) put(titleTop + PELLET_ROW, left + x, ends.includes(x) ? '●' : '•', PALETTE.pellet)
      }
      // the eater: ▐ down all four title rows, █ beside the middle two
      const color = eaterColor(frame, opts)
      for (let r = 0; r < 4; r++) put(titleTop + r, left + eater, '▐', color)
      for (const r of [1, 2]) put(titleTop + r, left + eater + 1, '█', color)
    }
  } else {
    // too narrow for the block font: the letters appear left to right as the eater (unseen) passes them
    const spaced = [...WORD].join(' ')
    const left = 1 + Math.floor((inner - spaced.length) / 2)
    const eater = phase === 'chomp' ? eaterColumn(frame, opts) : null
    ;[...WORD].forEach((ch, i) => {
      if (eater == null || eater > i * LETTER_STEP + 2) put(titleTop, left + i * 2, ch, letterColor(i, frame, phase, timeline), true)
    })
  }

  // --- row 8: the grade's ticks, then READY! (blinking, steady with reduced motion)
  const ready = rowOf('ready')
  const centre = (y, text, color, bold) => write(y, 1 + Math.floor((inner - text.length) / 2), text, color, bold)
  if (phase === 'grade') centre(ready, CHECKS, PALETTE.correct)
  if (phase === 'settle') {
    const isLit = !timeline.blinks || Math.floor((frame - timeline.settleFrom) / BLINK_FRAMES) % 2 === 0
    if (isLit) centre(ready, 'READY!', PALETTE.present, true)
  }

  // --- row 9: the skip line (the Button is drawn over its `1: label`; see skipButton)
  const skip = skipButton(frame, screen, opts)
  if (skip) {
    const { prefix } = skipText(frame, inner, opts)
    write(skip.row, skip.column - prefix.length, prefix, PALETTE.dim)
    write(skip.row, skip.column, `${skip.hotkey}: ${skip.label}`, PALETTE.dim)
  }

  return grid.map(row => {
    const runs = []
    for (const cell of row) {
      const last = runs[runs.length - 1]
      if (last && last.color === cell.color && last.bold === cell.bold) last.text += cell.ch
      else runs.push({ text: cell.ch, color: cell.color, backgroundColor: PALETTE.background, bold: cell.bold })
    }

    return runs
  })
}

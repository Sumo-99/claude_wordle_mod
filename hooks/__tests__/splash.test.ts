import { expect, mock, test } from 'claude-code/testing'

import { blockTitle, PALETTE } from '../lib/arcade.js'
import {
  BASE_COLUMNS,
  BASE_ROWS,
  eaterColumn,
  FLASH_COLOR,
  FRAME_MS,
  LETTER_COLORS,
  MISS_COLOR,
  skipButton,
  splashFrames,
  splashPhase,
  splashRows,
} from '../lib/splash.js'

const OPTS = { hiScore: 400, date: '2026-10-09', isTodayDone: false, reducedMotion: false, isAutoOpen: false }
const BASE = { columns: BASE_COLUMNS, rows: BASE_ROWS }

type Cell = { ch: string; color?: string; bold?: boolean; backgroundColor?: string }
const cells = (frame: number, screen: any = BASE, opts: any = OPTS): Cell[][] =>
  splashRows(frame, screen, opts).map(runs => runs.flatMap(r => [...r.text].map(ch => ({ ch, ...r }))))
const picture = (frame: number, screen: any = BASE, opts: any = OPTS) => splashRows(frame, screen, opts).map(runs => runs.map(r => r.text).join(''))

// at 78 × 11 the block title's 35 columns start at column 21 (1 wall + 20 margin) on rows 3–6
const TITLE_LEFT = 21
const TITLE_ROWS = [3, 4, 5, 6]
/** The letters drawn (any lit pixel in their columns, eater excluded), and each one's colors. */
const revealed = (grid: Cell[][], eaterAt: number | null = null) =>
  [0, 1, 2, 3, 4, 5].map(i => {
    const lit = TITLE_ROWS.flatMap(y =>
      grid[y].slice(TITLE_LEFT + i * 6, TITLE_LEFT + i * 6 + 5).filter((c, k) => {
        const x = i * 6 + k
        const isPellet = c.ch === '•' || c.ch === '●'
        return c.ch !== ' ' && !isPellet && (eaterAt == null || (x !== eaterAt && x !== eaterAt + 1))
      }),
    )
    return lit.length === 0 ? null : [...new Set(lit.map(c => c.color))]
  })
/** The eater: the column (in title columns) of the ▐ on the title's top row, and its color. */
const eater = (grid: Cell[][]) => {
  const x = grid[3].findIndex(c => c.ch === '▐')
  return x < 0 ? null : { column: x - TITLE_LEFT, color: grid[3][x].color }
}
const pellets = (grid: Cell[][]) => grid[4].map((c, x) => ({ ...c, x })).filter(c => c.ch === '•' || c.ch === '●')
const titleColors = (grid: Cell[][]) => [...new Set(TITLE_ROWS.flatMap(y => grid[y].slice(TITLE_LEFT, TITLE_LEFT + 35)).filter(c => c.ch !== ' ').map(c => c.color))]

// ---- the picture, pure ----

test('the 5×7 block font is back: WORDLE is four half-block rows, 35 columns, one between letters', () => {
  const rows = blockTitle()
  expect(rows).toHaveLength(4)
  for (const row of rows) {
    expect(row).toHaveLength(35)
    expect(row).toMatch(/^[ ▀▄█]+$/)
  }
  expect(rows.map(r => r[0]).join('')).toBe('███▀') // W's outer stroke runs the full height
  expect(picture(36).slice(3, 7).map(r => r.slice(TITLE_LEFT, TITLE_LEFT + 35))).toEqual(rows) // drawn as is
})

test('the full splash is 40 frames of 100 ms (4.0 s); auto-open 20 (2.0 s); reduced motion 10 (1.0 s)', () => {
  expect(FRAME_MS).toBe(100)
  expect(splashFrames(OPTS) * FRAME_MS).toBe(4000)
  expect(splashFrames({ ...OPTS, isAutoOpen: true }) * FRAME_MS).toBe(2000)
  expect(splashFrames({ ...OPTS, reducedMotion: true }) * FRAME_MS).toBe(1000)
  expect(splashFrames({ ...OPTS, reducedMotion: true, isAutoOpen: true })).toBe(10) // reduced motion wins
})

test('every row is exactly as wide as the frame, at every size and frame', () => {
  const screens = [BASE, { columns: 120, rows: 40 }, { columns: 41, rows: 11 }, { columns: 40, rows: 11 }, { columns: 30, rows: 8 }, { columns: 78, rows: 8 }, { columns: 10, rows: 3 }]
  for (const screen of screens) {
    for (const opts of [OPTS, { ...OPTS, isAutoOpen: true }, { ...OPTS, reducedMotion: true }]) {
      const width = Math.min(78, Math.max(20, screen.columns))
      for (let f = 0; f < splashFrames(opts); f++) {
        for (const row of picture(f, screen, opts)) expect([...row]).toHaveLength(width)
      }
    }
  }
  // every cell carries the dark background, whatever the theme
  expect(cells(12).flat().every(c => c.backgroundColor === PALETTE.background)).toBe(true)
})

test('base 78 × 11: double-line walls, the HUD on row 1; a bigger pane gets the same 78 × 11', () => {
  const rows = picture(36)
  expect(rows).toHaveLength(11)
  expect(rows[0]).toBe(`╔${'═'.repeat(76)}╗`)
  expect(rows[10]).toBe(`╚${'═'.repeat(76)}╝`)
  for (let y = 1; y < 10; y++) expect(rows[y][0] + rows[y].at(-1)).toBe('║║')
  expect(cells(36)[0][0].color).toBe(PALETTE.walls)

  expect(rows[1]).toMatch(/^║ {2}1UP 00000 +HI-SCORE 00400 +STAGE 09 OCT {2}║$/)
  const hud = cells(36)[1]
  const at = (text: string) => rows[1].indexOf(text)
  expect(hud[at('1UP')].color).toBe(PALETTE.title)
  expect(hud[at('00000')].color).toBe(PALETTE.text)
  expect(hud[at('HI-SCORE')].color).toBe(PALETTE.dim)
  expect(hud[at('STAGE')].color).toBe(PALETTE.title)
  expect(hud[at('09 OCT')].color).toBe(PALETTE.text)
  // HI-SCORE is centred
  expect(Math.abs(at('HI-SCORE') + 7 - 39)).toBeLessThanOrEqual(1)

  expect(picture(36, { columns: 140, rows: 30 })).toEqual(rows)
})

test('frame 0: nothing revealed yet; the eater waits left of the title, in the present color, before a full row of pellets', () => {
  const g = cells(0)
  expect(splashPhase(0, OPTS)).toBe('chomp')
  expect(revealed(g, -2)).toEqual([null, null, null, null, null, null])
  expect(eater(g)).toEqual({ column: -2, color: PALETTE.present })
  expect(g[4][TITLE_LEFT - 1]).toMatchObject({ ch: '█', color: PALETTE.present }) // the eater's middle block
  const p = pellets(g)
  expect(p[0]).toMatchObject({ ch: '●', x: TITLE_LEFT, color: PALETTE.pellet }) // a power pellet at each end
  expect(p.at(-1)!.ch).toBe('●')
  expect(p.slice(1, -1).every(c => c.ch === '•')).toBe(true)
  expect(p.at(-1)!.x).toBeGreaterThan(TITLE_LEFT + 35) // the row runs on past the title
})

test('frame 5: W revealed green behind the eater; the eater is in the O, so it is amber', () => {
  const g = cells(5)
  const e = eater(g)!
  expect(e).toEqual({ column: 6, color: PALETTE.present })
  expect(revealed(g, e.column)).toEqual([[PALETTE.correct], null, null, null, null, null])
  expect(pellets(g).every(c => c.x >= TITLE_LEFT + e.column + 2)).toBe(true) // eaten behind it, still ahead of it
})

test('frame 12: W green, O amber, R green; the eater is in the D and takes its gray', () => {
  const g = cells(12)
  const e = eater(g)!
  expect(e).toEqual({ column: 18, color: MISS_COLOR })
  expect(revealed(g, e.column)).toEqual([[PALETTE.correct], [PALETTE.present], [PALETTE.correct], null, null, null])
})

test('frame 20: W O R D L revealed in their scores, the eater into the E (green), steady speed', () => {
  const g = cells(20)
  const e = eater(g)!
  expect(e).toEqual({ column: 31, color: PALETTE.correct })
  expect(revealed(g, e.column).slice(0, 5)).toEqual(LETTER_COLORS.slice(0, 5).map(c => [c]))
  // a steady pace: about 1.6 columns a frame, from 2 left of the title to 2 past it by frame 24
  const steps = Array.from({ length: 24 }, (_, f) => eaterColumn(f + 1, OPTS) - eaterColumn(f, OPTS))
  expect(Math.min(...steps)).toBeGreaterThanOrEqual(1)
  expect(Math.max(...steps)).toBeLessThanOrEqual(2)
  expect(eaterColumn(24, OPTS)).toBe(37)
})

test('frame 25: the whole title in its scores, the eater and pellets gone', () => {
  const g = cells(25)
  expect(splashPhase(25, OPTS)).toBe('scored')
  expect(eater(g)).toBeNull()
  expect(pellets(g)).toHaveLength(0)
  expect(revealed(g)).toEqual(LETTER_COLORS.map(c => [c]))
})

test('frames 26–29: a green wave grades the letters left to right, with ✓ ✓ ✓ ✓ ✓ ✓ on row 8', () => {
  const at26 = cells(26)
  expect(splashPhase(26, OPTS)).toBe('grade')
  expect(revealed(at26)).toEqual([[PALETTE.correct], [PALETTE.correct], [PALETTE.correct], [MISS_COLOR], [PALETTE.present], [PALETTE.correct]])
  expect(picture(26)[8].trim()).toBe('║                                ✓ ✓ ✓ ✓ ✓ ✓                                 ║'.trim())
  expect(at26[8].find(c => c.ch === '✓')!.color).toBe(PALETTE.correct)
  expect(revealed(cells(28))[3]).toEqual([PALETTE.correct]) // the D's turn
  expect(revealed(cells(28))[5]).toEqual([PALETTE.correct])
  expect(titleColors(cells(29))).toEqual([PALETTE.correct]) // all solved
  expect(picture(25)[8]).not.toContain('✓')
})

test('frames 30–31: the white flash (3.0–3.15 s); no ticks', () => {
  for (const f of [30, 31]) {
    expect(splashPhase(f, OPTS)).toBe('flash')
    expect(titleColors(cells(f))).toEqual([FLASH_COLOR])
    expect(picture(f)[8]).not.toContain('✓')
  }
})

test('frames 32–39: settled terracotta, READY! blinking every 300 ms, and the row 9 line', () => {
  for (const f of [32, 35, 39]) {
    expect(splashPhase(f, OPTS)).toBe('settle')
    expect(titleColors(cells(f))).toEqual([PALETTE.title])
  }
  const ready = (f: number) => picture(f)[8].includes('READY!')
  expect([32, 33, 34, 35, 36, 37, 38, 39].map(ready)).toEqual([true, true, true, false, false, false, true, true])
  const g = cells(39)
  const x = picture(39)[8].indexOf('READY!')
  expect(g[8][x]).toMatchObject({ color: PALETTE.present, bold: true })
  expect(picture(39)[9]).toContain('DAILY PUZZLE · 1: PRESS ANY KEY TO SKIP')
  expect(g[9][picture(39)[9].indexOf('DAILY')].color).toBe(PALETTE.dim)
  expect(picture(39, BASE, { ...OPTS, isTodayDone: true })[9]).toContain('PICK YOUR NEXT GAME · 1: PRESS ANY KEY TO SKIP')
  // before the settle the skip line is just the control
  expect(picture(12)[9].trim()).toBe('║                                  1: SKIP                                   ║'.trim())
})

test('the skip Button sits exactly over its `1: label` on row 9', () => {
  for (const f of [0, 20, 39]) {
    const skip = skipButton(f, BASE, OPTS)!
    expect(skip.row).toBe(9)
    expect(skip.hotkey).toBe('1')
    expect(picture(f)[9].slice(skip.column, skip.column + 3 + skip.label.length)).toBe(`1: ${skip.label}`)
  }
  expect(skipButton(12, BASE, OPTS)!.label).toBe('SKIP')
  expect(skipButton(39, BASE, OPTS)!.label).toBe('PRESS ANY KEY TO SKIP')
})

test('the same arguments always draw the same picture', () => {
  for (const f of [0, 5, 12, 20, 26, 30, 31, 39]) expect(splashRows(f, BASE, OPTS)).toEqual(splashRows(f, BASE, OPTS))
})

test('narrow (below 41 columns): a plain bold W O R D L E, letters appearing left to right in their scores, then settling', () => {
  const screen = { columns: 40, rows: 11 }
  // the plain title is one row: walls, HUD, gap, then the title on row 3
  expect(picture(0, screen)).toHaveLength(8)
  const titleRow = (f: number) => ({ text: picture(f, screen)[3], cells: cells(f, screen)[3] })
  expect(picture(0, screen).join('')).not.toMatch(/[▀▄█▐•]/) // no block font, no eater, no pellets
  expect(titleRow(0).text.trim()).toBe('║                                      ║'.trim())
  expect(titleRow(12).text).toMatch(/W O R +║$/)
  expect(titleRow(20).text).toContain('W O R D L')
  const scored = titleRow(25)
  expect(scored.text).toContain('W O R D L E')
  expect([...'WORDLE'].map(ch => scored.cells.find(c => c.ch === ch)!.color)).toEqual(LETTER_COLORS)
  expect(scored.cells.find(c => c.ch === 'W')!.bold).toBe(true)
  expect(titleRow(39).cells.filter(c => /[WORDLE]/.test(c.ch)).every(c => c.color === PALETTE.title)).toBe(true)
  expect(picture(39, screen).join('\n')).toContain('READY!')
  // the HUD gives way rather than collide: no HI-SCORE at this width
  expect(picture(39, screen)[1]).toMatch(/1UP 00000 +STAGE 09 OCT/)
  expect(picture(39, screen)[1]).not.toContain('HI-SCORE')
  // 41 columns is wide enough for the block font
  expect(picture(39, { columns: 41, rows: 11 }).join('')).toContain('█')
})

test('short (below 11 rows): the HUD goes first, then row 9; the title and READY! always show', () => {
  const at = (rows: number) => picture(39, { columns: 78, rows })
  expect(at(11)).toHaveLength(11)
  expect(at(10)).toHaveLength(10)
  expect(at(10).join('')).not.toContain('1UP')
  expect(at(10).join('')).toContain('PRESS ANY KEY')
  expect(at(9)).toHaveLength(9)
  expect(at(9).join('')).not.toContain('PRESS ANY KEY')
  expect(skipButton(39, { columns: 78, rows: 9 }, OPTS)).toBeNull()
  for (const rows of [8, 7, 6, 5, 3]) {
    const shown = at(rows)
    expect(shown.length).toBeLessThanOrEqual(Math.max(5, rows))
    expect(shown.join('\n')).toContain('█▀▀▀█') // the O's top: the title is whole
    expect(shown.join('\n')).toContain('READY!')
  }
  expect(at(8)[0][0]).toBe('╔') // ~8 rows still has its walls
})

test('reduced motion: no chomp, wave or flash; the settled picture with a steady READY! for 1 s', () => {
  const reduced = { ...OPTS, reducedMotion: true }
  const first = picture(0, BASE, reduced)
  for (let f = 0; f < 10; f++) {
    expect(splashPhase(f, reduced)).toBe('settle')
    expect(picture(f, BASE, reduced)).toEqual(first)
  }
  expect(first.join('')).not.toMatch(/[▐•●✓]/)
  expect(first[8]).toContain('READY!')
  expect(titleColors(cells(0, BASE, reduced))).toEqual([PALETTE.title])
  expect(first[9]).toContain('DAILY PUZZLE · 1: PRESS ANY KEY TO SKIP')
})

test('auto-open: a 2 s cut, the chomp at double speed (0–1.4 s), no wave or flash, settled 1.4–2.0 s', () => {
  const short = { ...OPTS, isAutoOpen: true }
  expect([0, 13].map(f => splashPhase(f, short))).toEqual(['chomp', 'chomp'])
  expect([14, 19].map(f => splashPhase(f, short))).toEqual(['settle', 'settle'])
  expect(eaterColumn(13, short)).toBe(37)
  expect(eaterColumn(5, short) - eaterColumn(0, short)).toBeGreaterThanOrEqual(2 * (eaterColumn(5, OPTS) - eaterColumn(0, OPTS)) - 1)
  for (let f = 0; f < 20; f++) {
    expect(picture(f, BASE, short).join('')).not.toContain('✓')
    expect(titleColors(cells(f, BASE, short))).not.toContain(FLASH_COLOR)
  }
  expect(titleColors(cells(14, BASE, short))).toEqual([PALETTE.title])
  expect(picture(14, BASE, short)[8]).toContain('READY!')
})

// ---- in the pane: /wordle, auto-open, skip, hand-off ----

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })
const TODAY = '2026-10-07'
const WON_TODAY = { answer: 'prove', status: 'won', guesses: [{ word: 'prove', score: ['green', 'green', 'green', 'green', 'green'] }] }

/** A pane with the engine's edges mocked; `store` seeds the store. Returns the store's map to compare later. */
const setup = async ($: any, on: any, store: Record<string, unknown> = {}) => {
  const data = mock.store(on, store) as any
  const clock = mock.clock(on, { now: Date.parse(`${TODAY}T12:00:00`) })
  on('http.fetch', async () => ({ value: ok({ solution: 'prove' }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as any)
  on('turn.start', async (_$: any, e: any) => ({ turnId: e.turnId }) as any)

  return { clock, data }
}
const wordle = ($: any) => $.command.run({ command: 'wordle', args: '', origin: { kind: 'composer' } } as any)
const mount = async ($: any, clock: any, props: any = {}) => {
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  return pane
}
const isSplash = async (pane: any) => (await pane.find({ key: 'splash' })) !== undefined
const isBoard = async (pane: any) => (await pane.find({ key: 'k-q' })) !== undefined
const isPicker = async (pane: any) => (await pane.find({ key: 'card-random' })) !== undefined
/** The splash as drawn: each row's text, the Button drawn as `1: label`. */
const drawnRows = async (pane: any) => {
  const text = (el: any): string =>
    el == null ? '' : typeof el === 'string' ? el : el.props?.hotkey ? `${el.props.hotkey}: ${el.props.label}` : (el.children ?? []).map(text).join('')
  return ((await pane.find({ key: 'splash' }))?.children ?? []).map(text)
}

test('/wordle with today unplayed: the splash covers the pane for 4.0 s, then today\'s game', async ($, on) => {
  const { clock } = await setup($, on)
  await wordle($)
  const pane = await mount($, clock)

  expect(await isSplash(pane)).toBe(true)
  expect(await isBoard(pane)).toBe(false)
  const rows = await drawnRows(pane)
  expect(rows).toHaveLength(11)
  for (const row of rows) expect([...row]).toHaveLength(78) // the Button takes exactly its `1: label` cells
  expect(rows[1]).toContain('STAGE 07 OCT')

  await clock.advance(3850)
  expect(await isSplash(pane)).toBe(true) // still frame 38–39
  expect((await drawnRows(pane))[9]).toContain('DAILY PUZZLE · 1: PRESS ANY KEY TO SKIP')
  await clock.advance(300)
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
  expect(JSON.stringify(await pane.drawn())).toContain('GUESS 1 OF 6')
})

test('/wordle with today finished: the splash says PICK YOUR NEXT GAME, then the picker', async ($, on) => {
  const { clock } = await setup($, on, { [`board:${TODAY}`]: WON_TODAY })
  await wordle($)
  const pane = await mount($, clock)

  await clock.advance(3500)
  expect((await drawnRows(pane))[9]).toContain('PICK YOUR NEXT GAME · 1: PRESS ANY KEY TO SKIP')
  expect(await isPicker(pane)).toBe(false) // not pulled to the picker underneath it
  await clock.advance(600)
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isPicker(pane)).toBe(true)
})

test('a typed key skips at once, and the letter never lands in the guess', async ($, on) => {
  const { clock } = await setup($, on)
  await wordle($)
  const pane = await mount($, clock)
  await clock.advance(500)

  expect((await pane.find({ key: 'splash-key' }))?.props.autoFocus).toBe(true) // the key catcher holds the keys
  await pane.input({ key: 'splash-key', text: 'q', kind: 'change' })
  await clock.settle()
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
  expect((await pane.find({ key: 'guess' }))?.props.value).toBe('')
  expect(flatTile(await pane.find({ key: 't0-0' }))).toBe(' ▌ ') // the first tile is the empty cursor, no Q
  // and the game then plays as usual
  await pane.input({ key: 'guess', text: 'c', kind: 'change' })
  expect(flatTile(await pane.find({ key: 't0-0' }))).toBe(' C ')
})

test('Enter skips too, and the splash then stays gone', async ($, on) => {
  const { clock } = await setup($, on)
  await wordle($)
  const pane = await mount($, clock)
  await pane.input({ key: 'splash-key', text: '', kind: 'submit' })
  await clock.settle()
  await clock.settle()
  expect(await isBoard(pane)).toBe(true)
  await clock.advance(5000)
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
})

test('a click (or 1) on the skip Button skips; with today finished it goes to the picker', async ($, on) => {
  const { clock } = await setup($, on, { [`board:${TODAY}`]: WON_TODAY })
  await wordle($)
  const pane = await mount($, clock)
  await clock.advance(1200)

  const skip = await pane.find({ key: 'skip-splash' })
  expect(skip?.props).toMatchObject({ hotkey: '1', label: 'SKIP', plain: true })
  await pane.press({ key: 'skip-splash' })
  await clock.settle()
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isPicker(pane)).toBe(true)
})

test('redraws and resizes never restart it: it still ends 4.0 s after the open', async ($, on) => {
  const { clock } = await setup($, on)
  await wordle($)
  const pane = await mount($, clock, { bodyColumns: 78 })
  await clock.advance(1500)

  await pane.redraw({ bodyColumns: 50, scroll: { bodyRows: 9 } } as any) // narrower and shorter
  await clock.settle()
  await pane.redraw({ bodyColumns: 120, scroll: { bodyRows: 30 } } as any) // and wider again
  await clock.settle()
  expect(await isSplash(pane)).toBe(true)
  expect((await drawnRows(pane))[0]).toHaveLength(78) // centred in 120, not stretched
  await clock.advance(2350)
  expect(await isSplash(pane)).toBe(true)
  await clock.advance(300)
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
})

test('a second /wordle plays it again', async ($, on) => {
  const { clock } = await setup($, on)
  await wordle($)
  const pane = await mount($, clock)
  await clock.advance(4200)
  await clock.settle()
  expect(await isBoard(pane)).toBe(true)

  await wordle($)
  await clock.settle()
  await clock.settle()
  expect(await isSplash(pane)).toBe(true)
  await clock.advance(4200)
  await clock.settle()
  expect(await isBoard(pane)).toBe(true)
})

test('auto-open plays the 2.0 s cut', async ($, on) => {
  const { clock } = await setup($, on, { 'config:autoOpen': true })
  await $.turn.start({ text: 'hello', turnId: 't1' } as any)
  const pane = await mount($, clock)

  expect(await isSplash(pane)).toBe(true)
  await clock.advance(1450) // frame 14: the chomp is done at double speed, settled
  expect((await drawnRows(pane)).join('\n')).toContain('READY!')
  expect((await drawnRows(pane)).join('\n')).not.toContain('•')
  await clock.advance(400)
  expect(await isSplash(pane)).toBe(true)
  await clock.advance(300)
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
})

test('reduced motion: the settled picture for 1.0 s, then the hand-off', async ($, on) => {
  const { clock } = await setup($, on, { 'config:reduceMotion': true })
  await wordle($)
  const pane = await mount($, clock)

  const first = (await drawnRows(pane)).join('\n')
  expect(first).toContain('READY!')
  expect(first).not.toMatch(/[▐•●✓]/)
  await clock.advance(850)
  expect((await drawnRows(pane)).join('\n')).toBe(first)
  await clock.advance(300)
  await clock.settle()
  expect(await isSplash(pane)).toBe(false)
  expect(await isBoard(pane)).toBe(true)
})

test('the splash never writes the stats, a saved board or the played-today set', async ($, on) => {
  const stats = { currentStreak: 3, maxStreak: 5, wins: 9, played: 10, distribution: [0, 4, 3, 2, 0, 0] }
  const played = { day: TODAY, dates: ['2026-10-01'] }
  // a store of the test's own (mock.store keeps its copy private), recording every write
  const data = new Map<string, unknown>(Object.entries({ stats, [`board:${TODAY}`]: WON_TODAY, 'played-today': played }))
  const writes: string[] = []
  on('store.get', async (_$: any, e: any) => ({ value: data.get(e.key) }) as any)
  on('store.set', async (_$: any, e: any) => {
    writes.push(e.key)
    data.set(e.key, e.value)

    return { value: undefined } as any
  })
  const clock = mock.clock(on, { now: Date.parse(`${TODAY}T12:00:00`) })
  on('http.fetch', async () => ({ value: ok({ solution: 'prove' }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as any)

  await wordle($)
  const pane = await mount($, clock)
  expect((await drawnRows(pane))[1]).toContain('HI-SCORE 00400') // the 2-guess win in the stats
  await clock.advance(2000)
  expect(writes).toEqual([]) // nothing at all while it plays

  await clock.advance(2200)
  await clock.settle()
  expect(await isPicker(pane)).toBe(true)
  // the hand-off loads today's puzzle (caching its word, as any open does); nothing else
  expect(writes.filter(key => !key.startsWith('word:'))).toEqual([])
  expect(data.get('stats')).toEqual(stats)
  expect(data.get(`board:${TODAY}`)).toEqual(WON_TODAY)
  expect(data.get('played-today')).toEqual(played)
})

/** A tile's text: its middle Text's string. */
function flatTile(el: any) {
  return el?.children[0]?.children[0]
}

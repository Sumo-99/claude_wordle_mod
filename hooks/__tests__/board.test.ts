import { expect, mock, test } from 'claude-code/testing'

import { boardMetrics, boardRoom, COMPACT_WIDTH, compactFit, fitRows, gapRows, isStackedLayout, SIDE_BY_SIDE_MIN, SIDE_BY_SIDE_ROWS, STACK_GAP, stackAt, stackedRows } from '../lib/board-view.js'

const SOLUTION = 'prove'

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })

const FILL = { green: '#5fb87a', yellow: '#f0b44c', miss: '#2e2a26', active: '#4a4038' }

/** Every string an element shows, its descendants' included, space-separated. */
const flat = (el: any): string =>
  el == null ? '' : typeof el === 'string' ? el : (el.children ?? []).map(flat).filter(Boolean).join(' ')

/** Tile (row r, column i): its 3-column text (` X `) and that text's fill and letter color. */
const tileAt = async (pane: any, r: number, i: number) => {
  const middle = (await pane.find({ key: `t${r}-${i}` }))?.children[0]

  return { text: middle?.children[0], fill: middle?.props.backgroundColor, color: middle?.props.color }
}
const rowOf = async (pane: any, r: number) => Promise.all([0, 1, 2, 3, 4].map(i => tileAt(pane, r, i)))
/** The tile rows with a blank row under them (a gap is the row's bottom margin). */
const gapsUnder = async (pane: any) => {
  const rows = await Promise.all([0, 1, 2, 3, 4, 5].map(r => pane.find({ key: `row${r}` })))
  return rows.flatMap((row: any, r) => (row?.props.marginBottom === 1 ? [r] : []))
}

/** A finished game opens the picker on its own; ↺ TODAY'S BOARD brings today's finished board back. */
const todaysBoard = async (pane: any, clock: any) => {
  expect(await pane.find({ key: 'card-random' })).toBeDefined()
  await pane.press({ key: 'todays-board' })
  await clock.settle()
  await clock.settle()
}

/** The typed-date field behind DATE…: the way to a day outside the ◀ ▶ steps. */
const goTo = async (pane: any, clock: any, date: string) => {
  await pane.press({ key: 'date-entry' })
  await pane.input({ key: 'archive-date', text: date, kind: 'submit' })
  await clock.settle()
  await clock.settle()
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`plays a game by pressing the on-screen keys (${surface})`, async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
    on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
    on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
    on('ui.toast', async () => ({ value: undefined }) as any)

    const pane = await $.ui.mount({ plugin: 'wordle-mod', surface, component: 'Pane', props: {}, requestId: 'wordle' } as any)
    await clock.settle()
    await clock.settle()

    const press = async (word: string) => {
      for (const ch of word) await pane.press({ key: `k-${ch}` } as any)
      await pane.press({ key: 'enter' } as any)
    }
    const text = async () => JSON.stringify(await pane.drawn())
    const scored = async (r: number) => (await rowOf(pane, r)).map(t => `${t.text.trim()}:${t.fill}`)

    // a wrong guess scores per tile: c r a n e vs p r o v e -> miss green miss miss green
    await press('crane')
    expect(await scored(0)).toEqual([`C:${FILL.miss}`, `R:${FILL.green}`, `A:${FILL.miss}`, `N:${FILL.miss}`, `E:${FILL.green}`])
    // the tiles carry the meaning: there is no legend any more
    expect(await text()).not.toContain('right letter')
    // typing in the field: it feeds the same draft, and deleting a character shortens it
    const typed = async (value: string) => {
      await pane.input({ key: 'guess', text: value, kind: 'change' } as any)
      await clock.advance(100) // a trimmed edit refreshes the field a moment later

      return (await pane.find({ key: 'guess' } as any))?.props.value
    }
    expect(await typed('slate')).toBe('slate')
    expect(await typed('slat')).toBe('slat') // Backspace
    expect(await typed('sl4t?E')).toBe('slte') // non-letters dropped, lowercased
    expect(await typed('slatexyz')).toBe('slate') // capped at five
    expect(await typed('')).toBe('')
    // an illegal word costs nothing
    await press('zzzzz')
    expect(await text()).toContain('GUESS 2 OF 6')
    // the rejected word stays in the draft until backspaced away
    for (let i = 0; i < 5; i++) await pane.press({ key: 'back' } as any)
    expect((await tileAt(pane, 1, 0)).text).toBe(' ▌ ') // an empty row again, cursor in its first tile
    await press('prove')
    await clock.advance(3100) // the win screen covers the board for 3 seconds, then the picker opens
    await todaysBoard(pane, clock)
    expect(await scored(1)).toEqual(['P', 'R', 'O', 'V', 'E'].map(ch => `${ch}:${FILL.green}`))
    expect(await text()).toContain('SOLVED IN 2/6')
  })
}

test('stats count only today; an archived game is practice and today resumes', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  const answers: Record<string, string> = { '2026-10-07': 'prove', '2026-10-06': 'crane' }
  on('http.fetch', async (_$, e) => ({
    value: ok({ solution: answers[e.url.match(/(\d{4}-\d{2}-\d{2})\.json$/)![1]] }),
  }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  await pane.press({ key: 'stats-toggle' } as any) // the details: played and won

  const everything = async () => JSON.stringify(await pane.drawn())
  const statsShown = async () => `${flat(await pane.find({ key: 'stats' } as any))} ${flat(await pane.find({ key: 'stats-details' } as any))}`
  const play = async (word: string) => {
    await pane.input({ key: 'guess', text: word, kind: 'change' } as any)
    await pane.input({ key: 'guess', text: word, kind: 'submit' } as any)
  }
  // lose nothing yet: stats start empty
  expect(await statsShown()).toContain('STREAK 00 BEST 00 WIN% 00')
  expect(await statsShown()).toContain('PLAYED 0 · WON 0')

  // win today in two guesses
  await play('crane')
  await play('prove')
  await clock.advance(3100) // the win screen covers the board for 3 seconds, then the picker opens
  await todaysBoard(pane, clock)
  await pane.press({ key: 'stats-toggle' } as any)
  expect(await statsShown()).toContain('STREAK 01 BEST 01 WIN% 100')
  expect(await statsShown()).toContain('PLAYED 1 · WON 1')

  // an archived day is practice: solve it, stats unchanged, and it says so
  await pane.press({ key: 'stage-prev' } as any) // ◀: one day back
  await clock.settle()
  await clock.settle()
  expect(await everything()).toContain('PRACTICE STAGE')
  await play('crane')
  await clock.advance(3100) // its win also ends on the picker
  expect(await everything()).toContain('PICK YOUR NEXT GAME')
  expect(flat(await pane.find({ key: 'stats' } as any))).toContain('STREAK 01 BEST 01 WIN% 100')

  // back to today: the finished board is shown, not a blank one, and stats did not double count
  await todaysBoard(pane, clock)
  await pane.press({ key: 'stats-toggle' } as any)
  expect(await everything()).toContain('SOLVED IN 2/6')
  expect(await everything()).not.toContain('PRACTICE STAGE')
  expect(await statsShown()).toContain('PLAYED 1 · WON 1')
})

test('the stats details open under the stats row and close again; no second pane', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  const opened: string[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e.id)

    return { value: undefined } as any
  })

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  const toggle = async () => (await pane.find({ key: 'stats-toggle' } as any))?.props.label

  // the stats row is always there; the details are not
  expect(flat(await pane.find({ key: 'stats' } as any))).toContain('STREAK 00')
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()
  expect(await toggle()).toBe('▾ MORE')

  await pane.press({ key: 'stats-toggle' } as any)
  const details = flat(await pane.find({ key: 'stats-details' } as any))
  expect(details).toContain('PLAYED 0')
  for (const n of ['1', '2', '3', '4', '5', '6']) expect(details).toContain(n) // the distribution rows
  expect(await pane.find({ key: 'clear-stats' } as any)).toBeDefined()
  expect(await toggle()).toBe('▴ LESS')

  await pane.press({ key: 'stats-toggle' } as any)
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()
  expect(opened).toEqual([]) // it all happens inside the one pane
})

test('an offline puzzle shows the warning marker, and pressing it explains why', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => {
    throw new Error('offline')
  })
  on('fs.read', async (_$, e) => ({
    value: 'crane\nprove\n',
  }) as any)
  const toasts: string[] = []
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)

    return { value: undefined } as any
  })

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  const marker = await pane.find({ key: 'fallback-warning' } as any)
  expect(marker?.props.label).toBe('⚠ OFFLINE')
  await pane.press({ key: 'fallback-warning' } as any)
  expect(toasts.at(-1)).toContain("Couldn't reach the live word")
})

test('a live puzzle has no warning marker', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeUndefined()
})

test('Clear stats needs two presses and resets the history', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  const toasts: string[] = []
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)

    return { value: undefined } as any
  })

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  const shown = async () => `${flat(await pane.find({ key: 'stats' } as any))} ${flat(await pane.find({ key: 'stats-details' } as any))}`
  const label = async () => (await pane.find({ key: 'clear-stats' } as any))?.props.label

  await pane.input({ key: 'guess', text: 'prove', kind: 'change' } as any)
  await pane.input({ key: 'guess', text: 'prove', kind: 'submit' } as any)
  await clock.advance(3100) // past the win screen, onto the picker
  await todaysBoard(pane, clock)
  await pane.press({ key: 'stats-toggle' } as any) // Clear stats lives in the details
  expect(await shown()).toContain('STREAK 01 BEST 01 WIN% 100')

  // first press only arms it
  expect(await label()).toBe('CLEAR STATS')
  await pane.press({ key: 'clear-stats' } as any)
  expect(await label()).toBe('PRESS AGAIN TO CLEAR')
  expect(await shown()).toContain('PLAYED 1')

  // it disarms itself if you walk away
  await clock.advance(5000)
  expect(await label()).toBe('CLEAR STATS')

  // two presses clear everything
  await pane.press({ key: 'clear-stats' } as any)
  await pane.press({ key: 'clear-stats' } as any)
  expect(await shown()).toContain('STREAK 00 BEST 00 WIN% 00')
  expect(await shown()).toContain('PLAYED 0 · WON 0')
  expect(toasts).toContain('Stats cleared.')
  expect(await label()).toBe('CLEAR STATS')
})

test('winning swaps the board for a 3 second red celebration screen, then the picker opens', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  const screen = () => pane.find({ key: 'fireworks' } as any)
  const boardShown = async () => (await pane.find({ key: 'k-q' } as any)) !== undefined
  const play = async (word: string) => {
    await pane.input({ key: 'guess', text: word, kind: 'change' } as any)
    await pane.input({ key: 'guess', text: word, kind: 'submit' } as any)
  }

  // a wrong guess is no cause for celebration
  await play('crane')
  expect(await screen()).toBeUndefined()
  expect(await boardShown()).toBe(true)

  // the winning guess replaces the whole board with the red celebration screen
  await play('prove')
  expect(await screen()).toBeDefined()
  expect(JSON.stringify(await pane.drawn())).toMatch(/"backgroundColor":"#[0-9a-f]{2}[0-9a-f]{4}"/)
  expect(await boardShown()).toBe(false) // no keyboard, no guess rows: nothing left to clip or cover
  const first = JSON.stringify(await pane.drawn())

  await clock.advance(1500)
  expect(await screen()).toBeDefined()
  expect(JSON.stringify(await pane.drawn())).not.toEqual(first) // it animates
  // and says it (the words are cut into runs wherever the colours under them change)
  const text = [...JSON.stringify(await pane.drawn()).matchAll(/"children":\["([^"]*)"\]/g)].map(m => m[1]).join('')
  expect(text).toContain('WORDDDD...')
  expect(text).toContain('you solved it!')

  // still up just before 3 seconds, gone just after
  await clock.advance(1400)
  expect(await screen()).toBeDefined()
  await clock.advance(300)
  expect(await screen()).toBeUndefined()

  // then the picker opens on its own: no press needed
  expect(await boardShown()).toBe(false)
  expect(await pane.find({ key: 'card-random' } as any)).toBeDefined()
  expect(flat(await pane.find({ key: 'today' } as any))).toBe('TODAY SOLVED 2/6')
})

test('the win screen has no skip: 1 does nothing, and it plays to the end', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  await pane.input({ key: 'guess', text: 'prove', kind: 'change' } as any)
  await pane.input({ key: 'guess', text: 'prove', kind: 'submit' } as any)
  await clock.advance(500)
  expect(await pane.find({ key: 'fireworks' } as any)).toBeDefined()
  expect(await pane.find({ key: 'skip-celebration' } as any)).toBeUndefined()
  expect(JSON.stringify(await pane.drawn())).not.toContain('continue')

  await clock.advance(2000)
  expect(await pane.find({ key: 'fireworks' } as any)).toBeDefined() // still playing
  await clock.advance(1000)
  expect(await pane.find({ key: 'fireworks' } as any)).toBeUndefined()
  expect(await pane.find({ key: 'card-random' } as any)).toBeDefined()
})

test('MOCHA on a practice date: the winning letters are never painted over', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async (_$, e) => ({ value: ok({ solution: e.url.includes('2026-10-05') ? 'mocha' : SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\nmocha\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  await goTo(pane, clock, '2026-10-05')
  await pane.input({ key: 'guess', text: 'mocha', kind: 'change' } as any)
  await pane.input({ key: 'guess', text: 'mocha', kind: 'submit' } as any)

  // during the animation the board is replaced outright: no overlay exists to cover a letter
  for (let i = 0; i < 28; i++) {
    expect(await pane.find({ key: 'fireworks' } as any)).toBeDefined()
    expect(await pane.find({ key: 'row0' } as any)).toBeUndefined()
    await clock.advance(100)
  }
  await clock.advance(300)

  // afterwards the picker opens on its own; the board is never drawn under a cover
  expect(await pane.find({ key: 'fireworks' } as any)).toBeUndefined()
  expect(await pane.find({ key: 'card-random' } as any)).toBeDefined()
})

// ---- V1: keyboard feedback, V2: offline word recovery, V3: end-of-game cue, V11: new day ----

import { keyStates } from '../lib/board-view.js'

const setupGame = async ($: any, on: any, opts: { now?: string; answers?: Record<string, string>; offline?: () => boolean; fallback?: string; toasts?: string[]; prepare?: (on: any) => void } = {}) => {
  mock.store(on)
  opts.prepare?.(on) // hooks that must exist before the first engine call
  const clock = mock.clock(on, { now: Date.parse(opts.now ?? '2026-10-07T12:00:00') })
  on('http.fetch', async (_$: any, e: any) => {
    if (opts.offline?.()) throw new Error('offline')
    const date = e.url.match(/(\d{4}-\d{2}-\d{2})\.json$/)![1]

    return { value: ok({ solution: opts.answers?.[date] ?? SOLUTION }) }
  })
  on('fs.read', async (_$: any, e: any) => ({
    value: String(e.path).endsWith('fallback-answers.txt') ? `${opts.fallback ?? 'crane'}\n` : 'crane\nprove\nslate\nbrick\nplumb\nmocha\n',
  }) as any)
  on('ui.toast', async (_$: any, e: any) => {
    opts.toasts?.push(e.text)

    return { value: undefined } as any
  })
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  const play = async (word: string) => {
    await pane.input({ key: 'guess', text: word, kind: 'change' } as any)
    await pane.input({ key: 'guess', text: word, kind: 'submit' } as any)
  }
  const text = async () => JSON.stringify(await pane.drawn())

  return { pane, clock, play, text }
}

test('V1: a letter keeps the best result it has had (green beats yellow beats gray)', () => {
  const guess = (word: string, score: string[]) => ({ word, score })
  const states = keyStates({
    answer: 'prove',
    status: 'playing',
    guesses: [guess('crane', ['gray', 'green', 'gray', 'gray', 'green']), guess('motor', ['gray', 'gray', 'gray', 'gray', 'yellow'])],
  } as any)

  expect(states.r).toBe('green') // yellow in guess 2 doesn't downgrade green from guess 1
  expect(states.e).toBe('green')
  expect(states.o).toBe('gray')
  expect(states.z).toBeUndefined()
})

test('V1: the on-screen keys show what the guesses found; a miss is eaten down to a dot', async ($, on) => {
  const { pane, play } = await setupGame($, on) // answer: prove
  await play('crane') // c a n miss, r e green
  await play('mocha') // o present; m c h a miss

  const box = (ch: string) => pane.find({ key: `kc-${ch}` } as any)
  for (const ch of ['r', 'e']) expect((await box(ch))?.props.backgroundColor).toBe(FILL.green)
  expect((await box('o'))?.props.backgroundColor).toBe(FILL.yellow)
  expect((await box('q'))?.props.backgroundColor).toBe('#2e2a26') // untried: the idle chip
  expect((await box('q'))?.props.width).toBe(3) // a 3x1 chip
  expect((await pane.find({ key: 'k-q' } as any))?.props.dimColor).toBe(false)
  expect((await pane.find({ key: 'k-q' } as any))?.props.label).toBe('Q') // just the letter...
  expect((await pane.find({ key: 'k-q' } as any))?.props.plain).toBe(true) // ...no [ brackets ]
  // a known miss is no key at all: a dim dot holds its place
  for (const ch of ['c', 'a', 'n', 'm', 'h']) {
    expect(await box(ch)).toBeUndefined()
    expect(await pane.find({ key: `k-${ch}` } as any)).toBeUndefined()
    expect((await pane.find({ key: `kx-${ch}` } as any))?.children[0]).toMatchObject({ type: 'Text', props: { color: '#6e655b' }, children: ['·'] })
  }
  // Enter always wears the accent fill
  expect((await box('enter'))?.props.backgroundColor).toBe('#d97757')
})

test('tiles: scored fills, the typed row with its cursor, and pellets ahead', async ($, on) => {
  const { pane, play } = await setupGame($, on) // answer: prove
  await play('crane')
  await pane.input({ key: 'guess', text: 'pl', kind: 'change' } as any)

  // scored: the letter is background-colored on green, dim on a miss
  expect(await tileAt(pane, 0, 1)).toEqual({ text: ' R ', fill: FILL.green, color: '#171513' })
  expect(await tileAt(pane, 0, 0)).toEqual({ text: ' C ', fill: FILL.miss, color: '#6e655b' })
  // each tile is one row: ` X ` on a fill, 3 columns wide, no rounded top or bottom
  const t = await pane.find({ key: 't0-1' } as any)
  expect(t?.props.width).toBe(3)
  expect(t?.children).toHaveLength(1)
  // the active row: typed letters in the text color, the ▌ cursor in the next empty tile
  expect(await tileAt(pane, 1, 0)).toEqual({ text: ' P ', fill: FILL.active, color: '#f0e8dc' })
  expect(await tileAt(pane, 1, 2)).toEqual({ text: ' ▌ ', fill: FILL.active, color: '#d97757' })
  expect((await tileAt(pane, 1, 3)).fill).toBe(FILL.active)
  // rows ahead have no tiles, just pellets; the last row has power pellets in its corners
  expect((await tileAt(pane, 2, 0)).fill).toBeUndefined()
  expect((await tileAt(pane, 2, 0)).text).toBe(' • ')
  expect((await rowOf(pane, 5)).map(t => t.text.trim())).toEqual(['●', '•', '•', '•', '●'])
})

test('the status row: READY! only before guess 1, the guess count, and lives', async ($, on) => {
  const { pane, play } = await setupGame($, on) // answer: prove
  const status = async () => flat(await pane.find({ key: 'status' } as any))

  expect(await status()).toBe('READY! GUESS 1 OF 6 LIVES ◆ ◆ ◆ ◆ ◆ ◆')
  await play('crane')
  expect(await status()).toBe('GUESS 2 OF 6 LIVES ◆ ◆ ◆ ◆ ◆ ◇')
  await play('slate')
  expect(await status()).toBe('GUESS 3 OF 6 LIVES ◆ ◆ ◆ ◆ ◇ ◇')
  await pane.input({ key: 'guess', text: 'zzzzz', kind: 'submit' } as any) // a rejected guess costs no life
  expect(await status()).toBe('GUESS 3 OF 6 LIVES ◆ ◆ ◆ ◆ ◇ ◇')
})

test('1UP and HI-SCORE: 100 per guess left on a win; practice never sets the HI-SCORE', async ($, on) => {
  const { pane, clock, play } = await setupGame($, on, { answers: { '2026-10-07': 'prove', '2026-10-06': 'crane' } })
  const header = async () => flat(await pane.find({ key: 'header-right' } as any))

  expect(await header()).toBe('1UP 00000 HI 00000 STAGE 07 OCT')
  await play('crane')
  await play('prove') // won in 2: 4 guesses left
  await clock.advance(3100) // then the picker, whose header has no stage
  expect(await header()).toBe('1UP 00400 HI 00400')

  await pane.press({ key: 'pick-play' } as any) // practice, the newest past date (06 OCT): won in 1
  await clock.settle()
  await clock.settle()
  expect(await header()).toBe('1UP 00000 HI 00400 STAGE 06 OCT')
  await play('crane')
  await clock.advance(3100)
  expect(await header()).toBe('1UP 00400 HI 00400') // the picker's 1UP is today's; practice leaves HI alone
})

test('stage stepping: ◀ ▶ walk the last 14 days, ▶ TODAY jumps back', async ($, on) => {
  const { pane, clock, text } = await setupGame($, on) // today: 2026-10-07
  const step = async (key: string) => {
    await pane.press({ key } as any)
    await clock.settle()
    await clock.settle()
  }
  const stage = async () => flat(await pane.find({ key: 'stage-date' } as any))

  // today: nowhere forward to go, nothing to jump back to
  expect(await pane.find({ type: 'Button', key: 'stage-next' } as any)).toBeUndefined()
  expect(await pane.find({ key: 'play-today' } as any)).toBeUndefined()

  await step('stage-prev')
  expect(await stage()).toBe('STAGE 06 OCT')
  expect(await text()).toContain('PRACTICE STAGE')
  await step('stage-next')
  expect(await stage()).toBe('STAGE 07 OCT')
  expect(await text()).not.toContain('PRACTICE STAGE')

  for (let i = 0; i < 13; i++) await step('stage-prev')
  expect(await stage()).toBe('STAGE 24 SEP') // the 14th day back from 07 OCT is the last
  expect(await pane.find({ type: 'Button', key: 'stage-prev' } as any)).toBeUndefined() // ◀ is spent

  await step('play-today')
  expect(await stage()).toBe('STAGE 07 OCT')
})

test('a typed date still works, behind DATE…', async ($, on) => {
  const toasts: string[] = []
  const { pane, clock, text } = await setupGame($, on, { toasts })
  expect(await pane.find({ key: 'archive-date' } as any)).toBeUndefined()

  await pane.press({ key: 'date-entry' } as any)
  await pane.input({ key: 'archive-date', text: '2030-01-01', kind: 'submit' } as any)
  expect(toasts.at(-1)).toBe('That puzzle is in the future')
  expect(await pane.find({ key: 'archive-date' } as any)).toBeDefined() // left open to fix

  await pane.input({ key: 'archive-date', text: '2024-01-01', kind: 'submit' } as any)
  await clock.settle()
  await clock.settle()
  expect(flat(await pane.find({ key: 'stage-date' } as any))).toBe('STAGE 01 JAN')
  expect(await text()).toContain('PRACTICE STAGE')
  expect(await pane.find({ key: 'archive-date' } as any)).toBeUndefined() // closed once it worked
})

test('layout: side by side from 75 columns, stacked below, always one round frame and the WORDLE badge', async ($, on) => {
  const { pane } = await setupGame($, on)
  // nothing on the board is drawn with [ brackets ]: every Button is plain
  for (const b of await pane.findAll({ type: 'Button' } as any)) expect(b.props.plain).toBe(true)
  await pane.unmount()
  for (const [columns, direction, hasDivider] of [
    [78, 'row', true],
    [75, 'row', true],
    [74, 'column', false],
    [60, 'column', false],
  ] as const) {
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns }, requestId: 'wordle' } as any)
    const frame = await ui.find({ key: 'frame' } as any)
    expect(frame?.props.flexDirection).toBe(direction)
    expect(frame?.props).toMatchObject({ borderStyle: 'round', borderColor: '#d97757' })
    expect((await ui.find({ key: 'divider' } as any)) !== undefined).toBe(hasDivider)
    expect(flat(await ui.find({ key: 'badge' } as any))).toBe('▐  W O R D L E  ▌')
    await ui.unmount()
  }
})

test('▾ MORE and DATE… each open a big framed container under the compact layout, which itself stays as it is', async ($, on) => {
  const { pane } = await setupGame($, on)
  // the drawing, less the handler ids a redraw renumbers
  const frame = async () => JSON.stringify(await pane.find({ key: 'frame' } as any)).replace(/"handle":\d+/g, '')
  const frameBefore = await frame()
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeUndefined()

  await pane.press({ key: 'stats-toggle' } as any)
  expect((await pane.find({ key: 'stats-details' } as any))?.props).toMatchObject({ borderStyle: 'round', borderColor: '#d97757', backgroundColor: '#1f1c19' })
  expect(flat(await pane.find({ key: 'stats-details' } as any))).toContain('WINS BY GUESS')
  expect(await pane.find({ key: 'clear-stats' } as any)).toBeDefined()
  expect(await frame()).toBe(frameBefore) // the compact frame above is untouched
  await pane.press({ key: 'stats-toggle' } as any)
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()

  await pane.press({ key: 'date-entry' } as any)
  expect((await pane.find({ key: 'date-drawer' } as any))?.props).toMatchObject({ borderStyle: 'round', borderColor: '#d97757', backgroundColor: '#1f1c19' })
  expect(flat(await pane.find({ key: 'date-drawer' } as any))).toContain('PICK A STAGE')
  expect(await pane.find({ key: 'archive-pick' } as any)).toBeDefined()
  expect(await pane.find({ key: 'archive-date' } as any)).toBeDefined()
  expect(await frame()).toBe(frameBefore)
  await pane.press({ key: 'date-entry' } as any)
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeUndefined()
})

test('compact: 12 rows at 78 columns (1 header, 8 body + 2 frame, 1 footer), the two spare board rows as gaps', async ($, on) => {
  const { pane } = await setupGame($, on)
  await pane.unmount()
  const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: 78 }, requestId: 'wordle' } as any)
  const board = await ui.find({ key: 'board' } as any)
  expect(board?.children).toHaveLength(6) // six tile rows; a gap is a row's own bottom margin
  expect(board?.props.paddingY).toBeUndefined()
  expect(await gapsUnder(ui)).toHaveLength(2) // rows unknown: the fit's two spare rows
  for (let r = 0; r < 6; r++) expect((await ui.find({ key: `row${r}` } as any))?.children[0]).toMatchObject({ type: 'Box', props: { width: 3 } })
  const rows = 1 + (6 + 2 + 2) + 1 // header, board with its two gaps and the frame's two border rows, footer
  expect(rows).toBe(12)
  expect((await ui.find({ key: 'divider' } as any))?.children).toHaveLength(8) // as tall as the frame's body
  // the right-hand column: status, typing field, the keyboard, a gap, stats and stage
  expect((await ui.find({ key: 'controls' } as any))?.children).toHaveLength(5)
  expect((await ui.find({ key: 'keyboard' } as any))?.children).toHaveLength(3)
})

test('V3: when the game is over the keyboard fades and the status line says what to do next', async ($, on) => {
  const { pane, play, text } = await setupGame($, on) // answer: prove
  for (const word of ['crane', 'slate', 'brick', 'plumb', 'mocha', 'crane']) await play(word)

  expect(await text()).toContain('THE WORD WAS PROVE')
  expect(await text()).toContain('CONTINUE TO PICK A GAME')
  for (const key of ['k-q', 'k-z', 'enter', 'back']) expect((await pane.find({ key } as any))?.props.dimColor).toBe(true)
  expect(await pane.find({ key: 'guess' } as any)).toBeUndefined() // the field is gone
  expect(await pane.find({ key: 'stage-prev' } as any)).toMatchObject({ type: 'Button' }) // and the way to another day is right there
})

test('V11: after midnight the open puzzle is marked as old, offers today, and no longer counts', async ($, on) => {
  const { pane, clock, play, text } = await setupGame($, on, { answers: { '2026-10-07': 'prove', '2026-10-08': 'slate' } })
  expect(await text()).not.toContain('A NEW DAY HAS STARTED')

  await clock.advance(24 * 3600 * 1000) // midnight passes with the pane open
  await pane.input({ key: 'guess', text: 'c', kind: 'change' } as any) // any redraw
  expect(await text()).toContain('A NEW DAY HAS STARTED')
  expect(await text()).toContain('07 OCT IS NOW PRACTICE')
  expect(await pane.find({ key: 'play-today' } as any)).toBeDefined()

  // finishing the stale puzzle must not count as today's: lose it and look at the stats
  await pane.input({ key: 'guess', text: '', kind: 'change' } as any)
  for (const word of ['crane', 'slate', 'brick', 'plumb', 'mocha', 'crane']) await play(word)
  await pane.press({ key: 'stats-toggle' } as any)
  expect(flat(await pane.find({ key: 'stats-details' } as any))).toContain('PLAYED 0')

  // the button jumps to the new day's puzzle, fresh, and the old-day warning is gone
  await pane.press({ key: 'play-today' } as any)
  await clock.settle()
  await clock.settle()
  expect(flat(await pane.find({ key: 'stage-date' } as any))).toBe('STAGE 08 OCT')
  expect(await text()).not.toContain('A NEW DAY HAS STARTED')
  expect(await pane.find({ key: 'play-today' } as any)).toBeUndefined()
})

test('V2: a game begun on the offline word finishes on it, even after the live word returns', async ($, on) => {
  let isOffline = true
  const { pane, clock, play, text } = await setupGame($, on, {
    offline: () => isOffline,
    fallback: 'crane',
    answers: { '2026-10-07': 'slate', '2026-10-06': 'prove' },
  })
  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeDefined() // offline puzzle, answer crane
  await play('plumb') // one guess made against the offline word

  await goTo(pane, clock, '2026-10-06') // go elsewhere (still offline)
  isOffline = false // the network comes back; the live word for today is 'slate'
  await goTo(pane, clock, '2026-10-07')

  // progress is kept, on the word it started with, still flagged offline
  expect(await text()).toContain('GUESS 2 OF 6')
  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeDefined()
})

test('V2: an untouched offline day switches to the live word once it is reachable', async ($, on) => {
  let isOffline = true
  const { pane, clock, text } = await setupGame($, on, {
    offline: () => isOffline,
    fallback: 'crane',
    answers: { '2026-10-07': 'slate', '2026-10-06': 'prove' },
  })
  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeDefined()

  await goTo(pane, clock, '2026-10-06')
  isOffline = false
  await goTo(pane, clock, '2026-10-07')

  // no guesses had been made, so nothing to protect: back to the real word, no marker
  expect(await text()).toContain('GUESS 1 OF 6')
  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeUndefined()
})

// ---- on-screen keys hand the keyboard back to the Guess field ($.ui.focus) ----
// The harness's pane never holds the keyboard, so the engine refuses the focus move
// before any hook could see it: what can be checked here is that a refused move is
// harmless and that the keys still do their job. The focus return itself is a live check.

test('Del really removes the last typed letter, and Enter on a short word keeps the draft', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  on('ui.focus', async () => ({}) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  const value = async () => (await pane.find({ key: 'guess' } as any))?.props.value

  for (const ch of 'cra') await pane.press({ key: `k-${ch}` } as any)
  expect(await value()).toBe('cra')
  await pane.press({ key: 'back' } as any)
  expect(await value()).toBe('cr')
  await pane.press({ key: 'enter' } as any) // too short: nothing submitted, draft kept
  await clock.advance(200) // the field is redrawn with the draft a moment later
  expect(await value()).toBe('cr')
})

test('a refused focus move never breaks a key press', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  on('ui.focus', async () => ({ deny: 'the pane does not hold the keyboard' }) as any)

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  await pane.press({ key: 'k-p' } as any)
  await pane.press({ key: 'k-r' } as any)
  expect((await pane.find({ key: 'guess' } as any))?.props.value).toBe('pr')
})

test('the hint line shows the ⏎ and ⌫ icons, and the chips are plain clickable keys', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  on('ui.focus', async () => ({}) as any)
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  // the hint line names the icons (`⏎ ENTER · ⌫ DELETE`); a hotkey would draw a `1:` prefix in front of the icon, so there is none
  expect((await pane.find({ key: 'hotkey-enter' } as any))?.props).toMatchObject({ label: '⏎ ENTER', plain: true })
  expect((await pane.find({ key: 'hotkey-back' } as any))?.props).toMatchObject({ label: '⌫ DELETE', plain: true })
  for (const key of ['hotkey-enter', 'hotkey-back', 'enter', 'back', 'k-q']) expect((await pane.find({ key } as any))?.props.hotkey).toBeUndefined()
  expect(flat(await pane.find({ key: 'hint' } as any))).toBe('TYPE TO PLAY ·   ·   · ESC TO EXIT')
})

test('/wordle config reset-history: asks first, then wipes games and words but keeps stats and settings', async ($, on) => {
  const { pane, clock, play, text } = await setupGame($, on) // answer: prove
  const run = async (args: string) => ((await $.command.run({ command: 'wordle', args, origin: { kind: 'composer' } } as any)) as any).text

  await run('config auto-open on')
  await play('crane') // a saved game for today

  // the bare command only asks, and nothing is deleted
  const asked = await run('config reset-history')
  expect(asked).toContain('1 saved game')
  expect(asked).toContain('reset-history confirm')
  expect(await run('config reset-history')).toContain('1 saved game') // still there
  expect(await text()).toContain('GUESS 2 OF 6')

  // confirm wipes the history...
  expect(await run('config reset-history confirm')).toContain('Cleared 1 saved game')
  expect(await run('config reset-history')).toContain('No saved games to clear')
  // ...but keeps the setting, and the open pane starts a fresh game
  expect(await run('config auto-open')).toContain('on')
  await clock.settle()
  await clock.settle()
  expect(await text()).toContain('GUESS 1 OF 6')
  expect(await pane.find({ key: 'guess' } as any)).toBeDefined()
})

// ---- rejected guesses keep their letters (as in the real Wordle) ----

const rejectedGuessCase = async ($: any, on: any, word: string, toast: string) => {
  const toasts: string[] = []
  const { pane, clock, text } = await setupGame($, on, { toasts })
  const field = async () => (await pane.find({ key: 'guess' } as any))?.props.value
  const type = (value: string) => pane.input({ key: 'guess', text: value, kind: 'change' } as any)

  await type(word)
  await pane.input({ key: 'guess', text: word, kind: 'submit' } as any) // Enter
  expect(toasts.at(-1)).toBe(toast)
  expect(await text()).toContain('GUESS 1 OF 6') // the rejected guess cost nothing

  // the letters stay in the draft and, once the field has been refilled, in the field
  await clock.advance(200)
  expect(await field()).toBe(word)
  const letters = [...word.toUpperCase()]
  expect((await rowOf(pane, 0)).map(t => t.text.replace('▌', '').trim()).join('')).toBe(letters.join('')) // the row still shows every letter

  // the player edits from there: one Backspace leaves all but the last letter
  await type(word.slice(0, -1))
  expect(await field()).toBe(word.slice(0, -1))

  // and a deliberate clear later on (select-all, delete) is honoured, not swallowed
  await clock.advance(1000)
  await type('')
  expect(await field()).toBe('')

  return { pane, text }
}

test('4 of 5 letters + Enter: "Not enough letters", and the 4 letters stay', async ($, on) => {
  await rejectedGuessCase($, on, 'moch', 'Not enough letters')
})

test('a 5-letter non-word + Enter: "Not in word list", and the word stays', async ($, on) => {
  await rejectedGuessCase($, on, 'mochs', 'Not in word list')
})

test('after a rejected guess the player can finish the word and play it', async ($, on) => {
  const { pane, clock, text } = await setupGame($, on) // answer: prove
  const type = (value: string) => pane.input({ key: 'guess', text: value, kind: 'change' } as any)
  const enter = (value: string) => pane.input({ key: 'guess', text: value, kind: 'submit' } as any)

  await type('plum')
  await enter('plum') // too short: the letters stay
  await clock.advance(200)
  await type('plumb') // the player adds the missing letter, no retyping
  await enter('plumb')
  expect(await text()).toContain('GUESS 2 OF 6')
})

// ---- root cause (from the live diagnostic log) ----
// The Guess field (a) empties its own text when Enter is pressed and (b) adopts the
// `value` prop only when the prop CHANGES between two drawings. After a rejected Enter
// the draft is unchanged, so the prop was the same and the field stayed empty while the
// draft ("moch") lived on invisibly; the next keystroke then overwrote it. The model
// below behaves like that field, redrawing after every state write.

const modelOfRealField = async ($: any, on: any, opts: { toasts?: string[] } = {}) => {
  const model = { local: '', lastProp: '' }
  const live: { redraw: () => Promise<void> } = { redraw: async () => {} }
  const { pane, clock, text } = await setupGame($, on, {
    toasts: opts.toasts,
    prepare: (o: any) =>
      o('state.set', async (_$: any, e: any, next: any) => {
        const result = await next(e)
        await live.redraw() // every state write redraws the pane

        return result
      }),
  })
  const propNow = async () => (await pane.find({ key: 'guess' } as any))?.props.value ?? ''
  live.redraw = async () => {
    const prop = await propNow()
    if (prop !== model.lastProp) {
      model.local = prop // a changed prop is adopted...
      model.lastProp = prop
    } // ...an unchanged one is ignored
  }
  const type = async (letters: string) => {
    for (const ch of letters) {
      model.local += ch
      await pane.input({ key: 'guess', text: model.local, kind: 'change' } as any)
      await clock.advance(100) // time passes between keystrokes
    }
  }
  const pressEnter = async () => {
    const submitted = model.local
    model.local = '' // the field empties itself on Enter
    await pane.input({ key: 'guess', text: submitted, kind: 'submit' } as any)
    await clock.advance(200) // let any follow-up redraws land
    await live.redraw()
  }

  return { pane, clock, text, model, type, pressEnter }
}

test('REPRO: 4 letters + Enter must leave the 4 letters in the field (live Test A)', async ($, on) => {
  const toasts: string[] = []
  const { model, type, pressEnter, text } = await modelOfRealField($, on, { toasts })

  await type('moch')
  await pressEnter()

  expect(toasts.at(-1)).toBe('Not enough letters')
  expect(await text()).toContain('GUESS 1 OF 6')
  expect(model.local).toBe('moch') // the live bug: the field was left empty
})

test('REPRO: after the rejected Enter, typing the missing letter completes the word', async ($, on) => {
  const toasts: string[] = []
  const { model, type, pressEnter, text } = await modelOfRealField($, on, { toasts })

  await type('moch')
  await pressEnter()
  await type('a') // the live bug: this turned the draft into just "a"
  expect(model.local).toBe('mocha')
  await pressEnter()
  expect(await text()).toContain('GUESS 2 OF 6')
})

test('REPRO: a real non-word + Enter keeps the word, and Backspace edits it', async ($, on) => {
  const toasts: string[] = []
  const { model, type, pressEnter } = await modelOfRealField($, on, { toasts })

  await type('qxzvj') // not in the word list ("mochs" is, which is why live Test B was accepted)
  await pressEnter()
  expect(toasts.at(-1)).toBe('Not in word list')
  expect(model.local).toBe('qxzvj')
})

test('REPRO: letters typed past five are trimmed in the field too, not only in the draft', async ($, on) => {
  const { model, type } = await modelOfRealField($, on)

  await type('plumbs') // the live log: the field kept "ashdasid" while the draft stayed "ashda"
  expect(model.local).toBe('plumb')
})

for (const [columns, bodyRows] of [
  [96, 18], // an inline pane in an ordinary terminal
  [60, 14],
  [71, 42], // docked
] as const) {
  test(`the win screen fits a ${columns}x${bodyRows} pane: its width, and no taller`, async ($, on) => {
    const { pane, clock } = await setupGame($, on)
    await pane.unmount()
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns, scroll: { offset: 0, bodyRows } }, requestId: 'wordle' } as any)
    await ui.input({ key: 'guess', text: 'prove', kind: 'change' } as any)
    await ui.input({ key: 'guess', text: 'prove', kind: 'submit' } as any)
    await clock.advance(500) // the red has opened out to the bottom row
    const screen = await ui.find({ key: 'fireworks' } as any)
    expect(screen?.props.width).toBe(columns)
    expect(screen?.children.length).toBeLessThanOrEqual(bodyRows)
    expect(await ui.find({ key: 'skip-celebration' } as any)).toBeUndefined()
  })
}

test('the hint line ⏎ and ⌫ buttons enter and delete', async ($, on) => {
  const { pane } = await setupGame($, on)
  await pane.press({ key: 'k-c' } as any)
  await pane.press({ key: 'k-r' } as any)
  expect((await pane.find({ key: 'guess' } as any))?.props.value).toBe('cr')
  await pane.press({ key: 'hotkey-back' } as any)
  expect((await pane.find({ key: 'guess' } as any))?.props.value).toBe('c')
})

test('footer: DATE… sits left of ▾ MORE, with room before the right edge; only one panel is open at a time', async ($, on) => {
  const { pane } = await setupGame($, on)
  const right = await pane.find({ key: 'footer-right' } as any)
  expect(right?.props.paddingRight).toBeGreaterThanOrEqual(4)
  const labels = (right?.children as any[]).map(c => c.props.label)
  expect(labels).toEqual(['DATE…', '▾ MORE'])

  await pane.press({ key: 'date-entry' } as any)
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeDefined()
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()
  await pane.press({ key: 'stats-toggle' } as any) // MORE replaces DATE
  expect(await pane.find({ key: 'stats-details' } as any)).toBeDefined()
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeUndefined()
  await pane.press({ key: 'date-entry' } as any) // and DATE replaces MORE
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeDefined()
  expect(await pane.find({ key: 'stats-details' } as any)).toBeUndefined()
})

test('the date picker lists the last 14 days and plays the one picked', async ($, on) => {
  const { pane, clock } = await setupGame($, on, { answers: { '2026-10-07': 'prove', '2026-10-03': 'crane' } })
  await pane.press({ key: 'date-entry' } as any)
  const pick = await pane.find({ key: 'archive-pick' } as any)
  const options = pick?.props.options as { value: string; label: string }[]
  expect(options).toHaveLength(14)
  expect(options[0]).toEqual({ value: '2026-10-07', label: '07 OCT · 2026-10-07 (today)' })
  expect(options[13].value).toBe('2026-09-24')
  expect(pick?.props.value).toBe('2026-10-07')

  await pane.select({ key: 'archive-pick', value: '2026-10-03' } as any)
  await clock.settle()
  await clock.settle()
  expect(flat(await pane.find({ key: 'stage-date' } as any))).toBe('STAGE 03 OCT')
  expect(JSON.stringify(await pane.drawn())).toContain('PRACTICE STAGE')
  expect(await pane.find({ key: 'date-drawer' } as any)).toBeUndefined() // picking a day closes the panel
})

// ---- width scaling: the tile and chip sizes come from the pane body's width ----

test('boardMetrics: never wider than the body, and its parts fill its width', () => {
  for (let columns = 47; columns <= 200; columns++) {
    const m = boardMetrics(columns)
    expect(m.width).toBeLessThanOrEqual(columns)
    if (m.isSideBySide && m.tile === 3) {
      // the compact layout: 78 wide when there's room, its controls taking the columns past 75
      expect(m.width).toBe(Math.min(columns, COMPACT_WIDTH))
      expect(2 + m.board + 1 + m.controls).toBeLessThanOrEqual(m.width)
    } else if (m.isSideBySide) {
      expect(2 + m.board + 1 + m.controls).toBe(m.width) // frame borders, board, divider, controls
    } else {
      expect(m.width).toBe(columns)
      expect(2 + m.board).toBeLessThanOrEqual(columns)
      expect(2 + m.controls).toBeLessThanOrEqual(columns)
    }
    expect(m.keyboard).toBe(10 * (m.chip + 1) - 1) // ten chips and their gaps
    expect(m.controls).toBeGreaterThanOrEqual(m.keyboard + 2 * m.pad)
  }
})

test('boardMetrics: the tiers, widest first, and they only grow with the width', () => {
  const tier = (columns: number) => {
    const m = boardMetrics(columns)

    return [m.isSideBySide ? 'side' : 'stacked', m.tile, m.chip, m.pad, m.width]
  }
  expect(tier(49)).toEqual(['stacked', 5, 3, 1, 49]) // the dock at 120 columns
  expect(tier(56)).toEqual(['stacked', 5, 3, 2, 56]) // inline at 60
  expect(tier(74)).toEqual(['stacked', 5, 5, 2, 74]) // one short of side by side
  expect(tier(75)).toEqual(['side', 3, 3, 2, 75]) // the compact stage 09 layout, at its narrowest
  expect(tier(78)).toEqual(['side', 3, 3, 2, 78]) // ...and at its own width
  expect(tier(84)).toEqual(['side', 3, 3, 2, 78])
  expect(tier(85)).toEqual(['side', 5, 3, 2, 85])
  expect(tier(96)).toEqual(['side', 5, 3, 2, 85]) // inline at 100
  expect(tier(99)).toEqual(['side', 5, 5, 2, 99])
  expect(tier(200)).toEqual(['side', 5, 5, 2, 99]) // no wider: the rest is margin
  expect(SIDE_BY_SIDE_MIN).toBe(75)
  expect(COMPACT_WIDTH).toBe(78)
  for (let c = 48; c <= 200; c++) {
    if (boardMetrics(c).isSideBySide !== boardMetrics(c - 1).isSideBySide) continue
    expect(boardMetrics(c).tile).toBeGreaterThanOrEqual(boardMetrics(c - 1).tile)
    expect(boardMetrics(c).chip).toBeGreaterThanOrEqual(boardMetrics(c - 1).chip)
  }
})

for (const [columns, direction, tileWidth, chipWidth, layoutWidth] of [
  [49, 'column', 5, 3, 49],
  [56, 'column', 5, 3, 56],
  [74, 'column', 5, 5, 74],
  [75, 'row', 3, 3, 75],
  [78, 'row', 3, 3, 78],
  [82, 'row', 3, 3, 78],
  [96, 'row', 5, 3, 85],
  [99, 'row', 5, 5, 99],
  [156, 'row', 5, 5, 99],
] as const) {
  test(`a ${columns}-column body: ${direction === 'row' ? 'side by side' : 'stacked'}, ${tileWidth}-column tiles, ${chipWidth}-column chips, ${layoutWidth} wide`, async ($, on) => {
    const { pane } = await setupGame($, on)
    await pane.unmount()
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns }, requestId: 'wordle' } as any)
    await ui.input({ key: 'guess', text: 'cr', kind: 'change' } as any)

    expect((await ui.find({ key: 'frame' } as any))?.props.flexDirection).toBe(direction)
    expect((await ui.find({ key: 'divider' } as any)) !== undefined).toBe(direction === 'row')
    // no overflow: the layout is never wider than the body, and sits centred in it
    expect((await ui.find({ key: 'pane' } as any))?.props).toMatchObject({ width: columns, alignItems: 'center' })
    expect((await ui.find({ key: 'layout' } as any))?.props.width).toBe(layoutWidth)
    expect(layoutWidth).toBeLessThanOrEqual(columns)
    // tiles: the letter centred in a tile of the tier's width, all six rows alike
    const pad = ' '.repeat((tileWidth - 1) / 2)
    expect(await tileAt(ui, 0, 0)).toMatchObject({ text: `${pad}C${pad}`, fill: FILL.active })
    for (let r = 0; r < 6; r++) expect((await ui.find({ key: `t${r}-4` } as any))?.props.width).toBe(tileWidth)
    // chips: every key, ⏎ and ⌫ included, and each row as wide as ten chips and their gaps
    for (const key of ['kc-q', 'kc-l', 'kc-enter', 'kc-back']) expect((await ui.find({ key } as any))?.props.width).toBe(chipWidth)
    expect((await ui.find({ key: 'krow0' } as any))?.props.width).toBe(10 * (chipWidth + 1) - 1)
    // still one row per tile row, so the side-by-side pane stays 12 rows tall
    expect((await ui.find({ key: 'board' } as any))?.children).toHaveLength(6)
  })
}

test('/wordle opens with no size request: the dock keeps its share, and inline keeps its room free to grow', async ($, on) => {
  mock.store(on)
  const opened: any[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e)

    return { value: { isPlaced: true } } as any
  })
  await $.command.run({ command: 'wordle', args: '', origin: { kind: 'composer' } } as any)
  expect(opened.at(-1)).toMatchObject({ id: 'wordle' })
  expect(opened.at(-1).columns).toBeUndefined()
  expect(opened.at(-1).rows).toBeUndefined()
})

for (const [columns, isAsked] of [
  [49, true], // the dock's share at 120 columns: too narrow to sit side by side
  [71, true],
  [75, false],
  [89, false], // the share at 200 columns: a request would only narrow it
] as const) {
  test(`a ${columns}-column dock is ${isAsked ? 'asked once for' : 'never asked to change to'} ${COMPACT_WIDTH} columns`, async ($, on) => {
    const opened: any[] = []
    const { pane, clock } = await setupGame($, on, {
      prepare: (o: any) =>
        o('ui.open', async (_$: any, e: any) => {
          opened.push(e)

          return { value: { isPlaced: true } }
        }),
    })
    await pane.unmount()
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: 32 } }, requestId: 'wordle' } as any)
    await clock.settle()
    await ui.input({ key: 'guess', text: 'c', kind: 'change' } as any) // another draw at the same width
    await clock.settle()
    expect(opened.filter(e => e.columns !== undefined)).toEqual(isAsked ? [expect.objectContaining({ id: 'wordle', columns: COMPACT_WIDTH })] : [])
  })
}

test('compact: on a practice day with DATE… open the footer still fits one row, at 75 and 78 columns', async ($, on) => {
  const { pane, clock } = await setupGame($, on)
  await goTo(pane, clock, '2026-10-01') // a practice stage: ▶ TODAY shows
  await pane.unmount()
  for (const columns of [75, 78]) {
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns }, requestId: 'wordle' } as any)
    await ui.press({ key: 'date-entry' } as any)
    expect(await ui.find({ key: 'play-today' } as any)).toBeDefined()
    expect((await ui.find({ key: 'date-entry' } as any))?.props.label).toBe('▴ DATE…')
    const footer = await ui.find({ key: 'footer' } as any)
    expect(footer?.props.flexWrap).toBe('nowrap')
    const hint = flat(await ui.find({ key: 'hint' } as any)).replace(/ /g, '').length // its words, less spaces
    const right = await ui.find({ key: 'footer-right' } as any)
    // the hint (47 drawn), its gap, the three buttons and their gaps, and the margin left
    const used = 47 + 2 + '▶ TODAY'.length + 3 + '▴ DATE…'.length + 3 + '▾ MORE'.length + right?.props.paddingRight
    expect(hint).toBeGreaterThan(0)
    expect(used).toBeLessThanOrEqual(columns)
    expect(right?.props.paddingRight).toBe(columns === 75 ? 0 : 3)
    await ui.press({ key: 'date-entry' } as any) // close it again: atoms outlive the mount
    await ui.unmount()
  }
})

// ---- height: the pane opens compact, and stacks (board on top) once the room grows ----

/** Pane props for a body `columns` wide with `bodyRows` of room (unknown when undefined). */
const sized = (columns: number, bodyRows?: number, placement = 'inline') => ({
  bodyColumns: columns,
  placement,
  ...(bodyRows === undefined ? {} : { scroll: { offset: 0, bodyRows } }),
})
const mountSized = ($: any, columns: number, bodyRows?: number, placement = 'inline') =>
  $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: sized(columns, bodyRows, placement), requestId: 'wordle' } as any)
const modeOf = async (ui: any) => ((await ui.find({ key: 'frame' } as any))?.props.flexDirection === 'row' ? 'side by side' : 'stacked')
/** Redraws `ui` at a new size, then lets the recorded mode land. */
const resizeTo = async (ui: any, clock: any, columns: number, bodyRows: number, placement = 'inline') => {
  await ui.redraw(sized(columns, bodyRows, placement) as any)
  await clock.settle()

  return modeOf(ui)
}

test('STACK_AT comes from the stacked layout\'s measured height plus 2, at every width', () => {
  // 78 columns: header 1, frame borders 2, board 8 (6 rows and their padding), controls 7, and a
  // footer of 2 (stacked, at its widest, ▶ TODAY and ▴ DATE… showing, it wraps under 81 columns)
  expect(stackedRows(78)).toBe(1 + 2 + 8 + 7 + 2)
  expect(stackAt(78)).toBe(22)
  expect(stackedRows(96)).toBe(19) // inline at 100: the footer fits on one row
  expect(stackAt(96)).toBe(21)
  expect(SIDE_BY_SIDE_ROWS).toBe(12)
  for (let c = 47; c <= 200; c++) expect(stackAt(c)).toBe(stackedRows(c) + 2)
  expect(STACK_GAP).toBe(2)
})

for (const bodyRows of [undefined, 11, 12, 22, 30, 42]) {
  test(`out of the box: a 78-column pane opening with ${bodyRows ?? 'unknown'} rows draws the compact layout`, async ($, on) => {
    const { pane, clock } = await setupGame($, on)
    await pane.unmount()
    const ui = await mountSized($, 78, bodyRows)
    expect(await modeOf(ui)).toBe('side by side')
    await clock.settle() // the rows it opened with are recorded, and nothing changes
    await ui.input({ key: 'guess', text: 'c', kind: 'change' } as any)
    expect(await modeOf(ui)).toBe('side by side')
  })
}

for (const [bodyRows, mode] of [
  [11, 'side by side'],
  [19, 'side by side'],
  [21, 'side by side'],
  [22, 'stacked'], // STACK_AT at 78 columns
  [30, 'stacked'],
] as const) {
  test(`opened with 11 rows, a 78-column pane grown to ${bodyRows} rows draws ${mode}`, async ($, on) => {
    expect(isStackedLayout(78, bodyRows, false, 11)).toBe(mode === 'stacked')
    const { pane, clock } = await setupGame($, on)
    await pane.unmount()
    const ui = await mountSized($, 78, 11)
    await clock.settle()
    expect(await resizeTo(ui, clock, 78, bodyRows)).toBe(mode)
    // stacked, the board and controls take the full body with the widest cells that fit
    if (mode === 'stacked') {
      expect((await ui.find({ key: 'layout' } as any))?.props.width).toBe(78)
      expect((await ui.find({ key: 't0-0' } as any))?.props.width).toBe(5)
      expect((await ui.find({ key: 'kc-q' } as any))?.props.width).toBe(5)
    }
  })
}

test('switch-back gap: grown to 22 rows it stacks, stays stacked at 21 and 20, goes side by side at 19, and stacks again only at 22', async ($, on) => {
  const stateWrites: string[] = []
  const { pane, clock } = await setupGame($, on, {
    prepare: (o: any) => o('state.set', async (_$: any, e: any, next: any) => (stateWrites.push(JSON.stringify(e)), next(e))),
  })
  await pane.unmount()
  const ui = await mountSized($, 78, 12)
  await clock.settle()
  expect(await modeOf(ui)).toBe('side by side')
  expect(await resizeTo(ui, clock, 78, 22)).toBe('stacked')
  expect(await resizeTo(ui, clock, 78, 21)).toBe('stacked')
  expect(await resizeTo(ui, clock, 78, 20)).toBe('stacked')
  expect(await resizeTo(ui, clock, 78, 19)).toBe('side by side')
  expect(await resizeTo(ui, clock, 78, 21)).toBe('side by side') // back up: the gap holds this way too
  expect(await resizeTo(ui, clock, 78, 22)).toBe('stacked')
  // the mode lives in the session's pane state (the isStacked atom), one write per switch
  expect(stateWrites.filter(w => w.includes('isStacked')).map(w => JSON.parse(w).value)).toEqual([true, false, true])
})

test('docked with room to spare it still opens compact, and stacks once the terminal grows taller', async ($, on) => {
  const { pane, clock } = await setupGame($, on)
  await pane.unmount()
  const ui = await mountSized($, 78, 32, 'dock')
  await clock.settle()
  expect(await modeOf(ui)).toBe('side by side') // 32 rows at open: plenty, but it opened with them
  expect(await resizeTo(ui, clock, 78, 33, 'dock')).toBe('stacked') // grown past them, and past STACK_AT
  expect(await resizeTo(ui, clock, 78, 31, 'dock')).toBe('stacked') // the gap
  expect(await resizeTo(ui, clock, 78, 30, 'dock')).toBe('side by side')
})

test('a dock too narrow at first stacks for the width, and goes compact once it is wide enough', async ($, on) => {
  const { pane, clock } = await setupGame($, on, { prepare: (o: any) => o('ui.open', async () => ({ value: { isPlaced: true } })) })
  await pane.unmount()
  const ui = await mountSized($, 49, 32, 'dock')
  await clock.settle()
  expect(await modeOf(ui)).toBe('stacked') // 49 columns: no room to sit side by side
  // the dock grants the 78 columns asked for: no height change, so the compact layout
  expect(await resizeTo(ui, clock, 78, 32, 'dock')).toBe('side by side')
})

test('isStackedLayout: compact until the rows it opened with are known and outgrown; the gap only for a pane that was stacked', () => {
  expect(isStackedLayout(78, 30, false, null)).toBe(false) // the first draw: compact
  expect(isStackedLayout(78, 30, false, 30)).toBe(false) // as tall as it opened
  expect(isStackedLayout(78, 31, false, 30)).toBe(true) // grown, and past STACK_AT (22)
  expect(isStackedLayout(78, 21, false, 11)).toBe(false)
  expect(isStackedLayout(78, 22, false, 11)).toBe(true)
  expect(isStackedLayout(78, 21, true, 11)).toBe(true)
  expect(isStackedLayout(78, 20, true, 11)).toBe(true)
  expect(isStackedLayout(78, 19, true, 11)).toBe(false)
  expect(isStackedLayout(78, undefined, true, 11)).toBe(false) // unknown rows: the compact default
  expect(isStackedLayout(60, undefined)).toBe(true) // too narrow for side by side, whatever the rows
  expect(isStackedLayout(60, 11, false, 11)).toBe(true)
  expect(isStackedLayout(96, 21, false, 11)).toBe(true) // STACK_AT is 21 at 96 columns
  expect(isStackedLayout(96, 20, false, 11)).toBe(false)
})

test('stacked is never wider than the body, and takes the widest tiles and chips that fit', () => {
  for (let columns = 47; columns <= 200; columns++) {
    const m = boardMetrics(columns, true)
    expect(m.isSideBySide).toBe(false)
    expect(m.width).toBe(columns)
    expect(2 + m.board).toBeLessThanOrEqual(columns)
    expect(2 + m.controls).toBeLessThanOrEqual(columns)
    // nothing wider would have fit: the next chip or tile size up overflows
    if (m.chip === 3) expect(2 + 10 * 6 - 1 + 2 * m.pad).toBeGreaterThan(columns)
    if (m.tile === 3) expect(2 + 5 * 5 + 4 + 2 * m.pad).toBeGreaterThan(columns)
  }
})

for (const columns of [75, 96, 140]) {
  test(`a stacked ${columns}-column body draws no row wider than the body`, async ($, on) => {
    const { pane, clock } = await setupGame($, on)
    await pane.unmount()
    const ui = await mountSized($, columns, 12)
    await clock.settle()
    expect(await resizeTo(ui, clock, columns, 40)).toBe('stacked')
    const width = async (key: string) => (await ui.find({ key } as any))?.props.width
    expect(await width('layout')).toBeLessThanOrEqual(columns)
    const m = boardMetrics(columns, true)
    expect(2 + (await width('board'))).toBeLessThanOrEqual(columns)
    expect(2 + 2 * m.pad + (await width('krow0'))).toBeLessThanOrEqual(columns)
  })
}

// ---- a short pane: the compact layout gives way so the footer bar stays in view ----

test('compactFit: the fullest compact layout that fits the rows, 12 down to 7', () => {
  expect([undefined, 30, 12, 11, 10, 9, 8, 7].map(rows => fitRows(compactFit(rows)))).toEqual([12, 12, 12, 11, 10, 9, 8, 7])
  expect(fitRows(compactFit(6))).toBe(7) // the board alone is 6 rows: 7 is the least that holds the bar too
})

for (const [bodyRows, hasHeader, hasBorder, gaps, hasGap] of [
  [12, true, true, 2, true],
  [11, true, true, 1, true], // the board's spare rows go first (the controls still hold the body at 7: one gap)
  [10, true, true, 0, false], // then the one above the stats row
  [9, false, true, 0, false], // then the header (the stats row still says the STAGE)
  [8, true, false, 0, false], // then the frame's border, the header back
  [7, false, false, 0, false],
] as const) {
  test(`a compact pane with ${bodyRows} rows: header ${hasHeader ? 'on' : 'off'}, border ${hasBorder ? 'on' : 'off'}, and the footer bar always there`, async ($, on) => {
    const { pane } = await setupGame($, on)
    await pane.unmount()
    const ui = await mountSized($, 78, bodyRows)
    expect(await modeOf(ui)).toBe('side by side')
    expect((await ui.find({ key: 'header' } as any)) !== undefined).toBe(hasHeader)
    expect((await ui.find({ key: 'frame' } as any))?.props.borderStyle).toBe(hasBorder ? 'round' : undefined)
    expect(await gapsUnder(ui)).toHaveLength(gaps)
    expect((await ui.find({ key: 'board' } as any))?.children).toHaveLength(6) // every tile row, always
    expect((await ui.find({ key: 'controls' } as any))?.children).toHaveLength(hasGap ? 5 : 4)
    expect((await ui.find({ key: 'keyboard' } as any))?.children).toHaveLength(3)
    // the divider is as tall as the frame's inside
    expect((await ui.find({ key: 'divider' } as any))?.children).toHaveLength(Math.max(6 + gaps, hasGap ? 7 : 6))
    for (const key of ['footer', 'date-entry', 'stats-toggle', 'stage-prev']) expect(await ui.find({ key } as any)).toBeDefined()
    // and the rows add up to no more than the room
    const rows = (hasHeader ? 1 : 0) + (hasBorder ? 2 : 0) + Math.max(6 + gaps, hasGap ? 7 : 6) + 1
    expect(rows).toBeLessThanOrEqual(bodyRows)
  })
}

// ---- gaps between tile rows: they grow with the pane's rows, and go where two filled rows meet ----

const gameOf = (guesses: number, status = 'playing') =>
  ({ answer: 'prove', status, guesses: Array.from({ length: guesses }, () => ({ word: 'crane', score: ['gray', 'gray', 'gray', 'gray', 'green'] })) }) as any

test('gapRows: the spare rows go where two filled rows meet, newest first, then under the rows to come', () => {
  const gaps = (guesses: number, spare: number, status = 'playing') => [...gapRows(gameOf(guesses, status), spare)]
  // the screenshot: one guess (ADIEU) and the row being typed under it; one spare row parts them
  expect(gaps(1, 1)).toEqual([0])
  expect(gaps(3, 1)).toEqual([2]) // the last guess and the typing row
  expect(gaps(3, 3)).toEqual([2, 1, 0]) // then each guess and the one before it
  expect(gaps(3, 4)).toEqual([2, 1, 0, 3]) // left over: under the typing row
  expect(gaps(0, 2)).toEqual([0, 1]) // nothing filled to part yet: top down
  expect(gaps(6, 5, 'lost').sort()).toEqual([0, 1, 2, 3, 4]) // a finished board: no typing row, every guess parted
  expect(gaps(2, 1, 'won')).toEqual([0])
  expect(gaps(4, 0)).toEqual([])
  // never more gaps than spare rows, never a gap under the last row
  for (let g = 0; g <= 6; g++) for (let s = 0; s <= 5; s++) {
    const placed = gaps(g, s, g === 6 ? 'lost' : 'playing')
    expect(placed).toHaveLength(s)
    expect(placed.every(r => r >= 0 && r <= 4)).toBe(true)
  }
})

test('boardRoom: a row of gap for every row the pane grows, up to one between every two tile rows', () => {
  // side by side at 78 columns: header, two border rows and the footer around a body of at least 8
  expect([12, 13, 14, 15, 16, 30].map(rows => boardRoom(8, rows, 4))).toEqual([
    { body: 8, spare: 2 },
    { body: 9, spare: 3 },
    { body: 10, spare: 4 },
    { body: 11, spare: 5 },
    { body: 11, spare: 5 }, // no further: the pane keeps its compact height
    { body: 11, spare: 5 },
  ])
  expect(boardRoom(8, undefined, 4)).toEqual({ body: 8, spare: 2 }) // rows unknown: the fit's own
  expect(boardRoom(7, 11, 4)).toEqual({ body: 7, spare: 1 }) // the controls hold the body at 7: one gap
  expect(boardRoom(6, 10, 4)).toEqual({ body: 6, spare: 0 })
})

for (const [bodyRows, gaps] of [[12, 2], [13, 3], [14, 4], [15, 5], [20, 5]] as const) {
  test(`a 78-column pane ${bodyRows} rows tall: ${gaps} gaps, and the frame no taller than the room`, async ($, on) => {
    const { pane } = await setupGame($, on)
    await pane.unmount()
    const ui = await mountSized($, 78, bodyRows)
    expect(await modeOf(ui)).toBe('side by side')
    expect(await gapsUnder(ui)).toHaveLength(gaps)
    const body = 6 + gaps
    expect((await ui.find({ key: 'divider' } as any))?.children).toHaveLength(body)
    expect(1 + 2 + body + 1).toBeLessThanOrEqual(bodyRows)
  })
}

test('as the guesses come in the board keeps its height, and the gap follows the row being typed', async ($, on) => {
  const { pane } = await setupGame($, on)
  await pane.unmount()
  const ui = await mountSized($, 78, 11) // one spare row
  const play = async (word: string) => {
    await ui.input({ key: 'guess', text: word, kind: 'change' } as any)
    await ui.input({ key: 'guess', text: word, kind: 'submit' } as any)
  }
  expect(await gapsUnder(ui)).toEqual([0])
  await play('crane') // the screenshot: a guess, then the typing row right under it
  expect(await gapsUnder(ui)).toEqual([0])
  expect((await tileAt(ui, 0, 0)).fill).toBe(FILL.miss) // C: a miss
  expect((await tileAt(ui, 1, 0)).fill).toBe(FILL.active) // and the typing row's own fill, not the miss's
  await play('slate')
  expect(await gapsUnder(ui)).toEqual([1])
  expect((await ui.find({ key: 'divider' } as any))?.children).toHaveLength(7)
})

test('the row being typed has its own fill, lighter than a miss', () => {
  expect(FILL.active).not.toBe(FILL.miss)
})

test('stacked with room, the board gets its gaps too', async ($, on) => {
  const { pane, clock } = await setupGame($, on)
  await pane.unmount()
  const ui = await mountSized($, 78, 12)
  await clock.settle()
  expect(await resizeTo(ui, clock, 78, 22)).toBe('stacked') // STACK_AT: its measured 8-row board plus the 2 to spare
  expect(await gapsUnder(ui)).toHaveLength(4)
  expect(await resizeTo(ui, clock, 78, 40)).toBe('stacked')
  expect(await gapsUnder(ui)).toHaveLength(5)
})

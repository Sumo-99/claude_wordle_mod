import { expect, mock, test } from 'claude-code/testing'

const SOLUTION = 'prove'

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })

const FILL = { green: '#5fb87a', yellow: '#f0b44c', miss: '#2e2a26', active: '#2e2a26' }

/** Every string an element shows, its descendants' included, space-separated. */
const flat = (el: any): string =>
  el == null ? '' : typeof el === 'string' ? el : (el.children ?? []).map(flat).filter(Boolean).join(' ')

/** Tile (row r, column i): the letter in its middle row and that row's fill and letter color. */
const tileAt = async (pane: any, r: number, i: number) => {
  const middle = (await pane.find({ key: `t${r}-${i}` }))?.children[1]

  return { text: middle?.children[0], fill: middle?.props.backgroundColor, color: middle?.props.color }
}
const rowOf = async (pane: any, r: number) => Promise.all([0, 1, 2, 3, 4].map(i => tileAt(pane, r, i)))

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
    expect((await tileAt(pane, 1, 0)).text).toBe('  ▌  ') // an empty row again, cursor in its first tile
    await press('prove')
    await clock.advance(3100) // the win screen covers the board for 3 seconds
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
  await clock.advance(3100) // the win screen covers the board for 3 seconds
  expect(await statsShown()).toContain('STREAK 01 BEST 01 WIN% 100')
  expect(await statsShown()).toContain('PLAYED 1 · WON 1')

  // an archived day is practice: solve it, stats unchanged, and it says so
  await pane.press({ key: 'stage-prev' } as any) // ◀: one day back
  await clock.settle()
  await clock.settle()
  expect(await everything()).toContain('PRACTICE STAGE')
  await play('crane')
  await clock.advance(3100)
  expect(await everything()).toContain('SOLVED IN 1/6')
  expect(await statsShown()).toContain('STREAK 01 BEST 01 WIN% 100')
  expect(await statsShown()).toContain('PLAYED 1 · WON 1')

  // back to today: the finished board is shown, not a blank one, and stats did not double count
  await pane.press({ key: 'play-today' } as any)
  await clock.settle()
  await clock.settle()
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
  expect(marker?.props.label).toBe('⚠ OFFLINE PUZZLE')
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
  await clock.advance(3100) // past the win screen
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

test('winning swaps the board for a 3 second red celebration screen, then the board returns', async ($, on) => {
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

  // the finished game board is back, in full
  expect(await boardShown()).toBe(true)
  expect(JSON.stringify(await pane.drawn())).toContain('SOLVED IN 2/6')
  expect(await pane.find({ key: 'board' } as any)).toBeDefined() // the new walled board
  expect((await tileAt(pane, 1, 0)).fill).toBe(FILL.green)
})

test('the continue control on the win screen goes straight back to the board', async ($, on) => {
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

  await pane.press({ key: 'skip-celebration' } as any)
  expect(await pane.find({ key: 'fireworks' } as any)).toBeUndefined()
  expect(JSON.stringify(await pane.drawn())).toContain('SOLVED IN 1/6')
  // the stopped timer does not bring it back
  await clock.advance(1000)
  expect(await pane.find({ key: 'fireworks' } as any)).toBeUndefined()
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

  // afterwards the winning row is intact: M O C H A
  const row = await pane.find({ key: 'row0' } as any)
  expect(row).toBeDefined()
  const tree = JSON.stringify(await pane.drawn())
  expect((await rowOf(pane, 0)).map(t => t.text.trim())).toEqual(['M', 'O', 'C', 'H', 'A'])
  expect(tree).toContain('SOLVED IN 1/6')
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
  for (const ch of ['r', 'e']) {
    expect((await box(ch))?.props.borderColor).toBe(FILL.green)
    expect((await box(ch))?.props.borderStyle).toBe('double')
  }
  expect((await box('o'))?.props.borderColor).toBe(FILL.yellow)
  expect((await box('q'))?.props.borderColor).toBe('#5a524a') // untried: the idle outline
  expect((await pane.find({ key: 'k-q' } as any))?.props.dimColor).toBe(false)
  expect((await pane.find({ key: 'k-q' } as any))?.props.label).toBe('Q') // just the letter...
  expect((await pane.find({ key: 'k-q' } as any))?.props.plain).toBe(true) // ...no [ brackets ]
  // a known miss is no key at all: a dim dot holds its place
  for (const ch of ['c', 'a', 'n', 'm', 'h']) {
    expect(await box(ch)).toBeUndefined()
    expect(await pane.find({ key: `k-${ch}` } as any)).toBeUndefined()
    expect((await pane.find({ key: `kx-${ch}` } as any))?.children[0]).toMatchObject({ type: 'Text', props: { color: '#6e655b' }, children: ['·'] })
  }
  // Enter always wears the accent outline
  expect((await box('enter'))?.props.borderColor).toBe('#d97757')
})

test('tiles: scored fills, the typed row with its cursor, and pellets ahead', async ($, on) => {
  const { pane, play } = await setupGame($, on) // answer: prove
  await play('crane')
  await pane.input({ key: 'guess', text: 'pl', kind: 'change' } as any)

  // scored: the letter is background-colored on green, dim on a miss
  expect(await tileAt(pane, 0, 1)).toEqual({ text: '  R  ', fill: FILL.green, color: '#171513' })
  expect(await tileAt(pane, 0, 0)).toEqual({ text: '  C  ', fill: FILL.miss, color: '#6e655b' })
  // each tile is pixel-rounded: ▗▄▄▄▖ over the middle, ▝▀▀▀▘ under it, in the tile's color
  const t = await pane.find({ key: 't0-1' } as any)
  expect(t?.children[0]).toMatchObject({ props: { color: FILL.green }, children: ['▗▄▄▄▖'] })
  expect(t?.children[2]).toMatchObject({ props: { color: FILL.green }, children: ['▝▀▀▀▘'] })
  // the active row: typed letters in the text color, the ▌ cursor in the next empty tile
  expect(await tileAt(pane, 1, 0)).toEqual({ text: '  P  ', fill: FILL.active, color: '#f0e8dc' })
  expect(await tileAt(pane, 1, 2)).toEqual({ text: '  ▌  ', fill: FILL.active, color: '#d97757' })
  expect((await tileAt(pane, 1, 3)).fill).toBe(FILL.active)
  // rows ahead have no tiles, just pellets; the last row has power pellets in its corners
  expect((await tileAt(pane, 2, 0)).fill).toBeUndefined()
  expect((await tileAt(pane, 2, 0)).text).toBe('  •  ')
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
  const header = async () => flat(await pane.find({ key: 'header' } as any))

  expect(await header()).toBe('1UP 00000 HI-SCORE 00000 STAGE 07 OCT')
  await play('crane')
  await play('prove') // won in 2: 4 guesses left
  await clock.advance(3100)
  expect(await header()).toBe('1UP 00400 HI-SCORE 00400 STAGE 07 OCT')

  await pane.press({ key: 'stage-prev' } as any) // practice: won in 1
  await clock.settle()
  await clock.settle()
  await play('crane')
  await clock.advance(3100)
  expect(await header()).toBe('1UP 00500 HI-SCORE 00400 STAGE 06 OCT')
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

test('layout: side by side with the block title when wide, stacked with a plain title when narrow', async ($, on) => {
  const { pane } = await setupGame($, on)
  // nothing on the board is drawn with [ brackets ]: every Button is plain
  for (const b of await pane.findAll({ type: 'Button' } as any)) expect(b.props.plain).toBe(true)
  await pane.unmount()
  for (const [columns, direction, isBlock] of [
    [100, 'row', true],
    [60, 'column', false],
  ] as const) {
    const wide = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns }, requestId: 'wordle' } as any)
    expect((await wide.find({ key: 'panels' } as any))?.props.flexDirection).toBe(direction)
    const title = await wide.find({ key: 'title' } as any)
    expect(flat(title).includes('█')).toBe(isBlock)
    if (!isBlock) expect(flat(title)).toBe('WORDLE')
    // both panels wear the double walls in the walls color
    for (const key of ['board', 'controls']) {
      expect((await wide.find({ key } as any))?.props).toMatchObject({ borderStyle: 'double', borderColor: '#d97757' })
    }
    await wide.unmount()
  }
})

test('layout: a short pane drops the blank rows, then flattens the tiles, the title and the header', async ($, on) => {
  const { pane } = await setupGame($, on)
  await pane.unmount()
  const mountAt = (bodyRows: number) =>
    $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: 96, scroll: { offset: 0, bodyRows } }, requestId: 'wordle' } as any)

  // roomy (the reference): 3-row tiles with a blank row between tile rows, block title
  let ui = await mountAt(40)
  expect((await ui.find({ key: 'board' } as any))?.props.gap).toBe(1)
  expect((await ui.find({ key: 't0-0' } as any))?.children).toHaveLength(3)
  expect(flat(await ui.find({ key: 'title' } as any))).toContain('█')
  await ui.unmount()

  // snug: the tiles keep their shape, the blank rows go
  ui = await mountAt(30)
  expect((await ui.find({ key: 'board' } as any))?.props.gap).toBe(0)
  expect((await ui.find({ key: 't0-0' } as any))?.children).toHaveLength(3)
  expect(flat(await ui.find({ key: 'title' } as any))).toContain('█')
  await ui.unmount()

  // tight: one-row tiles, a plain title, a one-row header
  ui = await mountAt(18)
  expect((await ui.find({ key: 't0-0' } as any))?.children).toHaveLength(1)
  expect(flat(await ui.find({ key: 'title' } as any))).toBe('WORDLE')
  expect((await ui.find({ key: 'score' } as any))?.props.flexDirection).toBe('row')
  await ui.unmount()
})

test('V3: when the game is over the keyboard fades and the status line says what to do next', async ($, on) => {
  const { pane, play, text } = await setupGame($, on) // answer: prove
  for (const word of ['crane', 'slate', 'brick', 'plumb', 'mocha', 'crane']) await play(word)

  expect(await text()).toContain('THE WORD WAS PROVE')
  expect(await text()).toContain('◀ ▶ PICK ANOTHER STAGE')
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

test('⏎ and ⌫ keep their 1 and 2 hotkeys, and the hint says how to play', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  on('ui.focus', async () => ({}) as any)
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  expect((await pane.find({ key: 'enter' } as any))?.props).toMatchObject({ label: '⏎', hotkey: '1', plain: true })
  expect((await pane.find({ key: 'back' } as any))?.props).toMatchObject({ label: '⌫', hotkey: '2', plain: true })
  // letter keys carry no hotkey: a plain Button with one would draw as `q: Q`
  expect((await pane.find({ key: 'k-q' } as any))?.props.hotkey).toBeUndefined()
  expect(JSON.stringify(await pane.drawn())).toContain('TYPE TO PLAY · ESC TO EXIT')
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
  test(`the win screen fits a ${columns}x${bodyRows} pane: its width, and no taller, so the continue row stays in view`, async ($, on) => {
    const { pane, clock } = await setupGame($, on)
    await pane.unmount()
    const ui = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: { bodyColumns: columns, scroll: { offset: 0, bodyRows } }, requestId: 'wordle' } as any)
    await ui.input({ key: 'guess', text: 'prove', kind: 'change' } as any)
    await ui.input({ key: 'guess', text: 'prove', kind: 'submit' } as any)
    await clock.advance(500) // the red has opened out to the bottom row
    const screen = await ui.find({ key: 'fireworks' } as any)
    expect(screen?.props.width).toBe(columns)
    expect(screen?.children.length).toBeLessThanOrEqual(bodyRows) // every row, the skip row last
    expect(await ui.find({ key: 'skip-celebration' } as any)).toBeDefined()
  })
}

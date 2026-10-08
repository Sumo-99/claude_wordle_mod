import { expect, mock, test } from 'claude-code/testing'

const SOLUTION = 'prove'

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })

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
    // scored letters are the underlined Texts outside the legend (whose sample letter is 'A')
    const scored = async () =>
      (await pane.findAll({ type: 'Text' } as any))
        .filter((t: any) => t.props.underline)
        .map((t: any) => `${t.text}:${t.props.color}`)

    // a wrong guess scores per tile: c r a n e vs p r o v e -> gray green gray gray green
    await press('crane')
    expect((await scored()).slice(0, 5)).toEqual(['C:inactive', 'R:success', 'A:inactive', 'N:inactive', 'E:success'])
    // the legend explains all three colors
    for (const phrase of ['right letter, right place', 'right letter, wrong place', 'not in the word']) {
      expect(await text()).toContain(phrase)
    }
    // typing in the field: it feeds the same draft, and deleting a character shortens it
    const typed = async (value: string) => {
      await pane.input({ key: 'guess', text: value, kind: 'change' } as any)

      return (await pane.find({ key: 'guess' } as any))?.props.value
    }
    expect(await typed('slate')).toBe('slate')
    expect(await typed('slat')).toBe('slat') // Backspace
    expect(await typed('sl4t?E')).toBe('slte') // non-letters dropped, lowercased
    expect(await typed('slatexyz')).toBe('slate') // capped at five
    expect(await typed('')).toBe('')
    // an illegal word costs nothing
    await press('zzzzz')
    expect(await text()).toContain('Guess 2/6')
    // the rejected word stays in the draft until backspaced away
    for (let i = 0; i < 5; i++) await pane.press({ key: 'back' } as any)
    expect(await text()).not.toContain('▫️Z')
    await press('prove')
    await clock.advance(3100) // the win screen covers the board for 3 seconds
    expect((await scored()).slice(5, 10)).toEqual(['P:success', 'R:success', 'O:success', 'V:success', 'E:success'])
    expect(await text()).toContain('Solved in 2/6')
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
  const statsPane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle-stats' } as any)
  await clock.settle()
  await clock.settle()

  const everything = async () => JSON.stringify(await pane.drawn()) + JSON.stringify(await statsPane.drawn())
  const play = async (word: string) => {
    await pane.input({ key: 'guess', text: word, kind: 'change' } as any)
    await pane.input({ key: 'guess', text: word, kind: 'submit' } as any)
  }
  const pick = async (date: string) => {
    await pane.select({ key: 'archive-pick', value: date } as any)
    await clock.settle()
    await clock.settle()
  }

  // lose nothing yet: stats start empty
  expect(await everything()).toContain('Streak 0 · Max 0 · Played 0 · Win 0%')

  // win today in two guesses
  await play('crane')
  await play('prove')
  await clock.advance(3100) // the win screen covers the board for 3 seconds
  expect(await everything()).toContain('Streak 1 · Max 1 · Played 1 · Win 100%')

  // an archived day is practice: solve it, stats unchanged, and it says so
  await pick('2026-10-06')
  expect(await everything()).toContain('Practice puzzle')
  await play('crane')
  await clock.advance(3100)
  expect(await everything()).toContain('Solved in 1/6')
  expect(await everything()).toContain('Streak 1 · Max 1 · Played 1 · Win 100%')

  // back to today: the finished board is shown, not a blank one, and stats did not double count
  await pick('2026-10-07')
  expect(await everything()).toContain('Solved in 2/6')
  expect(await everything()).not.toContain('Practice puzzle')
  expect(await everything()).toContain('Streak 1 · Max 1 · Played 1 · Win 100%')
})

test('the stats window is a separate pane opened and closed by a toggle', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
  on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
  on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  const opened: string[] = []
  const closed: string[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e.id)

    return { value: undefined } as any
  })
  on('ui.close', async (_$, e) => {
    closed.push(e.id)

    return { value: undefined } as any
  })

  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()

  // the main pane carries no stats of its own, just the toggle
  expect(JSON.stringify(await pane.drawn())).not.toContain('Streak')
  expect((await pane.find({ key: 'stats-toggle' } as any))?.props.label).toBe('Stats')

  await pane.press({ key: 'stats-toggle' } as any)
  expect(opened).toEqual(['wordle-stats'])
  expect((await pane.find({ key: 'stats-toggle' } as any))?.props.label).toBe('Hide stats')

  await pane.press({ key: 'stats-toggle' } as any)
  expect(closed).toEqual(['wordle-stats'])
  expect((await pane.find({ key: 'stats-toggle' } as any))?.props.label).toBe('Stats')
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
  expect(marker?.props.label).toContain('offline puzzle')
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
  const statsPane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle-stats' } as any)
  await clock.settle()
  await clock.settle()
  const shown = async () => JSON.stringify(await statsPane.drawn())
  const label = async () => (await statsPane.find({ key: 'clear-stats' } as any))?.props.label

  await pane.input({ key: 'guess', text: 'prove', kind: 'change' } as any)
  await pane.input({ key: 'guess', text: 'prove', kind: 'submit' } as any)
  expect(await shown()).toContain('Streak 1 · Max 1 · Played 1 · Win 100%')

  // first press only arms it
  expect(await label()).toBe('Clear stats')
  await statsPane.press({ key: 'clear-stats' } as any)
  expect(await label()).toBe('Press again to clear')
  expect(await shown()).toContain('Played 1')

  // it disarms itself if you walk away
  await clock.advance(5000)
  expect(await label()).toBe('Clear stats')

  // two presses clear everything
  await statsPane.press({ key: 'clear-stats' } as any)
  await statsPane.press({ key: 'clear-stats' } as any)
  expect(await shown()).toContain('Streak 0 · Max 0 · Played 0 · Win 0%')
  expect(toasts).toContain('Stats cleared.')
  expect(await label()).toBe('Clear stats')
})

test('winning swaps the board for a 3 second gray fireworks screen, then the board returns', async ($, on) => {
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

  // the winning guess replaces the whole board with the gray celebration screen
  await play('prove')
  const started = await screen()
  expect(started?.props.backgroundColor).toBe('gray')
  expect(await boardShown()).toBe(false) // no keyboard, no guess rows: nothing left to clip or cover
  const first = JSON.stringify(await pane.drawn())

  await clock.advance(1500)
  expect(await screen()).toBeDefined()
  expect(JSON.stringify(await pane.drawn())).not.toEqual(first) // it animates
  expect(JSON.stringify(await pane.drawn())).toContain('"H"') // and says it

  // still up just before 3 seconds, gone just after
  await clock.advance(1400)
  expect(await screen()).toBeDefined()
  await clock.advance(300)
  expect(await screen()).toBeUndefined()

  // the finished game board is back, in full
  expect(await boardShown()).toBe(true)
  expect(JSON.stringify(await pane.drawn())).toContain('Solved in 2/6')
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
  await pane.select({ key: 'archive-pick', value: '2026-10-05' } as any)
  await clock.settle()
  await clock.settle()
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
  for (const ch of ['M', 'O', 'C', 'H', 'A']) expect(tree).toContain(`"${ch}"`)
  expect(tree).toContain('Solved in 1/6')
})

// ---- V1: keyboard feedback, V2: offline word recovery, V3: end-of-game cue, V11: new day ----

import { keyStates } from '../lib/board-view.js'

const setupGame = async ($: any, on: any, opts: { now?: string; answers?: Record<string, string>; offline?: () => boolean; fallback?: string } = {}) => {
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse(opts.now ?? '2026-10-07T12:00:00') })
  on('http.fetch', async (_$: any, e: any) => {
    if (opts.offline?.()) throw new Error('offline')
    const date = e.url.match(/(\d{4}-\d{2}-\d{2})\.json$/)![1]

    return { value: ok({ solution: opts.answers?.[date] ?? SOLUTION }) }
  })
  on('fs.read', async (_$: any, e: any) => ({
    value: String(e.path).endsWith('fallback-answers.txt') ? `${opts.fallback ?? 'crane'}\n` : 'crane\nprove\nslate\nbrick\nplumb\nmocha\n',
  }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
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

test('V1: the on-screen keys show what the guesses found', async ($, on) => {
  const { pane, play } = await setupGame($, on) // answer: prove
  await play('crane') // c a n gray, r e green

  const box = (ch: string) => pane.find({ key: `kc-${ch}` } as any)
  expect((await box('r'))?.props.backgroundColor).toBe('success')
  expect((await box('e'))?.props.backgroundColor).toBe('success')
  expect(await box('c')).toBeUndefined() // gray keys get no color background...
  expect((await pane.find({ key: 'k-c' } as any))?.props.dimColor).toBe(true) // ...they fade
  expect((await pane.find({ key: 'k-q' } as any))?.props.dimColor).toBe(false) // untouched keys stay normal
})

test('V3: when the game is over the keyboard fades and the status line says what to do next', async ($, on) => {
  const { pane, play, text } = await setupGame($, on) // answer: prove
  for (const word of ['crane', 'slate', 'brick', 'plumb', 'mocha', 'crane']) await play(word)

  expect(await text()).toContain('The word was PROVE')
  expect(await text()).toContain('Pick another day below')
  for (const ch of ['q', 'a', 'z']) expect((await pane.find({ key: `k-${ch}` } as any))?.props.dimColor).toBe(true)
  expect(await pane.find({ key: 'guess' } as any)).toBeUndefined() // the field is gone
  expect(await pane.find({ key: 'archive-pick' } as any)).toBeDefined() // and the way to another day is right there
})

test('V11: after midnight the open puzzle is marked as old, offers today, and no longer counts', async ($, on) => {
  const { pane, clock, play, text } = await setupGame($, on, { answers: { '2026-10-07': 'prove', '2026-10-08': 'slate' } })
  const stats = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle-stats' } as any)
  expect(await text()).not.toContain('A new day has started')

  await clock.advance(24 * 3600 * 1000) // midnight passes with the pane open
  await pane.input({ key: 'guess', text: 'c', kind: 'change' } as any) // any redraw
  expect(await text()).toContain('A new day has started')
  expect(await text()).toContain('2026-10-07 is now practice')
  expect(await pane.find({ key: 'play-today' } as any)).toBeDefined()

  // finishing the stale puzzle must not count as today's: lose it and look at the stats
  await pane.input({ key: 'guess', text: '', kind: 'change' } as any)
  for (const word of ['crane', 'slate', 'brick', 'plumb', 'mocha', 'crane']) await play(word)
  expect(JSON.stringify(await stats.drawn())).toContain('Played 0')

  // the button jumps to the new day's puzzle, fresh, and the old-day warning is gone
  await pane.press({ key: 'play-today' } as any)
  await clock.settle()
  await clock.settle()
  expect(await text()).toContain('2026-10-08')
  expect(await text()).not.toContain('A new day has started')
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

  await pane.select({ key: 'archive-pick', value: '2026-10-06' } as any) // go elsewhere (still offline)
  await clock.settle()
  await clock.settle()
  isOffline = false // the network comes back; the live word for today is 'slate'
  await pane.select({ key: 'archive-pick', value: '2026-10-07' } as any)
  await clock.settle()
  await clock.settle()

  // progress is kept, on the word it started with, still flagged offline
  expect(await text()).toContain('Guess 2/6')
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

  await pane.select({ key: 'archive-pick', value: '2026-10-06' } as any)
  await clock.settle()
  await clock.settle()
  isOffline = false
  await pane.select({ key: 'archive-pick', value: '2026-10-07' } as any)
  await clock.settle()
  await clock.settle()

  // no guesses had been made, so nothing to protect: back to the real word, no marker
  expect(await text()).toContain('Guess 1/6')
  expect(await pane.find({ key: 'fallback-warning' } as any)).toBeUndefined()
})

import { expect, mock, test } from 'claude-code/testing'

import { addDays, LAUNCH_DATE } from '../lib/archive.js'
import { createGame, submitGuess } from '../lib/game-engine.js'
import {
  ALL_PLAYED_MESSAGE,
  checkPickerDate,
  loadPlayed,
  markPlayed,
  newestUnplayed,
  nextDailyIn,
  PLAYED_KEY,
  poolSize,
  randomDate,
  remaining,
  RANDOM_KEY,
  shownDate,
  skippedBehind,
  skippedLabel,
  stepPicker,
} from '../lib/picker.js'

const TODAY = '2026-10-09'
const NOON = Date.parse(`${TODAY}T12:00:00`)
const WORDS = 'crane\nprove\nslate\nmural\n'

// ---- the rules, pure ----

const memoryIo = (initial: Record<string, unknown> = {}) => {
  const data = new Map<string, unknown>(Object.entries(initial))

  return {
    data,
    io: {
      store: {
        get: async (k: string) => data.get(k),
        set: async (k: string, v: unknown) => void data.set(k, JSON.parse(JSON.stringify(v))),
      },
    },
  }
}

const wholePool = (today: string) => Array.from({ length: poolSize(today) }, (_, i) => addDays(LAUNCH_DATE, i))

test('the pool runs from 2021-06-19 to yesterday and never holds today', () => {
  const pool = wholePool(TODAY)

  expect(pool[0]).toBe('2021-06-19')
  expect(pool.at(-1)).toBe('2026-10-08')
  expect(pool).not.toContain(TODAY)
  expect(remaining(TODAY, [])).toBe(pool.length)
  expect(remaining(TODAY, ['2026-10-08', TODAY, '2020-01-01'])).toBe(pool.length - 1) // only pool dates count
})

test('random never returns today or a played-today date, with an injected random source', () => {
  const played = ['2021-06-19', '2021-06-21', '2026-10-08']
  // every extreme and a sweep of values: none lands on today or a played date
  for (const r of [0, 0.0001, 0.25, 0.5, 0.75, 0.9999, 0.99999999]) {
    const date = randomDate(TODAY, played, () => r)!
    expect(date >= LAUNCH_DATE && date < TODAY).toBe(true)
    expect(played).not.toContain(date)
  }
  // 0 is the first unplayed date, ~1 the last: the picks are uniform over the rest
  expect(randomDate(TODAY, played, () => 0)).toBe('2021-06-20')
  expect(randomDate(TODAY, played, () => 1.5 / remaining(TODAY, played))).toBe('2021-06-22')
  expect(randomDate(TODAY, played, () => 0.9999999)).toBe('2026-10-07')
  // an out-of-range source can't escape the pool
  expect(randomDate(TODAY, played, () => 1)).toBe('2026-10-07')
})

test('random with nothing left is null, and one date left is that date', () => {
  const pool = wholePool(TODAY)

  expect(randomDate(TODAY, pool, () => 0.5)).toBeNull()
  expect(randomDate(TODAY, pool.filter(d => d !== '2024-02-29'), () => 0.5)).toBe('2024-02-29')
})

test('the stepper starts on the newest date not played, and steps over played ones', () => {
  expect(newestUnplayed(TODAY, [])).toBe('2026-10-08')
  expect(newestUnplayed(TODAY, ['2026-10-08'])).toBe('2026-10-07')
  expect(newestUnplayed(TODAY, ['2026-10-08', '2026-10-07', '2026-10-05'])).toBe('2026-10-06')
  expect(newestUnplayed(TODAY, wholePool(TODAY))).toBeNull()

  const played = ['2026-10-08', '2026-10-06', '2026-10-05']
  expect(shownDate(null, TODAY, played)).toBe('2026-10-07')
  expect(stepPicker('2026-10-07', TODAY, played, -1)).toBe('2026-10-04') // over 06 and 05
  expect(stepPicker('2026-10-04', TODAY, played, 1)).toBe('2026-10-07') // and back
  expect(stepPicker('2026-10-07', TODAY, played, 1)).toBeNull() // 08 is played, nothing newer
  // a date played since the stepper landed on it is moved off
  expect(shownDate('2026-10-04', TODAY, [...played, '2026-10-04'])).toBe('2026-10-07')
  // everything played: the stepper still shows yesterday
  expect(shownDate(null, TODAY, wholePool(TODAY))).toBe('2026-10-08')
})

test('the stepper stops at 2021-06-19 and at yesterday', () => {
  expect(stepPicker('2021-06-20', TODAY, [], -1)).toBe('2021-06-19')
  expect(stepPicker('2021-06-19', TODAY, [], -1)).toBeNull()
  expect(stepPicker('2021-06-20', TODAY, ['2021-06-19'], -1)).toBeNull() // the last one is played
  expect(stepPicker('2026-10-07', TODAY, [], 1)).toBe('2026-10-08')
  expect(stepPicker('2026-10-08', TODAY, [], 1)).toBeNull() // never today
})

test('the caption names the dates the last step skipped', () => {
  const played = ['2026-10-06', '2026-10-07']
  expect(skippedLabel(skippedBehind('2026-10-05', TODAY, played, -1))).toBe('skips 06, 07 OCT · played today')
  expect(skippedLabel(skippedBehind('2026-10-08', TODAY, played, 1))).toBe('skips 06, 07 OCT · played today')
  expect(skippedLabel(skippedBehind('2026-10-05', TODAY, played, 1))).toBe('') // a step that skipped nothing
  expect(skippedLabel(['2026-09-30', '2026-10-01'])).toBe('skips 30 SEP, 01 OCT · played today')
  expect(skippedLabel(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])).toBe('skips 5 dates · played today')
})

test('typed dates: today, future, before launch and played-today are each rejected with a message', () => {
  const played = ['2026-10-08']
  const reason = (input: string) => (checkPickerDate(input, TODAY, played) as { reason?: string }).reason

  expect(reason(TODAY)).toContain("Today's puzzle is the daily")
  expect(reason('2026-10-10')).toBe('That puzzle is in the future')
  expect(reason('2021-06-18')).toBe('No puzzles before 2021-06-19')
  expect(reason('2026-10-08')).toBe('You already played 2026-10-08 today')
  expect(reason('soon')).toBe('Enter a date as YYYY-MM-DD')
  expect(checkPickerDate(' 2024-01-01 ', TODAY, played)).toEqual({ ok: true, date: '2024-01-01' })
  expect(checkPickerDate(LAUNCH_DATE, TODAY, played)).toEqual({ ok: true, date: LAUNCH_DATE })
})

test('the played-today set belongs to a day: another day reads as empty and is overwritten', async () => {
  const { io, data } = memoryIo({ [PLAYED_KEY]: { day: '2026-10-08', dates: ['2026-10-01'] } })

  expect(await loadPlayed(io, '2026-10-08')).toEqual(['2026-10-01'])
  expect(await loadPlayed(io, TODAY)).toEqual([])
  expect(data.get(PLAYED_KEY)).toEqual({ day: TODAY, dates: [] })
  expect(await markPlayed(io, TODAY, '2026-10-02')).toEqual(['2026-10-02'])
  expect(await markPlayed(io, TODAY, '2026-10-02')).toEqual(['2026-10-02']) // once
  expect(data.get(PLAYED_KEY)).toEqual({ day: TODAY, dates: ['2026-10-02'] }) // dates only: no results kept
})

test('the countdown runs to the next local midnight', () => {
  expect(nextDailyIn(Date.parse('2026-10-09T12:00:00'))).toBe('12:00:00')
  expect(nextDailyIn(Date.parse('2026-10-09T16:17:50'))).toBe('07:42:10')
  expect(nextDailyIn(Date.parse('2026-10-09T23:59:59'))).toBe('00:00:01')
  expect(nextDailyIn(Date.parse('2026-10-10T00:00:00'))).toBe('24:00:00')
})

// ---- the pane ----

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })

/** A finished game: the answer guessed right on the `n`th guess, or six misses. */
const finished = (answer: string, status: 'won' | 'lost', n = 1) => {
  let g = createGame(answer)
  const wrong = answer === 'crane' ? 'slate' : 'crane'
  const count = status === 'won' ? n : 6
  for (let i = 0; i < count; i++) g = submitGuess(g, status === 'won' && i === count - 1 ? answer : wrong, () => true).game!

  return g
}

const boot = async ($: any, on: any, { now = NOON, store = {}, answers = {} }: { now?: number; store?: Record<string, unknown>; answers?: Record<string, string> } = {}) => {
  // a store of our own, so a test can read what the plugin wrote (mock.store keeps its copy private)
  const clone = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
  // RANDOM GAME takes the first date still unplayed (a fixed pick of 0), unless a test sets another
  const data = new Map<string, unknown>(Object.entries({ [RANDOM_KEY]: 0, ...store }).map(([k, v]) => [k, clone(v)]))
  on('store.get', async (_$: any, e: any) => ({ value: clone(data.get(e.key)) }) as any)
  on('store.set', async (_$: any, e: any) => {
    data.set(e.key, clone(e.value))

    return { value: undefined } as any
  })
  on('store.delete', async (_$: any, e: any) => ({ value: data.delete(e.key) }) as any)
  on('store.keys', async () => ({ value: [...data.keys()] }) as any)
  const saved = (key: string) => clone(data.get(key))
  const playedDates = () => (saved(PLAYED_KEY) as any)?.dates ?? []
  const clock = mock.clock(on, { now })
  const toasts: string[] = []
  on('http.fetch', async (_$: any, e: any) => ({ value: ok({ solution: answers[e.url.match(/(\d{4}-\d{2}-\d{2})\.json$/)![1]] ?? 'prove' }) }))
  on('fs.read', async () => ({ value: WORDS }) as any)
  on('ui.toast', async (_$: any, e: any) => {
    toasts.push(e.text)

    return { value: undefined } as any
  })
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  const settle = async () => {
    await clock.settle()
    await clock.settle()
  }
  await settle()

  const text = async () => JSON.stringify(await pane.drawn())
  const has = async (key: string) => (await pane.find({ key } as any)) != null
  const press = async (key: string) => {
    await pane.press({ key } as any)
    await settle()
  }
  const play = async (word: string, settles = true) => {
    await pane.input({ key: 'guess', text: word, kind: 'change' } as any)
    await pane.input({ key: 'guess', text: word, kind: 'submit' } as any)
    if (settles) await settle()
  }
  const isPicker = () => has('card-random')
  const typeDate = async (date: string) => {
    await pane.input({ key: 'archive-date', text: date, kind: 'submit' } as any)
    await settle()
  }

  return { pane, clock, saved, playedDates, toasts, text, has, press, play, isPicker, typeDate, settle }
}

test('which screen opens: an unfinished daily opens the game, a finished one the picker', async ($, on) => {
  const fresh = await boot($, on)
  expect(await fresh.isPicker()).toBe(false)
  expect(await fresh.has('guess')).toBe(true)
  expect(await fresh.text()).toContain('GUESS 1 OF 6')
})

test('a finished daily opens the picker, with how it ended in the header', async ($, on) => {
  const won = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 4) } })
  expect(await won.isPicker()).toBe(true)
  expect(await won.has('guess')).toBe(false)
  const text = await won.text()
  expect(text).toContain('PICK YOUR NEXT GAME')
  expect(text).toContain('SOLVED 4/6')
  expect(text).toContain('00200') // 1UP: the daily's score
  expect(text).toContain('NEXT DAILY IN 12:00:00')
})

test('a lost daily opens the picker and names the word', async ($, on) => {
  const lost = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'lost') } })
  expect(await lost.isPicker()).toBe(true)
  expect(await lost.text()).toContain('LOST · PROVE')
})

test('a daily left halfway still opens the game', async ($, on) => {
  const half = createGame('prove')
  const { game } = submitGuess(half, 'crane', () => true)
  const s = await boot($, on, { store: { [`board:${TODAY}`]: game } })
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('GUESS 2 OF 6')
})

test('finishing today with a win: the whole celebration, then the picker on its own', async ($, on) => {
  const s = await boot($, on)
  await s.play('prove', false)
  await s.clock.advance(500)
  expect(await s.has('fireworks')).toBe(true) // the celebration is on, with nothing to skip it
  expect(await s.has('skip-celebration')).toBe(false)
  await s.clock.advance(2000)
  expect(await s.has('fireworks')).toBe(true) // still playing
  await s.clock.advance(1000) // no press: it ends and the picker opens
  expect(await s.isPicker()).toBe(true)
  expect(await s.text()).toContain('SOLVED 1/6')
})

test('finishing today with a loss: no celebration, the word for a moment, then the picker on its own', async ($, on) => {
  const s = await boot($, on)
  for (let i = 0; i < 5; i++) await s.play('crane')
  await s.play('crane', false)
  expect(await s.has('fireworks')).toBe(false)
  expect(await s.text()).toContain('THE WORD WAS PROVE')
  const button = await s.pane.find({ key: 'continue' } as any) // CONTINUE goes early
  expect(button?.props.label).toBe('⏎ CONTINUE')
  expect(button?.props.hotkey).toBe('1')
  await s.clock.advance(2900)
  expect(await s.isPicker()).toBe(false)
  await s.clock.advance(200)
  expect(await s.isPicker()).toBe(true)
  expect(await s.text()).toContain('LOST · PROVE')
})

test('a lost board left early (CONTINUE, then a game) is not pulled to the picker by its hold', async ($, on) => {
  const s = await boot($, on)
  for (let i = 0; i < 5; i++) await s.play('crane')
  await s.play('crane', false)
  await s.press('continue')
  expect(await s.isPicker()).toBe(true)
  await s.press('random') // a new game, before the 3 seconds are up
  expect(await s.isPicker()).toBe(false)
  await s.clock.advance(3500)
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('PRACTICE STAGE')
})

test('finishing a practice game: celebration on a win, then the picker; a loss too', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  await s.press('random') // 2021-06-19, answer prove
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('PRACTICE STAGE')
  await s.play('prove', false)
  await s.clock.advance(500)
  expect(await s.has('fireworks')).toBe(true)
  await s.clock.advance(3100)
  expect(await s.isPicker()).toBe(true)

  await s.press('random') // 2021-06-20
  for (let i = 0; i < 5; i++) await s.play('crane')
  await s.play('crane', false)
  expect(await s.text()).toContain('THE WORD WAS PROVE')
  await s.clock.advance(3100)
  expect(await s.isPicker()).toBe(true)
})

test('three random games in a row never repeat, and every one that ends joins played-today', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  const seen: string[] = []
  for (let i = 0; i < 3; i++) {
    await s.press('random')
    seen.push(((await s.pane.find({ key: 'stage-date' } as any)) as any)?.text)
    await s.play('prove')
    await s.clock.advance(3100) // the celebration runs out and the picker is back
    expect(await s.isPicker()).toBe(true)
  }
  expect(new Set(seen).size).toBe(3)
  expect(s.saved(PLAYED_KEY)).toEqual({ day: TODAY, dates: ['2021-06-19', '2021-06-20', '2021-06-21'] })
  // the caption's count shrinks by the three
  expect(await s.text()).toContain(`${(poolSize(TODAY) - 3).toLocaleString('en-US')} left`)
})

test('random with every date played says so and starts the set over', async ($, on) => {
  const s = await boot($, on, {
    store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: TODAY, dates: wholePool(TODAY) } },
  })
  expect(await s.text()).toContain('0 left')
  await s.press('random')
  expect(s.toasts).toContain(ALL_PLAYED_MESSAGE)
  expect(await s.isPicker()).toBe(true)
  expect(s.saved(PLAYED_KEY)).toEqual({ day: TODAY, dates: [] })
  expect(await s.text()).toContain(`${poolSize(TODAY).toLocaleString('en-US')} left`)
  await s.press('random') // and the next one plays
  expect(await s.isPicker()).toBe(false)
})

test('the date dropdown lists the 14 newest unplayed dates, starts on the newest, and 2 plays the pick', async ($, on) => {
  const s = await boot($, on, {
    store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: TODAY, dates: ['2026-10-08', '2026-10-07', '2026-10-04'] } },
  })
  const pick = async () => (await s.pane.find({ key: 'pick-date' } as any)) as any
  const values = (await pick()).props.options.map((o: any) => o.value)
  expect(values).toHaveLength(14)
  expect(values[0]).toBe('2026-10-06') // newest first; played dates and today are never offered
  expect(values).not.toContain('2026-10-04')
  expect(values).not.toContain(TODAY)
  expect((await pick()).props.options[0].label).toBe('06 OCT 2026')
  expect((await pick()).props.value).toBe('2026-10-06')
  expect(await s.text()).toContain('played today are left out')

  // picking only chooses; 2: play plays it
  await s.pane.select({ key: 'pick-date', value: '2026-10-03' } as any)
  await s.settle()
  expect(await s.isPicker()).toBe(true)
  expect((await pick()).props.value).toBe('2026-10-03')
  await s.press('pick-play')
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('03 OCT')
})

test('the dropdown offers what is left when few dates are unplayed', async ($, on) => {
  const played = wholePool(TODAY).filter(d => !['2021-06-19', '2021-06-20', '2026-10-08'].includes(d))
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: TODAY, dates: played } } })
  const pick = (await s.pane.find({ key: 'pick-date' } as any)) as any
  expect(pick.props.options.map((o: any) => o.value)).toEqual(['2026-10-08', '2021-06-20', '2021-06-19'])
})

test('typed dates are rejected with a message, the field stays, and a good one plays', async ($, on) => {
  const s = await boot($, on, {
    store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: TODAY, dates: ['2026-10-08'] } },
  })
  await s.press('date-entry')
  const rejected: [string, string][] = [
    [TODAY, "Today's puzzle is the daily"],
    ['2026-10-10', 'in the future'],
    ['2021-06-18', 'No puzzles before 2021-06-19'],
    ['2026-10-08', 'already played 2026-10-08 today'],
    ['nope', 'YYYY-MM-DD'],
  ]
  for (const [input, message] of rejected) {
    await s.typeDate(input)
    expect(s.toasts.at(-1)).toContain(message)
    expect(await s.isPicker()).toBe(true)
    expect(await s.has('archive-date')).toBe(true)
  }
  expect(s.toasts).toHaveLength(rejected.length)
  await s.typeDate('2024-01-01')
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('01 JAN')
})

test('the played-today set empties when the day changes, and is overwritten', async ($, on) => {
  const s = await boot($, on, {
    store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: '2026-10-08', dates: ['2026-10-01', '2026-10-02'] } },
  })
  // yesterday's record is another day's: the pool is whole, and the dropdown starts on yesterday
  expect(await s.text()).toContain(`${poolSize(TODAY).toLocaleString('en-US')} left`)
  expect(((await s.pane.find({ key: 'pick-date' } as any)) as any)?.props.value).toBe('2026-10-08')
  expect(s.playedDates()).toEqual([])
})

test('a day rollover on the picker: the counts reset and today is a new, unfinished daily', async ($, on) => {
  const late = Date.parse(`${TODAY}T23:59:58`)
  const s = await boot($, on, {
    now: late,
    store: { [`board:${TODAY}`]: finished('prove', 'won', 2), [PLAYED_KEY]: { day: TODAY, dates: ['2026-10-08'] } },
  })
  expect(await s.text()).toContain('NEXT DAILY IN 00:00:02')
  expect(await s.text()).toContain('SOLVED 2/6')
  await s.clock.advance(3000)
  const text = await s.text()
  expect(text).toContain('NEXT DAILY IN 23:59:5')
  expect(text).toContain('NOT FINISHED') // 10-10's daily is not played yet
  expect(text).toContain(`${poolSize('2026-10-10').toLocaleString('en-US')} left`) // yesterday's 10-09 joined the pool, 10-08 no longer played
  expect(s.saved(PLAYED_KEY)).toEqual({ day: '2026-10-10', dates: [] })
})

test('the countdown ticks every second', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  expect(await s.text()).toContain('NEXT DAILY IN 12:00:00')
  await s.clock.advance(1000)
  expect(await s.text()).toContain('NEXT DAILY IN 11:59:59')
  await s.clock.advance(59000)
  expect(await s.text()).toContain('NEXT DAILY IN 11:59:00')
})

test('opening a finished past date starts a fresh board that replaces it; today is untouched', async ($, on) => {
  const todays = finished('prove', 'won', 3)
  const s = await boot($, on, { store: { [`board:${TODAY}`]: todays, 'board:2024-01-01': finished('prove', 'won', 2) } })
  await s.press('date-entry')
  await s.typeDate('2024-01-01')
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('GUESS 1 OF 6') // fresh, not the finished board
  expect(s.saved('board:2024-01-01')).toEqual(createGame('prove'))
  expect(s.saved(`board:${TODAY}`)).toEqual(todays)
  // opening it did not put it in played-today
  expect(s.playedDates()).not.toContain('2024-01-01')
})

test('leaving a game halfway keeps it out of played-today, and opening it again resumes it', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  await s.press('random') // 2021-06-19
  await s.play('crane') // one guess, then leave
  await s.press('play-today') // the game screen's own way out: today's finished board
  await s.press('continue')
  expect(await s.isPicker()).toBe(true)
  expect(s.playedDates()).toEqual([])
  expect(await s.text()).toContain(`${poolSize(TODAY).toLocaleString('en-US')} left`) // still in the pool
  await s.press('random') // the same date comes up and resumes
  expect(await s.text()).toContain('GUESS 2 OF 6')
  const first = await s.pane.find({ key: 't0-0' } as any)
  expect(first?.children[0].children[0]).toBe(' C ')
})

test('a date joins played-today only when its game is won or lost', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  const dates = async () => s.playedDates()
  await s.press('random') // 2021-06-19: opening it adds nothing
  expect(await dates()).toEqual([])
  await s.play('crane') // a guess, not an ending
  expect(await dates()).toEqual([])
  await s.play('prove') // won
  expect(await dates()).toEqual(['2021-06-19'])
  await s.clock.advance(3100) // onto the picker
  await s.press('random') // 2021-06-20: lost
  for (let i = 0; i < 6; i++) await s.play('crane')
  expect(await dates()).toEqual(['2021-06-19', '2021-06-20'])
})

test('random and picked games are practice: the stats do not change', async ($, on) => {
  const stats = { currentStreak: 3, maxStreak: 5, wins: 7, played: 9, distribution: [0, 1, 3, 2, 1, 0] }
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2), stats } })
  await s.press('random')
  await s.play('prove')
  await s.clock.advance(3100)
  await s.press('random')
  for (let i = 0; i < 6; i++) await s.play('crane')
  await s.clock.advance(3100)
  await s.press('date-entry')
  await s.typeDate('2024-01-01')
  await s.play('prove', false)
  await s.clock.advance(3100)
  expect(s.saved('stats')).toEqual(stats)
  expect(await s.text()).toContain('00400') // HI: the stats' best win, a 2-guess one
})

test("↺ TODAY'S BOARD reopens today's finished board read-only, CONTINUE goes back", async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 3) } })
  await s.press('todays-board')
  expect(await s.isPicker()).toBe(false)
  expect(await s.text()).toContain('SOLVED IN 3/6')
  expect(await s.has('guess')).toBe(false) // read-only: no typing field
  expect(await s.text()).not.toContain('PRACTICE STAGE')
  await s.press('continue')
  expect(await s.isPicker()).toBe(true)
})

test('the picker shows the offline marker on a fallback word', async ($, on) => {
  mock.store(on, { [`board:${TODAY}`]: finished('prove', 'won', 2), [RANDOM_KEY]: 0 })
  const clock = mock.clock(on, { now: NOON })
  on('http.fetch', async () => {
    throw new Error('offline')
  })
  on('fs.read', async (_$: any, e: any) => ({ value: String(e.path).includes('fallback') ? 'mural\n' : WORDS }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  const pane = await $.ui.mount({ plugin: 'wordle-mod', surface: 'terminal', component: 'Pane', props: {}, requestId: 'wordle' } as any)
  await clock.settle()
  await clock.settle()
  await pane.press({ key: 'random' } as any)
  await clock.settle()
  await clock.settle()
  expect(await pane.find({ key: 'fallback-warning' } as any)).not.toBeNull()
})

test('the picker is the three-part frame: header, a frame holding the two cards, footer', async ($, on) => {
  const s = await boot($, on, { store: { [`board:${TODAY}`]: finished('prove', 'won', 2) } })
  for (const key of ['header', 'frame', 'footer', 'card-random', 'card-pick']) expect(await s.has(key)).toBe(true)
  const frame: any = await s.pane.find({ key: 'frame' } as any)
  // title, blank row, the cards (4 rows) with captions, stats row: the frame's 8 inner rows
  expect(frame.children.map((c: any) => c.props?.key ?? c.type)).toEqual(['title', 'Text', 'cards', 'stats'])
  const row: any = await s.pane.find({ key: 'cards-row' } as any)
  expect(row.children).toHaveLength(2) // side by side at 78 columns
})

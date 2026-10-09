import { expect, test } from 'claude-code/testing'

import { addDays, checkArchiveDate, recentDates } from '../lib/archive.js'
import { applyCompletion, DEFAULT_STATS, loadStats, recordCompletion, winPercent } from '../lib/stats.js'

const memoryIo = (initial?: unknown) => {
  const data = new Map<string, unknown>(initial ? [['stats', initial]] : [])

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

test('a win extends the streak and fills the distribution', () => {
  const a = applyCompletion(DEFAULT_STATS, { won: true, guessCount: 3 })
  const b = applyCompletion(a, { won: true, guessCount: 3 })

  expect(b).toEqual({ currentStreak: 2, maxStreak: 2, wins: 2, played: 2, distribution: [0, 0, 2, 0, 0, 0] })
  expect(DEFAULT_STATS.distribution).toEqual([0, 0, 0, 0, 0, 0]) // never mutated
})

test('a loss resets the streak but keeps the max, and adds no distribution', () => {
  const won = applyCompletion(applyCompletion(DEFAULT_STATS, { won: true, guessCount: 4 }), { won: true, guessCount: 6 })
  const lost = applyCompletion(won, { won: false, guessCount: 6 })

  expect(lost).toMatchObject({ currentStreak: 0, maxStreak: 2, wins: 2, played: 3 })
  expect(lost.distribution).toEqual([0, 0, 0, 1, 0, 1])
  expect(winPercent(lost)).toBe(67)
  expect(winPercent(DEFAULT_STATS)).toBe(0)
})

test('recordCompletion persists to the store and loadStats reads it back', async () => {
  const { io, data } = memoryIo()

  expect(await loadStats(io)).toEqual(DEFAULT_STATS)
  await recordCompletion(io, { won: true, guessCount: 2 })
  expect(data.get('stats')).toMatchObject({ played: 1, wins: 1, currentStreak: 1 })
  expect((await loadStats(io)).distribution).toEqual([0, 1, 0, 0, 0, 0])
})

test('loadStats tolerates a partial stored record', async () => {
  const { io } = memoryIo({ wins: 4 })

  expect(await loadStats(io)).toMatchObject({ wins: 4, played: 0, distribution: [0, 0, 0, 0, 0, 0] })
})

test('archive dates: recent list and validation', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(recentDates('2026-10-07', 3)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05'])
  expect(recentDates('2026-10-07')).toHaveLength(14)

  expect(checkArchiveDate('2024-01-01', '2026-10-07')).toEqual({ ok: true, date: '2024-01-01' })
  expect(checkArchiveDate(' 2026-10-07 ', '2026-10-07')).toEqual({ ok: true, date: '2026-10-07' })
  expect(checkArchiveDate('2026-10-08', '2026-10-07')).toMatchObject({ ok: false })
  expect(checkArchiveDate('2020-01-01', '2026-10-07')).toMatchObject({ ok: false })
  expect(checkArchiveDate('2026-02-30', '2026-10-07')).toMatchObject({ ok: false })
  expect(checkArchiveDate('tomorrow', '2026-10-07')).toMatchObject({ ok: false })
})

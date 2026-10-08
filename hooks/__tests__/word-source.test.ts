import { expect, test } from 'claude-code/testing'

import { isValidGuess, resolveWord } from '../lib/word-source.js'

const FILES: Record<string, string> = {
  'fallback-answers.txt': 'crane\nslate\nprove\nmural\nabout\n',
  'valid-guesses.txt': 'plays\nprove\nabout\n',
}
const NYT: Record<string, string> = { '2026-10-07': 'prove', '2024-01-01': 'mural' }

type Response = { status: number; ok: boolean; text: string }
const ok = (body: unknown): Response => ({ status: 200, ok: true, text: JSON.stringify(body) })

// A stand-in for the `io` that register.js builds from the engine's `$`.
const makeIo = (fetch: (url: string) => Promise<Response>, sleep = () => new Promise<void>(() => {})) => {
  const data = new Map<string, unknown>()
  const calls = { fetch: 0 }

  return {
    calls,
    data,
    io: {
      store: {
        get: async (k: string) => data.get(k),
        set: async (k: string, v: unknown) => void data.set(k, JSON.parse(JSON.stringify(v))),
      },
      fetch: async (url: string) => {
        calls.fetch++

        return fetch(url)
      },
      sleep,
      readData: async (file: string) => FILES[file],
    },
  }
}

const live = async (url: string) => ok({ solution: NYT[url.match(/(\d{4}-\d{2}-\d{2})\.json$/)![1]] })
const offline = async (): Promise<Response> => {
  throw new Error('offline')
}

test('resolves live answers and caches them', async () => {
  const { io, calls, data } = makeIo(live)

  expect(await resolveWord(io, '2026-10-07')).toEqual({ solution: 'prove', source: 'live' })
  expect(await resolveWord(io, '2024-01-01')).toEqual({ solution: 'mural', source: 'live' })
  expect(calls.fetch).toBe(2)
  await resolveWord(io, '2026-10-07')
  expect(calls.fetch).toBe(2)
  expect(data.get('word:2026-10-07')).toEqual({ solution: 'prove', source: 'live' })
})

test('falls back when the network rejects, and tries the live word again next time', async () => {
  const { io, calls } = makeIo(offline)

  const first = await resolveWord(io, '2026-10-07')
  expect(first.source).toBe('fallback')
  expect(first.solution).toMatch(/^[a-z]{5}$/)
  // the same offline word every time, but each look retries live (a blip must not stick)
  expect(await resolveWord(io, '2026-10-07')).toEqual(first)
  expect(calls.fetch).toBe(2)
})

test('an offline word is upgraded once the live word is reachable, and a live word is final', async () => {
  let isOnline = false
  const { io, calls, data } = makeIo(async url => (isOnline ? live(url) : offline()))

  expect((await resolveWord(io, '2026-10-07')).source).toBe('fallback')
  isOnline = true
  expect(await resolveWord(io, '2026-10-07')).toEqual({ solution: 'prove', source: 'live' })
  expect(data.get('word:2026-10-07')).toEqual({ solution: 'prove', source: 'live' })

  const fetched = calls.fetch
  expect(await resolveWord(io, '2026-10-07')).toEqual({ solution: 'prove', source: 'live' })
  expect(calls.fetch).toBe(fetched) // a live word is never fetched again
})

test('falls back on non-200 and on a missing solution field', async () => {
  let bad = true
  const { io } = makeIo(async () => (bad ? { status: 500, ok: false, text: '' } : ok({ id: 1 })))

  expect((await resolveWord(io, '2026-01-01')).source).toBe('fallback')
  bad = false
  expect((await resolveWord(io, '2026-01-02')).source).toBe('fallback')
})

test('falls back when the fetch never answers (3s timeout)', async () => {
  const { io } = makeIo(
    () => new Promise<Response>(() => {}),
    () => Promise.resolve(), // the 3s sleep elapses at once
  )

  expect((await resolveWord(io, '2026-03-03')).source).toBe('fallback')
})

test('fallback word is deterministic per date and varies across dates', async () => {
  const a1 = await resolveWord(makeIo(offline).io, '2026-05-05')
  const a2 = await resolveWord(makeIo(offline).io, '2026-05-05')
  const b = await resolveWord(makeIo(offline).io, '2026-05-06')

  expect(a1).toEqual(a2)
  expect(a1.solution).not.toBe(b.solution)
  expect(['crane', 'slate', 'prove', 'mural', 'about']).toContain(a1.solution)
})

test('rejects a malformed date', async () => {
  const { io } = makeIo(live)

  await expect(resolveWord(io, 'tomorrow')).rejects.toThrow()
})

test('validates guesses against the bundled list', async () => {
  const { io } = makeIo(live)

  expect(await isValidGuess(io, 'plays')).toBe(true)
  expect(await isValidGuess(io, ' PROVE ')).toBe(true)
  expect(await isValidGuess(io, 'zzzzz')).toBe(false)
})

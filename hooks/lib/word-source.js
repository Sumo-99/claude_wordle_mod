const LIVE_URL = date => `https://www.nytimes.com/svc/wordle/v2/${date}.json`
const TIMEOUT_MS = 3000
const DAY_MS = 86400000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WORD_RE = /^[a-z]{5}$/

// Loaded once per module load; a hot reload simply re-reads the files.
let fallbackList
let guessSet

/**
 * `io` is what the library needs from the engine, built in register.js:
 * `{ store: { get, set }, fetch, sleep, readData }`. The engine's `$` can't be
 * passed across an import, so the caller wraps the calls it needs.
 */
const readLines = async (io, file) => {
  const text = await io.readData(file)

  return text
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(Boolean)
}

const loadFallback = async io => {
  fallbackList ??= readLines(io, 'fallback-answers.txt').catch(error => {
    fallbackList = undefined
    throw error
  })

  return fallbackList
}

const loadGuesses = async io => {
  guessSet ??= readLines(io, 'valid-guesses.txt')
    .then(words => new Set(words))
    .catch(error => {
      guessSet = undefined
      throw error
    })

  return guessSet
}

/** Whole days between 1970-01-01 and `dateStr` (YYYY-MM-DD), in UTC. */
export const daysSinceEpoch = dateStr => Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / DAY_MS)

const fetchLive = async (io, dateStr) => {
  const response = await Promise.race([
    io.fetch(LIVE_URL(dateStr)),
    io.sleep(TIMEOUT_MS).then(() => {
      throw new Error('timeout')
    }),
  ])
  if (!response.ok) throw new Error(`status ${response.status}`)
  const solution = JSON.parse(response.text)?.solution
  if (typeof solution !== 'string' || !WORD_RE.test(solution.toLowerCase())) {
    throw new Error('missing solution')
  }

  return solution.toLowerCase()
}

/**
 * The answer for `dateStr` (YYYY-MM-DD): a cached live word, else live from NYT,
 * else a deterministic offline word (retried live next time). Never throws for a
 * network or schema problem.
 *
 * @returns {Promise<{ solution: string, source: 'live' | 'fallback' }>}
 */
export const resolveWord = async (io, dateStr) => {
  if (!DATE_RE.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    throw new Error(`resolveWord: expected YYYY-MM-DD, got ${dateStr}`)
  }
  const key = `word:${dateStr}`
  const cached = await io.store.get(key)
  // A live word is final. A cached fallback is only a stand-in, so every look at
  // that date tries the live source again and upgrades the record if it answers.
  if (cached?.source === 'live') return cached

  try {
    const result = { solution: await fetchLive(io, dateStr), source: 'live' }
    await io.store.set(key, result)

    return result
  } catch {
    if (cached) return cached
    const list = await loadFallback(io)
    const index = ((daysSinceEpoch(dateStr) % list.length) + list.length) % list.length
    const result = { solution: list[index], source: 'fallback' }
    await io.store.set(key, result)

    return result
  }
}

/** Whether `word` is an allowed guess (answers are included in the list). */
export const isValidGuess = async (io, word) => {
  const guesses = await loadGuesses(io)

  return guesses.has(String(word).trim().toLowerCase())
}

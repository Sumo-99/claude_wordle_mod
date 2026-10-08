export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

/**
 * Scores `guess` against `answer`: an array of 'green' | 'yellow' | 'gray'.
 * Greens claim their letters first; each remaining guess letter is yellow only
 * while an unclaimed copy of it is left in the answer, so repeats never score
 * more often than the answer holds them.
 */
export const scoreGuess = (guess, answer) => {
  const g = guess.toLowerCase()
  const a = answer.toLowerCase()
  const result = Array(WORD_LENGTH).fill('gray')
  const pool = {}

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) result[i] = 'green'
    else pool[a[i]] = (pool[a[i]] ?? 0) + 1
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'green' || !pool[g[i]]) continue
    result[i] = 'yellow'
    pool[g[i]]--
  }

  return result
}

/** A fresh game. Games are plain data; `submitGuess` returns new ones. */
export const createGame = answer => ({
  answer: answer.toLowerCase(),
  guesses: [],
  status: 'playing',
})

/**
 * Plays `guess` into `game` without mutating it.
 *
 * `isValid` is a sync predicate for allowed guesses (the caller resolves the
 * word list; this module does no I/O). Resolves to `{ ok: true, game }`, or
 * `{ ok: false, reason }` with reason 'finished' | 'length' | 'invalid'; a
 * rejected guess costs nothing.
 */
export const submitGuess = (game, guess, isValid) => {
  if (game.status !== 'playing') return { ok: false, reason: 'finished' }
  const word = String(guess).trim().toLowerCase()
  if (!/^[a-z]+$/.test(word) || word.length !== WORD_LENGTH) return { ok: false, reason: 'length' }
  if (!isValid(word)) return { ok: false, reason: 'invalid' }

  const scored = { word, score: scoreGuess(word, game.answer) }
  const guesses = [...game.guesses, scored]
  const status = scored.score.every(s => s === 'green')
    ? 'won'
    : guesses.length >= MAX_GUESSES
      ? 'lost'
      : 'playing'

  return { ok: true, game: { ...game, guesses, status } }
}

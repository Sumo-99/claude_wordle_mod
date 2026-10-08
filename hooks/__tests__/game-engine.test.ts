import { expect, test } from 'claude-code/testing'

import { createGame, scoreGuess, submitGuess } from '../lib/game-engine.js'

const G = 'green'
const Y = 'yellow'
const X = 'gray'

test('scoreGuess handles double letters', () => {
  expect(scoreGuess('alloy', 'atoll')).toEqual([G, Y, Y, Y, X])
  expect(scoreGuess('speed', 'abide')).toEqual([X, X, Y, X, Y])
  expect(scoreGuess('eerie', 'where')).toEqual([Y, X, Y, X, G])
  expect(scoreGuess('robot', 'floor')).toEqual([Y, Y, X, G, X])
  expect(scoreGuess('crane', 'crane')).toEqual([G, G, G, G, G])
  expect(scoreGuess('xxxxx', 'crane')).toEqual([X, X, X, X, X])
})

test('a green claims its letter before an earlier copy can score yellow', () => {
  // hello has one E (green at 2); the guess's second E gets nothing
  expect(scoreGuess('level', 'hello')).toEqual([Y, G, X, X, Y])
  expect(scoreGuess('lilly', 'hello')).toEqual([X, X, G, G, X])
  expect(scoreGuess('llama', 'hello')).toEqual([Y, Y, X, X, X])
})

test('scoring is case-insensitive', () => {
  expect(scoreGuess('CRANE', 'crane')).toEqual([G, G, G, G, G])
})

const always = () => true

test('createGame starts empty and playing', () => {
  expect(createGame('Crane')).toEqual({ answer: 'crane', guesses: [], status: 'playing' })
})

test('submitGuess rejects bad length, invalid words and finished games without mutating', () => {
  const game = createGame('crane')

  expect(submitGuess(game, 'cat', always)).toEqual({ ok: false, reason: 'length' })
  expect(submitGuess(game, 'cr4ne', always)).toEqual({ ok: false, reason: 'length' })
  expect(submitGuess(game, 'zzzzz', () => false)).toEqual({ ok: false, reason: 'invalid' })
  expect(game.guesses.length).toBe(0)

  const won = submitGuess(game, 'crane', always)
  expect(won.ok && won.game.status).toBe('won')
  expect(submitGuess((won as any).game, 'slate', always)).toEqual({ ok: false, reason: 'finished' })
  expect(game.status).toBe('playing')
})

test('lost only after the 6th incorrect guess', () => {
  let game = createGame('crane')
  const wrong = ['slate', 'about', 'pound', 'light', 'fuzzy', 'mommy']

  wrong.forEach((word, i) => {
    const out = submitGuess(game, word, always)
    if (!out.ok) throw new Error('rejected')
    game = out.game
    expect(game.guesses.length).toBe(i + 1)
    expect(game.status).toBe(i < 5 ? 'playing' : 'lost')
  })
})

test('winning on the 6th guess is a win, not a loss', () => {
  let game = createGame('crane')
  for (const word of ['slate', 'about', 'pound', 'light', 'fuzzy', 'crane']) {
    const out = submitGuess(game, word, always)
    if (!out.ok) throw new Error('rejected')
    game = out.game
  }
  expect(game.status).toBe('won')
})

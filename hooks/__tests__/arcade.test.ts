import { expect, test } from 'claude-code/testing'

import { gameScore, hiScore, keyLook, livesText, PALETTE, stageLabel, stepStage, tileLook } from '../lib/arcade.js'

const game = (status: string, n: number) => ({ answer: 'prove', status, guesses: Array.from({ length: n }, () => ({ word: 'crane', score: [] })) }) as any

test('score: 100 for every guess left on a win, nothing otherwise', () => {
  expect(gameScore(game('won', 1))).toBe(500)
  expect(gameScore(game('won', 2))).toBe(400)
  expect(gameScore(game('won', 6))).toBe(0)
  expect(gameScore(game('lost', 6))).toBe(0)
  expect(gameScore(game('playing', 3))).toBe(0)
  expect(gameScore(null)).toBe(0)
})

test('HI-SCORE: the score of the fewest-guess win the stats hold', () => {
  expect(hiScore({ distribution: [0, 0, 0, 0, 0, 0] })).toBe(0)
  expect(hiScore({ distribution: [0, 0, 2, 5, 1, 0] })).toBe(300) // best win took 3 guesses
  expect(hiScore({ distribution: [1, 0, 0, 0, 0, 0] })).toBe(500)
  expect(hiScore({ distribution: [0, 0, 0, 0, 0, 4] })).toBe(0) // a 6-guess win scores nothing
  expect(hiScore(undefined)).toBe(0)
})

test('lives: a filled diamond per guess left, a hollow one per guess used', () => {
  expect(livesText(game('playing', 0))).toBe('◆ ◆ ◆ ◆ ◆ ◆')
  expect(livesText(game('playing', 2))).toBe('◆ ◆ ◆ ◆ ◇ ◇')
  expect(livesText(game('lost', 6))).toBe('◇ ◇ ◇ ◇ ◇ ◇')
})

test('stage label: day and month, the way the header shows it', () => {
  expect(stageLabel('2026-09-27')).toBe('27 SEP')
  expect(stageLabel('2026-10-05')).toBe('05 OCT')
  expect(stageLabel('2027-01-01')).toBe('01 JAN')
})

test('stage stepping: ◀ ▶ walk today and the 13 days before it, no further', () => {
  const today = '2026-10-08'
  expect(stepStage(today, today, -1)).toBe('2026-10-07')
  expect(stepStage(today, today, 1)).toBeNull() // no future puzzles
  expect(stepStage('2026-10-07', today, 1)).toBe(today)
  expect(stepStage('2026-09-30', today, 1)).toBe('2026-10-01') // across a month
  expect(stepStage('2026-09-25', today, -1)).toBeNull() // the oldest of the 14
  expect(stepStage('2026-09-26', today, -1)).toBe('2026-09-25')
  // a date typed from further back steps forward into the window
  expect(stepStage('2025-01-01', today, 1)).toBe('2026-09-25')
  expect(stepStage('2025-01-01', today, -1)).toBeNull()
})

test('tiles: green and amber fills with a background-colored letter; a miss is dark with a dim letter', () => {
  expect(tileLook('green')).toEqual({ fill: PALETTE.correct, letter: PALETTE.background })
  expect(tileLook('yellow')).toEqual({ fill: PALETTE.present, letter: PALETTE.background })
  expect(tileLook('gray')).toEqual({ fill: PALETTE.miss, letter: PALETTE.dim })
})

test('keys: chips filled by best known state; a known miss is eaten', () => {
  expect(keyLook('green')).toEqual({ fill: PALETTE.correct })
  expect(keyLook('yellow')).toEqual({ fill: PALETTE.present })
  expect(keyLook(undefined)).toEqual({ fill: '#2e2a26' })
  expect(keyLook('gray')).toEqual({ isEaten: true })
})

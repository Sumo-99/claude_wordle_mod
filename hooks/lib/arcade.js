import { addDays } from './archive.js'
import { MAX_GUESSES } from './game-engine.js'

// Raw hex, not theme keys: the arcade look is one fixed palette ("Claude night"),
// drawn the same whatever the person's theme. See docs/ui-ref/wordle-ui-final.png.
export const PALETTE = {
  background: '#171513',
  panel: '#1f1c19',
  walls: '#d97757',
  title: '#e8875f',
  subtitle: '#e58fc4',
  text: '#f0e8dc',
  dim: '#6e655b',
  correct: '#5fb87a',
  present: '#f0b44c',
  miss: '#2e2a26',
  active: '#2e2a26',
  accent: '#d97757',
  pellet: '#e8a07c',
  keyIdle: '#2e2a26',
  divider: '#3a3430',
  ready: '#f0b44c',
  lives: '#e8875f',
  streak: '#e58fc4',
  best: '#7cc4e8',
  winPercent: '#f0b44c',
  stage: '#e8875f',
}

/** The score a game earns: 100 for every guess left unused on a win, 0 otherwise. */
export const gameScore = game => (game?.status === 'won' ? (MAX_GUESSES - game.guesses.length) * 100 : 0)

/**
 * The best score in the stats: the score of the fewest-guess win the
 * distribution records. Stats only count today's puzzles, so practice never sets it.
 */
export const hiScore = stats => {
  const fewest = (stats?.distribution ?? []).findIndex(n => n > 0)

  return fewest < 0 ? 0 : (MAX_GUESSES - (fewest + 1)) * 100
}

export const pad = (n, width) => String(Math.max(0, n)).padStart(width, '0')

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** '2026-09-27' → '27 SEP'. */
export const stageLabel = date => `${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`

export const STAGE_DAYS = 14

/**
 * Where ◀ (dir -1) or ▶ (dir +1) goes from `date`, or null when there is
 * nowhere to go: the steps cover today and the 13 days before it. A date
 * typed from further back steps forward into that window.
 */
export const stepStage = (date, today, dir) => {
  const oldest = addDays(today, -(STAGE_DAYS - 1))
  if (dir < 0) return date > oldest ? addDays(date, -1) : null
  if (date >= today) return null

  return date < oldest ? oldest : addDays(date, 1)
}

/** ◆ for every guess left, ◇ for every guess used. */
export const livesText = game => {
  const used = game.guesses.length

  return [...'◆'.repeat(MAX_GUESSES - used), ...'◇'.repeat(used)].join(' ')
}

const SCORE_FILL = { green: PALETTE.correct, yellow: PALETTE.present, gray: PALETTE.miss }

/** A scored tile: its fill, and a letter in the background color (dim on a miss). */
export const tileLook = score => ({
  fill: SCORE_FILL[score],
  letter: score === 'gray' ? PALETTE.dim : PALETTE.background,
})

const KEY_FILL = { green: PALETTE.correct, yellow: PALETTE.present }

/**
 * How the on-screen key for a letter in `state` (keyStates) is drawn: a chip
 * with this fill, or, once the letter is a known miss, no key at all
 * (`{ isEaten: true }`, an eaten pellet).
 */
export const keyLook = state => (state === 'gray' ? { isEaten: true } : { fill: KEY_FILL[state] ?? PALETTE.keyIdle })

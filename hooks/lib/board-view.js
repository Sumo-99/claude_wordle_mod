import { WORD_LENGTH } from './game-engine.js'

export const FALLBACK_NOTE = "Couldn't reach the live word — showing an offline puzzle instead."

const MAX_GUESSES = 6
const TILE = { green: '🟩', yellow: '🟨', gray: '⬜' }
const EMPTY = '▫️·'
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

// A hotkey is one digit or one lowercase letter, so Enter and Backspace sit on
// digits: all 26 letters belong to the letter keys.
export const ENTER_KEY = '1'
export const BACKSPACE_KEY = '2'

/** Letters ruled out so far: gray everywhere they appear. */
const ruledOut = game => {
  const seen = new Set()
  const kept = new Set()
  for (const { word, score } of game.guesses) {
    ;[...word].forEach((ch, i) => {
      seen.add(ch)
      if (score[i] !== 'gray') kept.add(ch)
    })
  }

  return new Set([...seen].filter(ch => !kept.has(ch)))
}

const rowCells = (game, draft, r) => {
  const played = game.guesses[r]
  if (played) return [...played.word].map((ch, i) => `${TILE[played.score[i]]}${ch.toUpperCase()}`)
  const isActive = r === game.guesses.length && game.status === 'playing'

  return Array.from({ length: WORD_LENGTH }, (_, i) => (isActive && draft[i] ? `▫️${draft[i].toUpperCase()}` : EMPTY))
}

const statusLine = game =>
  game.status === 'won'
    ? `Solved in ${game.guesses.length}/${MAX_GUESSES} 🎉`
    : game.status === 'lost'
      ? `The word was ${game.answer.toUpperCase()}`
      : `Guess ${game.guesses.length + 1}/${MAX_GUESSES} · Enter = ${ENTER_KEY}, ⌫ = ${BACKSPACE_KEY}`

/**
 * The pane's tree for one game state. Pure: the caller supplies the element
 * factory `h`, the surface's `Box`/`Text`/`Button`, and the press callbacks, so
 * this file never touches the engine's `$`.
 *
 * @param ui `{ h, Box, Text, Button }`
 * @param view `{ game, draft, puzzle }`; `game` null means still loading
 * @param on `{ letter(ch), enter(), backspace(), fallbackInfo() }`
 */
export const renderBoard = ({ h, Box, Text, Button }, { game, draft, puzzle }, on) => {
  if (!game) return h(Box, { flexDirection: 'column' }, h(Text, null, 'Loading today’s puzzle…'))

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) =>
    h(Text, { key: `row${r}` }, rowCells(game, draft, r).join(' ')),
  )

  const gray = ruledOut(game)
  const keyboard = KEY_ROWS.map((row, i) => {
    const keys = [...row].map(ch =>
      h(Button, { key: `k-${ch}`, label: ch.toUpperCase(), hotkey: ch, dimColor: gray.has(ch), onPress: () => on.letter(ch) }),
    )
    if (i === 2) {
      keys.unshift(h(Button, { key: 'enter', label: 'Enter', hotkey: ENTER_KEY, variant: 'primary', onPress: () => on.enter() }))
      keys.push(h(Button, { key: 'back', label: '⌫', hotkey: BACKSPACE_KEY, onPress: () => on.backspace() }))
    }

    return h(Box, { key: `krow${i}`, flexDirection: 'row', gap: 1 }, ...keys)
  })

  return h(
    Box,
    { flexDirection: 'column', gap: 1 },
    h(Box, { flexDirection: 'row', gap: 1 }, h(Text, { bold: true }, 'Wordle'), puzzle && h(Text, { dimColor: true }, puzzle.date)),
    puzzle?.source === 'fallback' &&
      h(Button, { key: 'fallback-warning', label: '⚠ offline puzzle', onPress: () => on.fallbackInfo() }),
    h(Box, { flexDirection: 'column' }, ...rows),
    h(Text, { dimColor: true }, statusLine(game)),
    h(Box, { flexDirection: 'column' }, ...keyboard),
  )
}

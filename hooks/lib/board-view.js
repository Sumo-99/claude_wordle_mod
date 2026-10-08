import { WORD_LENGTH } from './game-engine.js'

export const FALLBACK_NOTE = "Couldn't reach the live word — showing an offline puzzle instead."

const MAX_GUESSES = 6
// Theme keys, so the colors follow the person's theme. Every scored letter is
// also underlined, which keeps a gray (absent) letter distinct from an unplayed
// one and gives color-blind players a second cue besides the legend.
const SCORE_COLOR = { green: 'success', yellow: 'warning', gray: 'inactive' }
const LEGEND = [
  ['green', 'right letter, right place'],
  ['yellow', 'right letter, wrong place'],
  ['gray', 'letter not in the word'],
]
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

/** One row of five letters: scored letters colored and underlined, typed ones plain. */
const letterRow = (h, Box, Text, game, draft, r) => {
  const played = game.guesses[r]
  const isActive = r === game.guesses.length && game.status === 'playing'
  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => {
    if (played) {
      return h(Text, { key: i, bold: true, underline: true, color: SCORE_COLOR[played.score[i]] }, played.word[i].toUpperCase())
    }
    if (isActive && draft[i]) return h(Text, { key: i, bold: true }, draft[i].toUpperCase())

    return h(Text, { key: i, dimColor: true }, '·')
  })

  return h(Box, { key: `row${r}`, flexDirection: 'row', gap: 1 }, ...cells)
}

const legend = (h, Box, Text) =>
  h(
    Box,
    { flexDirection: 'column' },
    h(Text, { dimColor: true }, 'Legend'),
    ...LEGEND.map(([score, meaning]) =>
      h(
        Box,
        { key: `legend-${score}`, flexDirection: 'row', gap: 1 },
        h(Text, { bold: true, underline: true, color: SCORE_COLOR[score] }, 'A'),
        h(Text, null, meaning),
      ),
    ),
  )

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
 * @param ui `{ h, Box, Text, Button, Input }`
 * @param view `{ game, draft, puzzle }`; `game` null means still loading
 * @param on `{ letter(ch), enter(), backspace(), input(text), fallbackInfo() }`
 */
export const renderBoard = ({ h, Box, Text, Button, Input }, { game, draft, puzzle }, on) => {
  if (!game) return h(Box, { flexDirection: 'column' }, h(Text, null, 'Loading today’s puzzle…'))

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => letterRow(h, Box, Text, game, draft, r))

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
    // The typing surface: the field edits `draft` natively (Backspace deletes the
    // last letter, Enter submits); the on-screen keys feed the same draft.
    game.status === 'playing' &&
      h(Input, {
        key: 'guess',
        label: 'Guess: ',
        placeholder: 'type a word',
        value: draft,
        autoFocus: true,
        submitLabel: 'guess',
        onInput: text => on.input(text),
        onSubmit: () => on.enter(),
      }),
    // keyboard and legend side by side, the legend toward the right
    h(Box, { flexDirection: 'row', gap: 4, alignItems: 'flex-end' }, h(Box, { flexDirection: 'column' }, ...keyboard), legend(h, Box, Text)),
  )
}
